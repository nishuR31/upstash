import puppeteer from "puppeteer";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * Upstash Account Signup & Redis Creation Automator
 */
export async function runAutomation({ email, password, dbName, onLog, onOtpRequired, onStep, onBrowserLaunch }) {
  let browser = null;
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  function log(msg) {
    if (onLog) onLog(msg);
  }

  function setStep(num) {
    if (onStep) onStep(num);
  }

  try {
    log(`[1/8] Launching Chrome Browser for ${email}...`);
    setStep(1);

    let executablePath;
    try {
      const defaultPath = puppeteer.executablePath();
      if (fs.existsSync(defaultPath)) {
        executablePath = defaultPath;
      }
    } catch {
      // Ignore fallback
    }

    if (!executablePath) {
      const homedir = process.env.HOME || os.homedir();
      const searchDirs = [
        `${homedir}/.cache/puppeteer/chrome`,
        `/opt/render/.cache/puppeteer/chrome`,
        `/root/.cache/puppeteer/chrome`,
        path.join(process.cwd(), ".cache", "puppeteer", "chrome")
      ];

      for (const cacheDir of searchDirs) {
        if (fs.existsSync(cacheDir)) {
          try {
            const subdirs = fs.readdirSync(cacheDir);
            for (const dir of subdirs) {
              const candidates = [
                `${cacheDir}/${dir}/chrome-linux64/chrome`,
                `${cacheDir}/${dir}/chrome-linux/chrome`,
                `${cacheDir}/${dir}/chrome`
              ];
              const found = candidates.find(c => fs.existsSync(c));
              if (found) {
                executablePath = found;
                break;
              }
            }
          } catch { }
        }
        if (executablePath) break;
      }
    }

    if (!executablePath) {
      const systemPaths = [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
      ];
      executablePath = systemPaths.find((p) => fs.existsSync(p));
    }

    if (!executablePath) {
      log(`[1/8] Chrome binary not found in system cache. Attempting auto-installation...`);
      try {
        const { execSync } = await import("child_process");
        execSync("npx puppeteer browsers install chrome", { stdio: "ignore" });
        log(`[1/8] Chrome auto-installation process completed.`);
        try {
          const installedPath = puppeteer.executablePath();
          if (fs.existsSync(installedPath)) executablePath = installedPath;
        } catch { }
      } catch (installErr) {
        log(`[1/8] Auto-installation note: ${installErr.message}`);
      }
    }

    const isHeadless = process.env.HEADLESS !== "false";

    const launchOptions = {
      headless: isHeadless,
      defaultViewport: isHeadless ? { width: 1366, height: 768 } : null,
      args: [
        "--start-maximized",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-blink-features=AutomationControlled",
      ],
    };

    if (executablePath) {
      log(`[1/8] Using browser binary at: ${executablePath} (headless: ${isHeadless})`);
      launchOptions.executablePath = executablePath;
    }

    browser = await puppeteer.launch(launchOptions);
    if (onBrowserLaunch) onBrowserLaunch(browser);

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    // Intercept clipboard copies to catch full TCP URLs and Tokens
    await page.evaluateOnNewDocument(() => {
      window.__copiedStrings = [];
      if (navigator && navigator.clipboard) {
        navigator.clipboard.writeText = async (text) => {
          window.__copiedStrings.push(text);
          return true;
        };
      }
    }).catch(() => {});

    // Network API Response Interceptor for JSON credential payloads
    let interceptedPassword = null;
    let interceptedRestToken = null;
    let interceptedRestUrl = null;
    let interceptedEndpoint = null;

    page.on("response", async (response) => {
      try {
        const url = response.url();
        const headers = response.headers();
        const contentType = headers["content-type"] || "";

        if (
          url.includes("/api/") ||
          url.includes("upstash.com") ||
          contentType.includes("application/json")
        ) {
          const text = await response.text();
          if (
            text.includes("password") ||
            text.includes("rest_token") ||
            text.includes("upstash.io") ||
            text.includes("gQAAAAAA")
          ) {
            const tokenMatch = text.match(/"(?:password|rest_token|restToken|token)"\s*:\s*"([^"]+)"/i);
            if (tokenMatch && tokenMatch[1] && tokenMatch[1].length > 5 && !tokenMatch[1].includes("*")) {
              interceptedPassword = tokenMatch[1];
              interceptedRestToken = tokenMatch[1];
            }

            const endpointMatch = text.match(/"(?:endpoint|host|name)"\s*:\s*"([^"]+\.upstash\.io)"/i);
            if (endpointMatch && endpointMatch[1]) {
              interceptedEndpoint = endpointMatch[1];
            }

            const urlMatch = text.match(/"(?:rest_url|restUrl|url)"\s*:\s*"(https:\/\/[^"]+\.upstash\.io)"/i);
            if (urlMatch && urlMatch[1]) {
              interceptedRestUrl = urlMatch[1];
            }
          }
        }
      } catch {}
    });

    // Step 2: Navigate to Signup
    log("[2/8] Navigating to https://console.upstash.com/auth/sign-up...");
    setStep(2);
    await page.goto("https://console.upstash.com/auth/sign-up", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // Step 3: Fill Credentials
    log("[3/8] Filling signup form (#email, #password)...");
    setStep(3);
    await page.waitForSelector("#email", { timeout: 30000 });
    await page.click("#email");
    await page.type("#email", email, { delay: 40 });

    await page.waitForSelector("#password", { timeout: 30000 });
    await page.click("#password");
    await page.type("#password", password, { delay: 40 });

    log("[3/8] Submitting Sign-Up form...");
    const submitBtn = await page.waitForSelector('button[type="submit"], button.ant-btn-primary', { timeout: 15000 });
    await submitBtn.click();

    // Step 4: OTP Verification Screen
    log("[4/8] Waiting for OTP verification screen (#code)...");
    setStep(4);
    await page.waitForSelector("#code", { timeout: 45000 });

    let otpAttempts = 0;
    const maxOtpAttempts = 3;
    let otpSuccess = false;
    let otpErrorMessage = null;

    while (otpAttempts < maxOtpAttempts && !otpSuccess) {
      otpAttempts++;
      if (otpAttempts > 1) {
        log(`❌ Invalid OTP code entered. Requesting OTP retry (Attempt ${otpAttempts}/${maxOtpAttempts})...`);
      } else {
        log("--> ACTION NEEDED: Please enter 6-digit OTP code.");
      }

      const otpCode = await onOtpRequired({
        attempt: otpAttempts,
        maxAttempts: maxOtpAttempts,
        error: otpErrorMessage,
      });

      log(`[4/8] Injecting OTP code (${otpCode}) into #code input (Attempt ${otpAttempts}/${maxOtpAttempts})...`);
      await page.click("#code", { clickCount: 3 });
      await page.keyboard.press("Backspace");
      await page.type("#code", String(otpCode).trim(), { delay: 50 });

      const otpSubmitBtn = await page.$('button[type="submit"], button.ant-btn-primary');
      if (otpSubmitBtn) {
        await otpSubmitBtn.click();
        log("[4/8] OTP submitted. Verifying...");
      }

      await delay(3500);

      const codeInput = await page.$("#code");
      if (codeInput) {
        otpErrorMessage = await page.evaluate(() => {
          const errEl = document.querySelector('.ant-form-item-has-error, .text-red-500, [role="alert"], .ant-form-item-explain-error');
          return errEl ? errEl.innerText.trim() : "Invalid 6-digit verification code.";
        });

        log(`❌ Invalid OTP Code: "${otpErrorMessage}" (Attempt ${otpAttempts}/${maxOtpAttempts})`);
        if (otpAttempts >= maxOtpAttempts) {
          throw new Error(`Maximum 3 invalid OTP attempts reached (${otpErrorMessage}).`);
        }
      } else {
        otpSuccess = true;
        log("✓ OTP verified successfully!");
      }
    }

    // Step 5: Dashboard Navigation
    log('[5/8] Navigating to Redis Dashboard (/redis)...');
    setStep(5);
    await delay(3000);

    const redisLink = await page.$('a[href="/redis"], a[href*="redis"]');
    if (redisLink) {
      await redisLink.click();
    } else {
      await page.goto("https://console.upstash.com/redis", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
    }

    // Step 6: Load Hydration Buffer
    log("[6/8] Waiting 15s for Redis dashboard hydration...");
    setStep(6);
    await delay(15000);

    // Step 7: Click Create Database Button
    log('[7/8] Clicking Create Database button (cy-id="redis-header-create")...');
    setStep(7);
    const createHeaderSelector = '[cy-id="redis-header-create"], [data-cy="redis-header-create"], [data-testid="redis-header-create"]';

    let createBtn = await page.$(createHeaderSelector);
    if (!createBtn) {
      const buttons = await page.$$("button");
      for (const btn of buttons) {
        const text = await page.evaluate((el) => el.textContent, btn);
        if (text && text.toLowerCase().includes("create database")) {
          createBtn = btn;
          break;
        }
      }
    }

    if (createBtn) await createBtn.click();

    // Step 8: Ant Design Modal Configuration
    log("[8/8] Handling Ant Design Modal (.ant-modal-content)...");
    setStep(8);
    await page.waitForSelector(".ant-modal-content", { timeout: 25000 });

    log(`[8/8] Entering DB Name (#create-database-modal-name): ${dbName}...`);
    await page.waitForSelector("#create-database-modal-name", { timeout: 15000 });
    await page.click("#create-database-modal-name", { clickCount: 3 });
    await page.type("#create-database-modal-name", dbName, { delay: 40 });

    const region = await page.$("span.ant-select-selection-item");
    if (region) {
      await region.click();
      await delay(1000);
    }

    log("[8/8] Clicking Next Step 1...");
    let n1 = await page.$(".ant-modal-content button.ant-btn-primary");
    if (n1) {
      await n1.click();
      await delay(2500);
    }

    log("[8/8] Clicking Next Step 2...");
    let n2 = await page.$(".ant-modal-content button.ant-btn-primary");
    if (n2) {
      await n2.click();
      await delay(2500);
    }

    log("[8/8] Clicking Final Create Button...");
    let createFinal = await page.$(".ant-modal-content button.ant-btn-primary");
    if (createFinal) {
      await createFinal.click();
    }

    log("Waiting for Upstash to provision database and redirect...");
    let onDetailsPage = false;
    for (let i = 0; i < 15; i++) {
      await delay(2000);
      const url = page.url();
      log(`Checking page URL (${i + 1}/15): ${url}`);
      const isDetails = url.includes('/details') || Boolean(url.match(/\/redis\/[a-f0-9-]{10,}/i));
      if (isDetails) {
        onDetailsPage = true;
        log(`✓ Redirected to database details page: ${url}`);
        break;
      }
    }

    // If still on list page /redis, refresh page and click the dbName link
    if (!onDetailsPage) {
      log("Navigating to Redis dashboard list to locate new database...");
      await page.goto("https://console.upstash.com/redis", { waitUntil: "networkidle2" }).catch(() => {});
      await delay(4000);

      const dbClicked = await page.evaluate((targetDb) => {
        // Find text matching dbName (e.g. redis-db10)
        const allElements = Array.from(document.querySelectorAll('a, tr, div, span, td, h1, h2, h3, h4, h5'));
        const targetEl = allElements.find(el => (el.textContent || '').trim().toLowerCase() === targetDb.toLowerCase());
        
        if (targetEl) {
          const clickable = targetEl.closest('a') || targetEl.closest('tr') || targetEl.closest('div') || targetEl;
          clickable.click();
          return true;
        }
        
        // Fallback to any link containing /details or /redis/<uuid>
        const detailLinks = Array.from(document.querySelectorAll('a[href*="/redis/"]')).filter(a => a.href.includes('/details') || a.href.match(/\/redis\/[a-f0-9-]{10,}/i));
        if (detailLinks.length > 0) {
          detailLinks[0].click();
          return true;
        }
        
        return false;
      }, dbName);

      if (dbClicked) {
        log("Clicked newly created database link. Waiting for details page load...");
        await delay(6000);
      }
    }

    log("Extracting REST String, Token, and Full TCP URL...");
    await delay(3000);

    let extractedUrl = null;
    let extractedPassword = null;
    let extractedRestUrl = null;
    let extractedRestToken = null;

    // Retry extraction loop up to 15 times to ensure complete unmasked TCP string & token are captured
    for (let attempt = 1; attempt <= 15; attempt++) {
      try {
        log(`[Extraction ${attempt}/15] Intercepting clipboard, unmasking DOM & scraping credentials...`);

        // 1. Force unmask password inputs and trigger eye/copy/reveal buttons (including aria-describedby)
        await page.evaluate(() => {
          if (!window.__copiedStrings) window.__copiedStrings = [];

          // Convert all password inputs to text inputs so values are exposed in JS DOM
          document.querySelectorAll('input[type="password"]').forEach(input => {
            try { input.type = 'text'; } catch {}
          });

          // Target elements with aria-describedby, tooltips, or reveal icons
          const ariaElements = Array.from(document.querySelectorAll('[aria-describedby]'));
          ariaElements.forEach(el => {
            try {
              el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
              el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
              el.dispatchEvent(new MouseEvent('focus', { bubbles: true }));
              if (typeof el.click === 'function') el.click();
            } catch {}

            // Check tooltip target element referenced by aria-describedby
            const targetId = el.getAttribute('aria-describedby');
            if (targetId) {
              const tooltipEl = document.getElementById(targetId);
              if (tooltipEl && tooltipEl.textContent) {
                window.__copiedStrings.push(tooltipEl.textContent.trim());
              }
            }
          });

          // Click any eye, show, copy, or reveal toggle buttons
          const allClickables = Array.from(document.querySelectorAll('button, a, div[role="button"], span, svg, i, [aria-describedby]'));
          allClickables.forEach(el => {
            const text = (el.textContent || '').trim().toLowerCase();
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            const title = (el.getAttribute('title') || '').toLowerCase();
            const cls = (el.getAttribute('class') || '').toLowerCase();
            const html = (el.outerHTML || '').toLowerCase();
            const parentText = el.parentElement ? (el.parentElement.textContent || '').toLowerCase() : '';

            const isEyeOrReveal = aria.includes('eye') || aria.includes('show') || aria.includes('reveal') || aria.includes('password') || aria.includes('copy') ||
                                  title.includes('eye') || title.includes('show') || title.includes('reveal') || title.includes('password') || title.includes('copy') ||
                                  cls.includes('eye') || cls.includes('show') || cls.includes('password') || cls.includes('copy') ||
                                  html.includes('tabler-icon-eye') || html.includes('lucide-eye') || html.includes('copy') || text === 'show' ||
                                  parentText.includes('token') || parentText.includes('****');

            if (isEyeOrReveal) {
              try {
                el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                if (typeof el.click === 'function') el.click();
              } catch {}
            }
          });

          // Trigger hover on copy cards and code blocks
          document.querySelectorAll('.style_copyText__OeD19, .group, [class*="group"], pre, code').forEach(el => {
            el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          });

          // Click copy buttons to fill window.__copiedStrings
          allClickables.forEach(btn => {
            const text = (btn.textContent || '').trim().toUpperCase();
            const isCopy = text === 'TCP' || text === 'TOKEN' || text === 'HTTPS' || text === 'READONLY TOKEN' || text.includes('COPY') ||
                           btn.getAttribute('data-testid') === 'copy-info-button' || btn.classList.contains('ant-typography-copy');
            if (isCopy) {
              try {
                if (typeof btn.click === 'function') btn.click();
              } catch {}
            }
          });
        }).catch(() => {});

        await delay(600);

        // 2. Click TCP Tab to ensure TCP code block is rendered
        await page.evaluate(() => {
          const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, div, span, p'));
          const connectHeader = headings.find(el => el.textContent && el.textContent.trim().startsWith('Connect'));
          let container = document.body;
          if (connectHeader) {
            let p = connectHeader;
            for (let i = 0; i < 5; i++) {
              if (p && p.parentElement) {
                p = p.parentElement;
                if (p.querySelector('button, [role="tab"]')) {
                  container = p;
                  break;
                }
              }
            }
          }
          const tabs = Array.from(container.querySelectorAll('button, div, span, a, tab, [data-node-key]'));
          const tcpTab = tabs.find(el => (el.textContent && el.textContent.trim() === 'TCP') || el.getAttribute('data-node-key') === 'TCP');
          if (tcpTab) tcpTab.click();
        }).catch(() => {});

        await delay(600);

        // 3. Scrape full page state, clipboard array, Monaco lines & Next.js data
        const scraped = await page.evaluate(() => {
          const copied = window.__copiedStrings || [];
          const inputs = Array.from(document.querySelectorAll('input, textarea')).map(i => i.value);
          const codeLines = Array.from(document.querySelectorAll('.view-line, code, pre, [data-mprt], span, div')).map(el => el.textContent || '');
          const bodyText = document.body.innerText || '';
          const nextDataEl = document.querySelector('#__NEXT_DATA__');
          const nextDataText = nextDataEl ? nextDataEl.textContent || '' : '';

          const sources = [...copied, ...inputs, ...codeLines, bodyText, nextDataText];

          let tcpUrl = null;
          let pass = null;
          let rUrl = null;
          let rToken = null;

          for (const s of sources) {
            if (!s) continue;

            // Pattern 1: Direct TCP URL (rediss://default:PASSWORD@HOST:6379)
            if (!tcpUrl) {
              const tcpMatch = s.match(/rediss?:\/\/(?:[^:@\s"']+)?(?:[:]([^@\s"']+))?@([a-zA-Z0-9-]+\.upstash\.io):[0-9]+/i);
              if (tcpMatch && tcpMatch[2]) {
                const p = tcpMatch[1];
                if (p && !p.includes('*') && p.length > 5) {
                  tcpUrl = tcpMatch[0];
                  pass = p;
                }
              }
            }

            // Pattern 2: redis-cli command string
            if (!tcpUrl) {
              const cliMatch = s.match(/redis-cli\s+.*?rediss?:\/\/(?:[^:@\s"']+)?(?:[:]([^@\s"']+))?@([a-zA-Z0-9-]+\.upstash\.io):[0-9]+/i);
              if (cliMatch && cliMatch[2]) {
                const p = cliMatch[1];
                if (p && !p.includes('*') && p.length > 5) {
                  tcpUrl = cliMatch[0].match(/rediss?:\/\/[^\s"']+/)[0];
                  pass = p;
                }
              }
            }

            // Pattern 3: REST token variable or JSON key
            if (!rToken) {
              const tokenMatch = s.match(/UPSTASH_REDIS_REST_TOKEN=["']?([^"'\s*]+)["']?/i) ||
                                 s.match(/["']?(?:rest_token|restToken|token|password)["']?\s*[:=]\s*["']([^"'\s]+)["']/i);
              if (tokenMatch && tokenMatch[1] && !tokenMatch[1].includes('*') && tokenMatch[1].length > 10) {
                rToken = tokenMatch[1];
              }
            }

            // Pattern 4: REST URL
            if (!rUrl) {
              const urlMatch = s.match(/UPSTASH_REDIS_REST_URL=["']?(https:\/\/[^"'\s]+)["']?/i) ||
                               s.match(/(https:\/\/[a-zA-Z0-9-]+\.upstash\.io(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*))/i);
              if (urlMatch) {
                rUrl = urlMatch[1] || urlMatch[0];
              }
            }
          }

          // Fallback pattern for raw token strings in copied array or inputs
          if (!rToken) {
            const highPriSources = [...copied, ...inputs];
            for (const s of highPriSources) {
              // Upstash tokens are usually 30+ chars, base64-like (A-Z, a-z, 0-9, -, _)
              const rawMatch = s.match(/^[A-Za-z0-9_-]{30,120}$/);
              if (rawMatch && !rawMatch[0].includes('*')) {
                rToken = rawMatch[0];
                break;
              }
            }
          }
          
          if (!rToken) {
            for (const s of sources) {
              const base64Match = s.match(/\b([A-Za-z0-9_-]{35,120})\b/);
              if (base64Match && !base64Match[1].includes('*') && !base64Match[1].includes('upstash')) {
                rToken = base64Match[1];
                break;
              }
            }
          }

          return { tcpUrl, pass, rUrl, rToken, copiedStrings: window.__copiedStrings };
        });
        
        log(`Extracted copied strings in browser: ${JSON.stringify(scraped.copiedStrings || [])}`);

        // Combine DOM Scraped credentials with Network Intercepted credentials
        if (interceptedPassword) extractedPassword = interceptedPassword;
        if (interceptedRestToken) extractedRestToken = interceptedRestToken;
        if (interceptedRestUrl) extractedRestUrl = interceptedRestUrl;
        if (interceptedEndpoint && !extractedRestUrl) extractedRestUrl = `https://${interceptedEndpoint}`;

        if (scraped.rUrl) extractedRestUrl = scraped.rUrl;
        if (scraped.rToken) extractedRestToken = scraped.rToken;
        if (scraped.pass) extractedPassword = scraped.pass;
        if (scraped.tcpUrl && !scraped.tcpUrl.includes('@:6379')) {
          extractedUrl = scraped.tcpUrl;
        }

        // Reconstruct TCP URL if password and host are found
        if (!extractedUrl && (extractedPassword || extractedRestToken) && extractedRestUrl) {
          const pass = extractedPassword || extractedRestToken;
          const host = extractedRestUrl.replace('https://', '');
          if (pass && pass.length > 5 && !pass.includes('*')) {
            extractedUrl = `rediss://default:${pass}@${host}:6379`;
          }
        }

        // Break early if we have a COMPLETE unmasked TCP URL and Token
        if (extractedUrl && !extractedUrl.includes('default:@') && !extractedUrl.includes('****')) {
          log(`✓ Scraped complete unmasked TCP connection string on attempt ${attempt}!`);
          break;
        }
      } catch (err) {
        log(`Extraction retry ${attempt}: ${err.message}`);
      }
      await delay(2000);
    }

    const finalPassword = extractedPassword || extractedRestToken || "";
    let finalEndpoint = "";
    if (extractedRestUrl) {
      finalEndpoint = extractedRestUrl.replace("https://", "");
    } else if (extractedUrl) {
      const hMatch = extractedUrl.match(/@([^:\/]+)/);
      if (hMatch) finalEndpoint = hMatch[1];
    }
    if (!finalEndpoint) finalEndpoint = `${dbName}.upstash.io`;

    let finalRedisUrl = extractedUrl;
    if (!finalRedisUrl || finalRedisUrl.includes('****') || finalRedisUrl.includes('default:@')) {
      if (finalPassword && finalPassword.length > 5 && !finalPassword.includes('*')) {
        finalRedisUrl = `rediss://default:${finalPassword}@${finalEndpoint}:6379`;
      } else {
        throw new Error(`Failed to extract unmasked TCP password for ${finalEndpoint}. Password was empty or masked. Automation aborted to prevent empty credential save.`);
      }
    }

    const finalRestUrl = extractedRestUrl || `https://${finalEndpoint}`;
    const finalRestToken = extractedRestToken || finalPassword;
    const finalEnvString = `REDIS_URL="${finalRedisUrl}"`;

    const credentialsResult = {
      redisUrl: finalRedisUrl,
      envString: finalEnvString,
      restUrl: finalRestUrl,
      password: finalPassword,
      restToken: finalRestToken,
    };

    log(`✓ AUTOMATION COMPLETE! Copied TCP Redis Link: ${finalRedisUrl}`);
    return credentialsResult;
  } catch (err) {
    if (err.message.includes('Target closed') || err.message.includes('Browser closed') || err.message.includes('stopped by user')) {
      log(`🛑 Provisioning process stopped by user.`);
    } else {
      log(`❌ Automation Error: ${err.message}`);
    }
    throw err;
  } finally {
    if (browser) {
      await delay(12000);
      await browser.close();
    }
  }
}
