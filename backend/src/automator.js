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

    await page.evaluateOnNewDocument(() => {
      window.__copiedStrings = [];
      if (navigator && navigator.clipboard) {
        navigator.clipboard.writeText = async (text) => {
          window.__copiedStrings.push(text);
          return true;
        };
      }
    }).catch(() => { });

    let interceptedPassword = null;
    let interceptedRestToken = null;
    let interceptedRestUrl = null;
    let interceptedEndpoint = null;

    function isValidToken(t) {
      if (!t || typeof t !== "string") return false;
      const s = t.trim();
      if (s.length < 20) return false;
      if (s.includes("*") || s.includes(" ") || s.includes("required") || s.includes("undefined") || s.includes("null") || s.includes("Token")) return false;
      if (s.startsWith("ey")) return false;
      return true;
    }

    page.on("response", async (response) => {
      try {
        const url = response.url();
        const contentType = response.headers()["content-type"] || "";

        if (url.includes("clerk.") || url.includes("/auth/") || url.includes("/api/user")) {
          return;
        }

        if (
          (url.includes("/api/") || url.includes("upstash")) &&
          contentType.includes("application/json")
        ) {
          const text = await response.text();
          if (
            text.includes("password") ||
            text.includes("rest_token") ||
            text.includes("upstash.io") ||
            text.includes("gQAAAAAA")
          ) {
            const tokenMatch = text.match(/"(?:password|rest_token|restToken)"\s*:\s*"([^"]+)"/i);
            if (tokenMatch && tokenMatch[1] && isValidToken(tokenMatch[1])) {
              interceptedPassword = tokenMatch[1];
              interceptedRestToken = tokenMatch[1];
            }

            const endpointMatch = text.match(/"(?:endpoint|host)"\s*:\s*"([^"]+\.upstash\.io)"/i);
            if (endpointMatch && endpointMatch[1]) {
              interceptedEndpoint = endpointMatch[1];
            }

            const urlMatch = text.match(/"(?:rest_url|restUrl|url)"\s*:\s*"(https:\/\/[^"]+\.upstash\.io)"/i);
            if (urlMatch && urlMatch[1]) {
              interceptedRestUrl = urlMatch[1];
            }
          }
        }
      } catch { }
    });

    log("[2/8] Navigating to https://console.upstash.com/auth/sign-up...");
    setStep(2);
    await page.goto("https://console.upstash.com/auth/sign-up", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

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

    log("[4/8] Waiting for OTP verification screen...");
    setStep(4);

    async function findOtpInput() {
      const selectors = [
        "#code",
        'input[name="code"]',
        'input[name="otp"]',
        'input[id="code"]',
        'input[id="otp"]',
        'input[autocomplete="one-time-code"]',
        'input[placeholder*="code" i]',
        'input[placeholder*="otp" i]',
        'input[placeholder*="verification" i]',
        'input[aria-label*="code" i]',
        'input[aria-label*="otp" i]',
        'input[aria-label*="verification" i]'
      ];
      for (const sel of selectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            const isVisible = await page.evaluate(e => {
              const style = window.getComputedStyle(e);
              return style && style.display !== 'none' && style.visibility !== 'hidden' && e.offsetWidth > 0 && e.offsetHeight > 0;
            }, el);
            if (isVisible) return { element: el, selector: sel };
          }
        } catch { }
      }
      return null;
    }

    let otpTarget = null;
    const startTime = Date.now();
    while (Date.now() - startTime < 45000) {
      otpTarget = await findOtpInput();
      if (otpTarget) break;
      const curUrl = page.url();
      if (!curUrl.includes('/auth/sign-up') && !curUrl.includes('/auth/verify') && !curUrl.includes('/auth/otp') && !curUrl.includes('/sign-up')) {
        log("[4/8] Navigated past signup/auth screen. Proceeding...");
        break;
      }
      await delay(1000);
    }

    const initialCheckUrl = page.url();
    const isOnAuthScreen = initialCheckUrl.includes('/auth/sign-up') || initialCheckUrl.includes('/auth/verify') || initialCheckUrl.includes('/auth/otp') || initialCheckUrl.includes('/sign-up') || initialCheckUrl.includes('/verify');

    if (otpTarget || isOnAuthScreen) {
      if (otpTarget) {
        log(`[4/8] OTP input field detected using selector: ${otpTarget.selector}`);
      } else {
        log("[4/8] On verification screen. Ready for OTP entry...");
      }

      let otpAttempts = 0;
      const maxOtpAttempts = 3;
      let otpSuccess = false;
      let otpErrorMessage = null;

      while (otpAttempts < maxOtpAttempts && !otpSuccess) {
        otpAttempts++;
        if (otpAttempts > 1) {
          log(`[ERROR] Invalid OTP code entered. Requesting OTP retry (Attempt ${otpAttempts}/${maxOtpAttempts})...`);
        } else {
          log("[ACTION REQUIRED] Please enter 6-digit OTP code.");
        }

        const otpCode = await onOtpRequired({
          attempt: otpAttempts,
          maxAttempts: maxOtpAttempts,
          error: otpErrorMessage,
        });

        if (!otpCode) {
          throw new Error("OTP input was empty or cancelled.");
        }

        log(`[4/8] Injecting OTP code (${otpCode}) into verification input (Attempt ${otpAttempts}/${maxOtpAttempts})...`);

        let currentInputTarget = await findOtpInput();
        if (currentInputTarget && currentInputTarget.element) {
          await currentInputTarget.element.click({ clickCount: 3 }).catch(() => { });
          await page.keyboard.press("Backspace").catch(() => { });
          await currentInputTarget.element.type(String(otpCode).trim(), { delay: 50 });
          await page.evaluate(el => {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }, currentInputTarget.element).catch(() => { });
        } else {
          await page.keyboard.type(String(otpCode).trim(), { delay: 50 });
        }

        const otpSubmitBtn = await page.evaluateHandle(() => {
          const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
          return btns.find(b => {
            const txt = (b.textContent || b.value || '').toLowerCase().trim();
            const type = (b.getAttribute('type') || '').toLowerCase();
            return type === 'submit' || txt.includes('verify') || txt.includes('confirm') || txt.includes('continue') || txt.includes('submit');
          }) || null;
        });

        if (otpSubmitBtn && otpSubmitBtn.asElement()) {
          await otpSubmitBtn.asElement().click().catch(() => { });
        }
        await page.keyboard.press("Enter").catch(() => { });
        log("[4/8] OTP submitted. Verifying...");

        let verifiedOk = false;
        for (let poll = 0; poll < 6; poll++) {
          await delay(2000);
          const currentUrl = page.url();
          const inputStillExists = await findOtpInput();
          const isPastAuth = !currentUrl.includes('/auth/sign-up') &&
            !currentUrl.includes('/auth/verify') &&
            !currentUrl.includes('/auth/otp') &&
            !currentUrl.includes('/sign-up') &&
            !currentUrl.includes('/verify');

          if (!inputStillExists || isPastAuth) {
            verifiedOk = true;
            break;
          }
        }

        if (verifiedOk) {
          otpSuccess = true;
          log("[SUCCESS] OTP verified successfully!");
          break;
        }

        const explicitError = await page.evaluate(() => {
          const bodyText = (document.body.innerText || '').toLowerCase();
          if (bodyText.includes('invalid code') || bodyText.includes('incorrect code') || bodyText.includes('code expired') || bodyText.includes('invalid verification') || bodyText.includes('wrong code')) {
            return "Invalid verification code.";
          }
          const errEl = document.querySelector('.ant-form-item-has-error, .text-red-500, [role="alert"]');
          if (errEl) {
            const txt = (errEl.innerText || '').trim();
            if (txt && txt.length > 3) return txt;
          }
          return null;
        });

        if (explicitError) {
          otpErrorMessage = explicitError;
          log(`[ERROR] Invalid OTP Code: "${otpErrorMessage}" (Attempt ${otpAttempts}/${maxOtpAttempts})`);
          if (otpAttempts >= maxOtpAttempts) {
            throw new Error(`Maximum ${maxOtpAttempts} invalid OTP attempts reached (${otpErrorMessage}).`);
          }
        } else {
          otpErrorMessage = "Verification code was not accepted. Please try again.";
          log(`[WARN] OTP Verification pending or rejected (Attempt ${otpAttempts}/${maxOtpAttempts})`);
          if (otpAttempts >= maxOtpAttempts) {
            throw new Error(`Maximum ${maxOtpAttempts} invalid OTP attempts reached.`);
          }
        }
      }
    }

    log('[5/8] Navigating to Redis Dashboard (/redis)...');
    setStep(5);
    await delay(3000);

    const redisLink = await page.$('a[href="/redis"], a[href*="redis"]');
    if (redisLink) {
      await redisLink.click().catch(() => { });
    } else {
      await page.goto("https://console.upstash.com/redis", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      }).catch(() => { });
    }

    log("[6/8] Waiting 10s for Redis dashboard hydration...");
    setStep(6);
    await delay(10000);

    log('[7/8] Clicking Create Database button...');
    setStep(7);

    let createBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
      return btns.find(b => {
        const text = (b.textContent || '').toLowerCase().trim();
        const cy = (b.getAttribute('cy-id') || b.getAttribute('data-cy') || b.getAttribute('data-testid') || '').toLowerCase();
        return cy.includes('create') || text.includes('create database') || text === 'create';
      }) || null;
    });

    if (createBtn && createBtn.asElement()) {
      await createBtn.asElement().click().catch(() => { });
    }

    log("[8/8] Handling Create Database Modal...");
    setStep(8);
    await delay(2000);

    const nameInputSelector = '#create-database-modal-name, input[name="name"], input[placeholder*="database name" i], input[placeholder*="Name" i], .ant-modal-content input';
    const nameInput = await page.waitForSelector(nameInputSelector, { timeout: 25000 }).catch(() => null);

    if (nameInput) {
      log(`[8/8] Entering DB Name: ${dbName}...`);
      await nameInput.click({ clickCount: 3 }).catch(() => { });
      await nameInput.type(dbName, { delay: 40 }).catch(() => { });
    }

    await delay(1000);

    log("[8/8] Clicking Submit / Create in modal...");
    const submitModalBtn = await page.evaluateHandle(() => {
      const modal = document.querySelector('.ant-modal-content, [role="dialog"], div[class*="modal"]');
      const root = modal || document.body;
      const buttons = Array.from(root.querySelectorAll('button'));
      return buttons.find(b => {
        const text = (b.textContent || '').toLowerCase().trim();
        return text.includes('create') || text.includes('submit') || b.classList.contains('ant-btn-primary');
      }) || null;
    });

    if (submitModalBtn && submitModalBtn.asElement()) {
      await submitModalBtn.asElement().click().catch(() => { });
    } else {
      await page.keyboard.press("Enter").catch(() => { });
    }

    await delay(2500);
    const secondStepBtn = await page.evaluateHandle(() => {
      const modal = document.querySelector('.ant-modal-content, [role="dialog"], div[class*="modal"]');
      if (!modal) return null;
      const buttons = Array.from(modal.querySelectorAll('button'));
      return buttons.find(b => {
        const text = (b.textContent || '').toLowerCase().trim();
        return text.includes('create') || text.includes('next') || b.classList.contains('ant-btn-primary');
      }) || null;
    });
    if (secondStepBtn && secondStepBtn.asElement()) {
      log("[8/8] Confirming database creation step...");
      await secondStepBtn.asElement().click().catch(() => { });
    }

    log("Waiting for Upstash to provision database and redirect...");
    let onDetailsPage = false;
    for (let i = 0; i < 15; i++) {
      await delay(2000);
      const url = page.url();
      log(`Checking page URL (${i + 1}/15): ${url}`);
      try {
        const parsedUrl = new URL(url);
        const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 2 && pathParts[0] === 'redis') {
          onDetailsPage = true;
          log(`[SUCCESS] Redirected to database details page: ${url}`);
          break;
        }
      } catch { }
    }

    if (!onDetailsPage) {
      log("Navigating to Redis dashboard list to locate database...");
      await page.goto("https://console.upstash.com/redis", { waitUntil: "domcontentloaded" }).catch(() => { });
      await delay(4000);

      const dbClicked = await page.evaluate((targetDb) => {
        const allNodes = Array.from(document.querySelectorAll('a, tr, td, div, span, h1, h2, h3, h4, h5'));
        const textMatch = allNodes.find(node => {
          const t = (node.textContent || '').trim().toLowerCase();
          return t === targetDb.toLowerCase() || t.includes(targetDb.toLowerCase());
        });

        if (textMatch) {
          const clickable = textMatch.closest('a') || textMatch.closest('tr') || textMatch.closest('div[role="button"]') || textMatch;
          try { clickable.click(); return true; } catch {}
        }

        const redisLinks = Array.from(document.querySelectorAll('a')).filter(a => {
          const h = a.getAttribute('href') || '';
          return h.includes('/redis/') && h !== '/redis' && h !== '/redis/';
        });

        if (redisLinks.length > 0) {
          try { redisLinks[0].click(); return true; } catch {}
        }

        return false;
      }, dbName);

      if (dbClicked) {
        log("Clicked database link. Waiting for details page load...");
        await delay(6000);
      }
    }

    log("Extracting REST String, Token, and Full TCP URL...");
    await delay(3000);

    let extractedUrl = null;
    let extractedPassword = null;
    let extractedRestUrl = null;
    let extractedRestToken = null;

    for (let attempt = 1; attempt <= 15; attempt++) {
      try {
        log(`[Extraction ${attempt}/15] Intercepting clipboard, unmasking DOM & scraping credentials...`);

        await page.evaluate(() => {
          if (!window.__copiedStrings) window.__copiedStrings = [];

          document.querySelectorAll('input[type="password"]').forEach(input => {
            try { input.type = 'text'; } catch { }
          });

          const clickables = Array.from(document.querySelectorAll('button, div[role="button"], span, svg, i, a'));
          clickables.forEach(el => {
            const text = (el.textContent || '').trim().toLowerCase();
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            const title = (el.getAttribute('title') || '').toLowerCase();
            const cls = (el.getAttribute('class') || '').toLowerCase();
            const html = (el.outerHTML || '').toLowerCase();

            const isRevealOrCopy = aria.includes('eye') || aria.includes('show') || aria.includes('reveal') || aria.includes('password') || aria.includes('copy') ||
                                   title.includes('eye') || title.includes('show') || title.includes('reveal') || title.includes('password') || title.includes('copy') ||
                                   cls.includes('eye') || cls.includes('show') || cls.includes('copy') || html.includes('eye') || html.includes('copy') ||
                                   text === 'show' || text === 'copy' || text === 'tcp' || text === 'token' || text === 'https';

            if (isRevealOrCopy) {
              try {
                if (typeof el.click === 'function') el.click();
              } catch { }
            }
          });
        }).catch(() => { });

        await delay(800);

        await page.evaluate(() => {
          const tabs = Array.from(document.querySelectorAll('button, div[role="tab"], span, a, [data-node-key]'));
          tabs.forEach(tab => {
            const txt = (tab.textContent || '').trim().toLowerCase();
            if (txt === 'tcp' || txt === 'redis-cli' || txt === '.env' || txt.includes('node') || txt.includes('ioredis') || txt.includes('curl')) {
              try { tab.click(); } catch {}
            }
          });
        }).catch(() => { });

        await delay(800);

        const scraped = await page.evaluate(() => {
          const copied = window.__copiedStrings || [];
          const inputs = Array.from(document.querySelectorAll('input, textarea')).map(i => i.value);
          const codeLines = Array.from(document.querySelectorAll('.view-line, code, pre, [data-mprt], span, div, p, td')).map(el => el.textContent || '');
          const bodyText = document.body.innerText || '';
          const nextDataEl = document.querySelector('#__NEXT_DATA__');
          const nextDataText = nextDataEl ? nextDataEl.textContent || '' : '';

          const sources = [...copied, ...inputs, ...codeLines, bodyText, nextDataText];

          let tcpUrl = null;
          let pass = null;
          let rUrl = null;
          let rToken = null;

          function isGoodToken(t) {
            if (!t || typeof t !== 'string') return false;
            const s = t.trim();
            if (s.length < 20) return false;
            if (s.includes('*') || s.includes(' ') || s.includes('required') || s.includes('undefined') || s.includes('null') || s.includes('Token')) return false;
            if (s.startsWith('ey')) return false;
            return true;
          }

          for (const s of sources) {
            if (!s || typeof s !== 'string') continue;

            if (!tcpUrl) {
              const tcpMatch = s.match(/rediss?:\/\/(?:[^:@\s"']+)?(?:[:]([^@\s"']+))?@([a-zA-Z0-9-]+\.upstash\.io):[0-9]+/i);
              if (tcpMatch && tcpMatch[2]) {
                const p = tcpMatch[1];
                if (isGoodToken(p)) {
                  tcpUrl = tcpMatch[0];
                  pass = p;
                }
              }
            }

            if (!tcpUrl) {
              const cliMatch = s.match(/redis-cli\s+.*?rediss?:\/\/(?:[^:@\s"']+)?(?:[:]([^@\s"']+))?@([a-zA-Z0-9-]+\.upstash\.io):[0-9]+/i);
              if (cliMatch && cliMatch[2]) {
                const p = cliMatch[1];
                if (isGoodToken(p)) {
                  const urlOnly = cliMatch[0].match(/rediss?:\/\/[^\s"']+/);
                  if (urlOnly) {
                    tcpUrl = urlOnly[0];
                    pass = p;
                  }
                }
              }
            }

            if (!rToken) {
              const tokenMatch = s.match(/UPSTASH_REDIS_REST_TOKEN=["']?([^"'\s*]+)["']?/i) ||
                                 s.match(/["']?(?:rest_token|restToken)["']?\s*[:=]\s*["']([^"'\s]+)["']/i);
              if (tokenMatch && isGoodToken(tokenMatch[1])) {
                rToken = tokenMatch[1];
              }
            }

            if (!rUrl) {
              const urlMatch = s.match(/UPSTASH_REDIS_REST_URL=["']?(https:\/\/[^"'\s]+)["']?/i) ||
                               s.match(/(https:\/\/[a-zA-Z0-9-]+\.upstash\.io)/i);
              if (urlMatch) {
                rUrl = urlMatch[1] || urlMatch[0];
              }
            }
          }

          if (!rToken) {
            const candidates = [...copied, ...inputs];
            for (const c of candidates) {
              if (typeof c !== 'string') continue;
              const trimC = c.trim();
              if (isGoodToken(trimC) && !trimC.includes('upstash')) {
                rToken = trimC;
                break;
              }
            }
          }

          return { tcpUrl, pass, rUrl, rToken, copiedStrings: window.__copiedStrings };
        });

        if (interceptedPassword && isValidToken(interceptedPassword)) extractedPassword = interceptedPassword;
        if (interceptedRestToken && isValidToken(interceptedRestToken)) extractedRestToken = interceptedRestToken;
        if (interceptedRestUrl) extractedRestUrl = interceptedRestUrl;
        if (interceptedEndpoint && !extractedRestUrl) extractedRestUrl = `https://${interceptedEndpoint}`;

        if (scraped.rUrl) extractedRestUrl = scraped.rUrl;
        if (scraped.rToken && isValidToken(scraped.rToken)) extractedRestToken = scraped.rToken;
        if (scraped.pass && isValidToken(scraped.pass)) extractedPassword = scraped.pass;
        if (scraped.tcpUrl && !scraped.tcpUrl.includes('@:6379') && !scraped.tcpUrl.includes('default:@') && !scraped.tcpUrl.includes('default:required')) {
          extractedUrl = scraped.tcpUrl;
        }

        const token = extractedPassword || extractedRestToken;
        if ((!extractedUrl || extractedUrl.includes('default:@') || extractedUrl.includes('default:required')) && isValidToken(token) && extractedRestUrl) {
          const host = extractedRestUrl.replace('https://', '').trim();
          extractedUrl = `rediss://default:${token}@${host}:6379`;
        }

        if (extractedUrl && !extractedUrl.includes('default:@') && !extractedUrl.includes('default:required') && !extractedUrl.includes('****')) {
          log(`[SUCCESS] Scraped complete unmasked TCP connection string on attempt ${attempt}!`);
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
    if (!finalRedisUrl || finalRedisUrl.includes('****') || finalRedisUrl.includes('default:@') || finalRedisUrl.includes('default:required')) {
      if (isValidToken(finalPassword)) {
        finalRedisUrl = `rediss://default:${finalPassword}@${finalEndpoint}:6379`;
      } else {
        throw new Error(`Failed to extract unmasked TCP password for ${finalEndpoint}. Password was empty, placeholder, or masked. Automation aborted to prevent invalid credential save.`);
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

    log(`[SUCCESS] AUTOMATION COMPLETE! Copied TCP Redis Link: ${finalRedisUrl}`);
    return credentialsResult;
  } catch (err) {
    if (err.message.includes('Target closed') || err.message.includes('Browser closed') || err.message.includes('stopped by user')) {
      log(`Provisioning process stopped by user.`);
    } else {
      log(`Automation Error: ${err.message}`);
    }
    throw err;
  } finally {
    if (browser) {
      await delay(12000);
      await browser.close().catch(() => { });
    }
  }
}
