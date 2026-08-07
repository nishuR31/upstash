import puppeteer from "puppeteer";
import fs from "fs";
import os from "os";
import path from "path";
import { addCopiedString, addInterceptedUrl, setTaskStep } from "./services/automationService.js";

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
    setTaskStep(num);
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
      window.__interceptedCreds = {};

      // Intercept clipboard
      if (navigator && navigator.clipboard) {
        navigator.clipboard.writeText = async (text) => {
          window.__copiedStrings.push(text);
          return true;
        };
      }

      function isRedisUrl(u) {
        if (!u || typeof u !== 'string') return false;
        const l = u.toLowerCase();
        if (l.includes('qstash') || l.includes('vector') || l.includes('workflow') || l.includes('box') || l.includes('ratelimit') || l.includes('realtime') || l.includes('clerk') || l.includes('/auth/')) return false;
        return l.includes('upstash') || l.includes('redis') || l.includes('/api/');
      }

      // Intercept fetch to capture Upstash API responses with real credentials
      const _origFetch = window.fetch;
      window.fetch = async function (...args) {
        const resp = await _origFetch.apply(this, args);
        try {
          const url = (args[0] && typeof args[0] === 'string') ? args[0] : (args[0] && args[0].url) ? args[0].url : '';
          if (isRedisUrl(url)) {
            const clone = resp.clone();
            clone.text().then(text => {
              if (!text || typeof text !== 'string') return;

              // 1. Try JSON scan
              try {
                const data = JSON.parse(text);
                function scanObj(obj) {
                  if (!obj || typeof obj !== 'object') return;
                  for (const [k, v] of Object.entries(obj)) {
                    const kl = k.toLowerCase();
                    if (typeof v === 'string') {
                      if ((kl === 'id' || kl === 'database_id' || kl === 'databaseid' || kl === 'db_id' || kl === 'dbid') && v.length >= 8 && !v.includes(' ') && !v.includes('http')) {
                        window.__interceptedCreds.dbId = v;
                      }
                      if (v.length > 20 && !v.includes('*') && !v.includes(' ')) {
                        if (kl.includes('password') || kl === 'token' || kl.includes('rest_token') || kl.includes('resttoken')) {
                          window.__interceptedCreds.password = v;
                        }
                        if (kl.includes('endpoint') || kl.includes('host')) {
                          if (v.includes('.upstash.io')) window.__interceptedCreds.endpoint = v.replace('https://', '').split(':')[0].split('/')[0];
                        }
                        if ((kl.includes('rest_url') || kl.includes('resturl') || kl === 'url') && v.includes('upstash.io')) {
                          window.__interceptedCreds.restUrl = v;
                        }
                      }
                    }
                    if (typeof v === 'object') scanObj(v);
                  }
                }
                scanObj(data);
              } catch { }

              // 2. Direct string regex scan (works on Next.js RSC Flight streams & text)
              const idMatch = text.match(/\/redis\/([a-zA-Z0-9_-]{8,})/) || text.match(/"id"\s*:\s*"([a-zA-Z0-9_-]{8,})"/);
              if (idMatch && idMatch[1] && !idMatch[1].includes('detail')) {
                window.__interceptedCreds.dbId = idMatch[1];
              }

              const endMatch = text.match(/([a-zA-Z0-9-]+\.upstash\.io)/);
              if (endMatch && endMatch[1]) {
                window.__interceptedCreds.endpoint = endMatch[1];
              }

              const passMatch = text.match(/"(?:password|token|rest_token|secret)"\s*:\s*"([A-Za-z0-9+/=_-]{20,})"/i) ||
                text.match(/(gQAAAA[A-Za-z0-9+/=_-]{20,})/);
              if (passMatch && passMatch[1]) {
                window.__interceptedCreds.password = passMatch[1];
              }

              const restMatch = text.match(/(https:\/\/[a-zA-Z0-9-]+\.upstash\.io)/);
              if (restMatch && restMatch[1]) {
                window.__interceptedCreds.restUrl = restMatch[1];
              }
            }).catch(() => { });
          }
        } catch { }
        return resp;
      };

      // Intercept XHR as well
      const _origOpen = XMLHttpRequest.prototype.open;
      const _origSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (method, url) {
        this.__url = url;
        return _origOpen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function () {
        this.addEventListener('load', function () {
          try {
            const url = this.__url || '';
            if (isRedisUrl(url)) {
              const text = this.responseText;
              if (text && typeof text === 'string') {
                try {
                  const data = JSON.parse(text);
                  function scanObj(obj) {
                    if (!obj || typeof obj !== 'object') return;
                    for (const [k, v] of Object.entries(obj)) {
                      const kl = k.toLowerCase();
                      if (typeof v === 'string') {
                        if ((kl === 'id' || kl === 'database_id' || kl === 'databaseid' || kl === 'db_id' || kl === 'dbid') && v.length >= 8 && !v.includes(' ') && !v.includes('http')) {
                          window.__interceptedCreds.dbId = v;
                        }
                        if (v.length > 20 && !v.includes('*') && !v.includes(' ')) {
                          if (kl.includes('password') || kl === 'token' || kl.includes('rest_token') || kl.includes('resttoken')) {
                            window.__interceptedCreds.password = v;
                          }
                          if (kl.includes('endpoint') || kl.includes('host')) {
                            if (v.includes('.upstash.io')) window.__interceptedCreds.endpoint = v.replace('https://', '').split(':')[0].split('/')[0];
                          }
                          if ((kl.includes('rest_url') || kl.includes('resturl') || kl === 'url') && v.includes('upstash.io')) {
                            window.__interceptedCreds.restUrl = v;
                          }
                        }
                      }
                      if (typeof v === 'object') scanObj(v);
                    }
                  }
                  scanObj(data);
                } catch { }

                const idMatch = text.match(/\/redis\/([a-zA-Z0-9_-]{8,})/) || text.match(/"id"\s*:\s*"([a-zA-Z0-9_-]{8,})"/);
                if (idMatch && idMatch[1] && !idMatch[1].includes('detail')) {
                  window.__interceptedCreds.dbId = idMatch[1];
                }

                const endMatch = text.match(/([a-zA-Z0-9-]+\.upstash\.io)/);
                if (endMatch && endMatch[1]) {
                  window.__interceptedCreds.endpoint = endMatch[1];
                }

                const passMatch = text.match(/"(?:password|token|rest_token|secret)"\s*:\s*"([A-Za-z0-9+/=_-]{20,})"/i) ||
                  text.match(/(gQAAAA[A-Za-z0-9+/=_-]{20,})/);
                if (passMatch && passMatch[1]) {
                  window.__interceptedCreds.password = passMatch[1];
                }
              }
            }
          } catch { }
        });
        return _origSend.apply(this, arguments);
      };
    }).catch(() => { });

    let interceptedPassword = null;
    let interceptedRestToken = null;
    let interceptedRestUrl = null;
    let interceptedEndpoint = null;
    let interceptedDbId = null;

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
        const status = response.status();

        // Skip non-API resources & telemetry
        if (url.includes("/_next/") || url.match(/\.(js|css|png|jpg|svg|woff|ico)(\?|$)/)) return;
        if (url.includes("clerk.") || url.includes("/api/user")) return;
        if (url.includes("analytics.google.com") || url.includes("google-analytics.com") || url.includes("googletagmanager.com") || url.includes("google.com/measurement")) return;

        // Log ALL API/upstash response URLs for debugging
        if (url.includes("/api/") || url.includes("upstash.io") || url.includes("console.upstash.com")) {
          log(`[API Response] ${status} ${url.substring(0, 150)}`);
          addInterceptedUrl({ status, url, timestamp: new Date().toLocaleTimeString() });
        }

        // Parse response text (handles standard JSON as well as Next.js _rsc stream payloads)
        let text = "";
        try { text = await response.text(); } catch { return; }
        if (!text || text.length < 5) return;

        // Extract database UUID from path patterns in Next.js RSC streams or JSON
        const uuidMatch = text.match(/\/redis\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|[a-zA-Z0-9_-]{12,})/i) ||
                          text.match(/"(?:id|db_id|database_id|databaseId)"\s*:\s*"([a-f0-9-]{32,36}|[a-zA-Z0-9_-]{12,})"/i);
        if (uuidMatch && uuidMatch[1]) {
          const foundId = uuidMatch[1];
          if (foundId !== "details" && foundId !== "create" && foundId !== "settings") {
            interceptedDbId = foundId;
            log(`[API Intercept] Database UUID captured from stream: ${interceptedDbId}`);
          }
        }

        // Credentials regex scan on raw stream text
        const tokenMatch = text.match(/"(?:password|rest_token|restToken|token)"\s*:\s*"([^"]{20,})"/i);
        if (tokenMatch && isValidToken(tokenMatch[1])) {
          interceptedPassword = tokenMatch[1];
          interceptedRestToken = tokenMatch[1];
          log(`[API Intercept] Password/Token captured from stream: len=${tokenMatch[1].length}`);
        }
        const endpointMatch = text.match(/"(?:endpoint|host)"\s*:\s*"([^"]+\.upstash\.io)"/i);
        if (endpointMatch) interceptedEndpoint = endpointMatch[1].replace(/^https?:\/\//, '').split(':')[0];

        const restUrlMatch = text.match(/"(?:rest_url|restUrl|url)"\s*:\s*"(https:\/\/[^"]+\.upstash\.io[^"]*)"/i);
        if (restUrlMatch) interceptedRestUrl = restUrlMatch[1];

        // Try to parse JSON for structured scan
        if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
          try {
            const json = JSON.parse(text);
            scanJson(json);
          } catch {}
        }

        // Deep scan the parsed JSON
        function scanJson(obj) {
          if (!obj || typeof obj !== "object") return;
          for (const [k, v] of Object.entries(obj)) {
            const kl = k.toLowerCase();
            if (typeof v === "string" && v.length > 5) {
              // Credentials
              if ((kl.includes("password") || kl.includes("rest_token") || kl.includes("resttoken") || kl === "token") && isValidToken(v)) {
                if (!interceptedPassword) { interceptedPassword = v; log(`[API] password captured len=${v.length} from key="${k}"`); }
                if (!interceptedRestToken) interceptedRestToken = v;
              }
              // Endpoint/host
              if ((kl.includes("endpoint") || kl.includes("host") || kl.includes("url")) && v.includes("upstash.io")) {
                const cleanHost = v.replace(/^https?:\/\//, "").split(":")[0].split("/")[0];
                if (cleanHost.includes(".upstash.io")) {
                  if (!interceptedEndpoint) { interceptedEndpoint = cleanHost; log(`[API] endpoint captured: ${cleanHost} from key="${k}"`); }
                  if (kl.includes("url") && v.startsWith("http") && !interceptedRestUrl) interceptedRestUrl = v;
                }
              }
              // DB id
              if ((kl === "id" || kl === "db_id" || kl === "database_id") && /^[a-zA-Z0-9_-]{8,}$/.test(v) && !interceptedDbId) {
                interceptedDbId = v;
                log(`[API] DB id captured: ${v} from key="${k}" url=${url.substring(0, 80)}`);
              }
            }
            if (typeof v === "object") scanJson(v);
          }
        }
        scanJson(json);
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

        const cleanOtpCode = String(otpCode).trim();
        log(`[4/8] Injecting OTP code (${cleanOtpCode}) into verification input (Attempt ${otpAttempts}/${maxOtpAttempts})...`);

        const otpDigits = cleanOtpCode.split("");

        // 1. In-page OTP filling (handles 6-slot inputs, paste events, & React synthetic events)
        try {
          await page.evaluate((code, digits) => {
            const inputs = Array.from(document.querySelectorAll('input')).filter(el => {
              const style = window.getComputedStyle(el);
              return style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
            });

            if (inputs.length === 0) return;

            // If multiple input boxes (e.g. 6 separate digit slots)
            if (inputs.length >= digits.length) {
              digits.forEach((digit, idx) => {
                const inp = inputs[idx];
                inp.focus();
                inp.value = digit;
                inp.dispatchEvent(new Event('input', { bubbles: true }));
                inp.dispatchEvent(new Event('change', { bubbles: true }));
                inp.dispatchEvent(new KeyboardEvent('keydown', { key: digit, bubbles: true }));
                inp.dispatchEvent(new KeyboardEvent('keyup', { key: digit, bubbles: true }));
              });
            } else {
              // Single input box
              const first = inputs[0];
              first.focus();
              first.value = code;
              first.dispatchEvent(new Event('input', { bubbles: true }));
              first.dispatchEvent(new Event('change', { bubbles: true }));

              try {
                const dataTransfer = new DataTransfer();
                dataTransfer.setData('text/plain', code);
                const pasteEvent = new ClipboardEvent('paste', {
                  clipboardData: dataTransfer,
                  bubbles: true,
                  cancelable: true
                });
                first.dispatchEvent(pasteEvent);
              } catch { }
            }
          }, cleanOtpCode, otpDigits);
        } catch (evalErr) {
          log(`[4/8] In-page OTP fill warning: ${evalErr.message}`);
        }

        // 2. Puppeteer native typing per digit as fallback
        try {
          const currentInputTarget = await findOtpInput();
          if (currentInputTarget && currentInputTarget.element) {
            await currentInputTarget.element.click().catch(() => { });
            await currentInputTarget.element.click({ clickCount: 3 }).catch(() => { });
            await page.keyboard.press("Backspace").catch(() => { });
          }
        } catch (targetErr) {
          log(`[4/8] Input focus warning: ${targetErr.message}`);
        }

        for (const digit of otpDigits) {
          await page.keyboard.press(digit).catch(() => { });
          await delay(30);
        }

        await delay(500);

        try {
          const otpSubmitBtn = await page.evaluateHandle(() => {
            const btns = Array.from(document.querySelectorAll('button, input[type="submit"]'));
            return btns.find(b => {
              const txt = (b.textContent || b.value || '').toLowerCase().trim();
              const type = (b.getAttribute('type') || '').toLowerCase();
              return type === 'submit' || txt.includes('verify') || txt.includes('confirm') || txt.includes('continue') || txt.includes('submit');
            }) || null;
          }).catch(() => null);

          if (otpSubmitBtn && otpSubmitBtn.asElement()) {
            await otpSubmitBtn.asElement().click().catch(() => { });
          }
        } catch { }
        await page.keyboard.press("Enter").catch(() => { });
        log("[4/8] OTP submitted. Verifying...");

        let verifiedOk = false;
        for (let poll = 0; poll < 12; poll++) {
          await delay(1500);
          let currentUrl = "";
          try { currentUrl = page.url(); } catch { }
          let inputStillExists = null;
          try { inputStillExists = await findOtpInput(); } catch { }
          const isPastAuth = !currentUrl.includes('/auth/sign-up') &&
            !currentUrl.includes('/auth/verify') &&
            !currentUrl.includes('/auth/otp') &&
            !currentUrl.includes('/sign-up') &&
            !currentUrl.includes('/verify');

          let explicitErr = null;
          try {
            explicitErr = await page.evaluate(() => {
              const bodyText = (document.body.innerText || '').toLowerCase();
              if (bodyText.includes('invalid code') || bodyText.includes('incorrect code') || bodyText.includes('code expired') || bodyText.includes('invalid verification') || bodyText.includes('wrong code')) {
                return "Invalid verification code.";
              }
              return null;
            });
          } catch { }

          if (explicitErr) {
            otpErrorMessage = explicitErr;
            break;
          }

          if (!inputStillExists || isPastAuth || currentUrl.includes('/redis')) {
            verifiedOk = true;
            break;
          }
        }

        if (verifiedOk) {
          otpSuccess = true;
          log("[SUCCESS] OTP verified successfully!");
          break;
        }

        let explicitError = null;
        try {
          explicitError = await page.evaluate(() => {
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
        } catch { }

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

    const nameInputSelector = '#create-database-modal-name, input[name="name"], input[placeholder*="database name" i], input[placeholder*="Name" i], .ant-modal-content input, [role="dialog"] input';
    const nameInput = await page.waitForSelector(nameInputSelector, { timeout: 25000 }).catch(() => null);

    if (nameInput) {
      log(`[8/8] Entering DB Name: ${dbName}...`);
      await nameInput.click({ clickCount: 3 }).catch(() => { });
      await nameInput.type(dbName, { delay: 40 }).catch(() => { });
    }

    await delay(1000);

    // Select Primary Region
    log("[8/8] Selecting Primary Region...");

    try {
      // 1. Try to open the region combobox/dropdown
      const comboboxClicked = await page.evaluate(() => {
        const modal = document.querySelector('.ant-modal-content, [role="dialog"], div[class*="modal"]') || document.body;

        // Find elements with text matching 'Primary Region' or 'Region'
        const allElements = Array.from(modal.querySelectorAll('*'));
        const labels = allElements.filter(el => {
          const t = (el.textContent || '').trim().toLowerCase();
          return t === 'primary region' || t === 'region' || t.startsWith('primary region');
        });

        let combo = null;

        for (const label of labels) {
          // Walk up parent nodes to find combobox or select trigger
          let parent = label.parentElement;
          for (let depth = 0; depth < 5 && parent; depth++) {
            combo = parent.querySelector('[role="combobox"], .ant-select, button[aria-haspopup], select, input[role="combobox"], div[class*="select"]');
            if (combo) break;
            parent = parent.parentElement;
          }
          if (combo) break;
        }

        // Fallback: search for any combobox inside modal
        if (!combo) {
          combo = modal.querySelector('[role="combobox"], .ant-select, button[aria-haspopup="listbox"], button[aria-haspopup="dialog"], button[aria-expanded]');
        }

        if (combo) {
          combo.click();
          return true;
        }
        return false;
      }).catch(() => false);

      if (comboboxClicked) {
        log("[8/8] Region combobox opened, selecting region option...");
        await delay(800);

        // 2. Click preferred region option (Virginia / us-east / first option)
        const optionPicked = await page.evaluate(() => {
          const options = Array.from(document.querySelectorAll('[role="option"], .ant-select-item-option, [class*="option"], li[role="option"]'));
          const target = options.find(o => {
            const t = (o.textContent || '').toLowerCase();
            return t.includes('virginia') || t.includes('us-east') || t.includes('aws');
          }) || options[0];

          if (target) {
            target.click();
            return target.textContent.trim();
          }
          return null;
        }).catch(() => null);

        if (optionPicked) {
          log(`[8/8] Selected Primary Region option: "${optionPicked}"`);
        } else {
          log("[8/8] Dropdown option not found by selector, using keyboard selection...");
          await page.keyboard.press("ArrowDown").catch(() => { });
          await delay(200);
          await page.keyboard.press("Enter").catch(() => { });
        }
      } else {
        log("[8/8] Primary Region combobox not explicitly found; checking if default region is pre-selected...");
      }
    } catch (regionErr) {
      log(`[8/8] Notice during region selection: ${regionErr.message}`);
    }

    await delay(1200);

    // Verify Next/Create button state (retry up to 5 attempts)
    let nextReady = false;
    for (let retry = 1; retry <= 5; retry++) {
      const isEnabled = await page.evaluate(() => {
        const modal = document.querySelector('.ant-modal-content, [role="dialog"], div[class*="modal"]') || document.body;
        const buttons = Array.from(modal.querySelectorAll('button'));
        const next = buttons.find(b => (b.textContent || '').toLowerCase().trim() === 'next');
        if (next) return !next.disabled;

        const createBtn = buttons.find(b => {
          const t = (b.textContent || '').toLowerCase().trim();
          return t === 'create' || t === 'create database' || t.includes('create database');
        });
        return createBtn ? !createBtn.disabled : false;
      }).catch(() => false);

      log(`[8/8] Next/Create button state (Attempt ${retry}/5): enabled=${isEnabled}`);
      if (isEnabled) {
        log("[8/8] Region selection validated and modal ready.");
        nextReady = true;
        break;
      }

      if (retry < 5) {
        await delay(1000);
      }
    }

    // Step 1 -> Step 2: Click Next button
    log("[8/8] Clicking Next button in modal...");
    // Handle modal submission cleanly
    log("[8/8] Submitting Database Creation modal...");
    const submitResult = await page.evaluate(() => {
      const modal = document.querySelector('.ant-modal-content, [role="dialog"], div[class*="modal"]') || document.body;
      const buttons = Array.from(modal.querySelectorAll('button'));

      // Check for Next button first
      const nextBtn = buttons.find(b => (b.textContent || '').toLowerCase().trim() === 'next');
      if (nextBtn) {
        nextBtn.click();
        return "next_clicked";
      }

      // Check for Create / Create Database / Submit button
      const createBtn = buttons.find(b => {
        const text = (b.textContent || '').toLowerCase().trim();
        return text === 'create' || text === 'create database' || text.includes('create database') || text.includes('submit');
      }) || buttons.find(b => !b.disabled && (b.textContent || '').toLowerCase().includes('create'));

      if (createBtn) {
        createBtn.click();
        return "create_clicked";
      }

      return "none";
    }).catch(() => "none");

    log(`[8/8] Modal submit action: ${submitResult}`);
    if (submitResult === "next_clicked") {
      await delay(2000);
      await page.evaluate(() => {
        const modal = document.querySelector('.ant-modal-content, [role="dialog"], div[class*="modal"]') || document.body;
        const buttons = Array.from(modal.querySelectorAll('button'));
        const createBtn = buttons.find(b => {
          const text = (b.textContent || '').toLowerCase().trim();
          return text === 'create' || text === 'create database' || text.includes('create database') || text.includes('submit');
        }) || buttons.find(b => !b.disabled && (b.textContent || '').toLowerCase().includes('create'));
        if (createBtn) createBtn.click();
      }).catch(() => {});
    } else if (submitResult === "none") {
      await page.keyboard.press("Enter").catch(() => {});
    }

    // Wait up to 10s for API response to return created database ID
    log("[8/8] Waiting for Upstash database provisioning response...");
    const waitStart = Date.now();
    while (!interceptedDbId && Date.now() - waitStart < 10000) {
      const freshId = await page.evaluate(() => window.__interceptedCreds?.dbId || null).catch(() => null);
      if (freshId) {
        interceptedDbId = freshId;
        log(`[CHECKPOINT 8/8] Database provisioned with ID: ${interceptedDbId}`);
        break;
      }
      await delay(500);
    }

    // After creation submit, use waitForNavigation to catch the redirect to /redis/{id}
    log(`Waiting for Upstash to provision database and redirect to /redis/${interceptedDbId}...`);
    let onDetailsPage = false;

    // First: try to catch navigation immediately after the submit click
    try {
      await Promise.race([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 25000 }),
        delay(25000)
      ]);
      const urlAfterSubmit = page.url();
      log(`URL after submit: ${urlAfterSubmit}`);
      const parsedAfterSubmit = new URL(urlAfterSubmit);
      const pathAfterSubmit = parsedAfterSubmit.pathname.split('/').filter(Boolean);
      if (pathAfterSubmit.length >= 2 && pathAfterSubmit[0] === 'redis') {
        onDetailsPage = true;
        const capturedId = pathAfterSubmit[1];
        if (capturedId && !interceptedDbId) interceptedDbId = capturedId;
        log(`[SUCCESS] Redirected after submit: ${urlAfterSubmit} (id=${capturedId})`);
      }
    } catch (navErr) {
      log(`[Nav] waitForNavigation after submit error: ${navErr.message}`);
    }

    // Second: if still not on details, poll for redirect up to 30s
    if (!onDetailsPage) {
      for (let i = 0; i < 15; i++) {
        await delay(2000);
        const url = page.url();
        log(`Checking page URL (${i + 1}/15): ${url}`);
        try {
          const parsedUrl = new URL(url);
          const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
          // Must be /redis/{id} or /redis/{id}/something - not just /redis
          if (pathParts.length >= 2 && pathParts[0] === 'redis' && pathParts[1].length > 5) {
            onDetailsPage = true;
            if (!interceptedDbId) interceptedDbId = pathParts[1];
            log(`[SUCCESS] Redirected to database page: ${url} (id=${pathParts[1]})`);
            break;
          }
        } catch { }
      }
    }

    if (!onDetailsPage) {
      // Check in-page intercepted creds for dbId
      const inPageDbId = await page.evaluate(() => window.__interceptedCreds?.dbId || null).catch(() => null);
      if (inPageDbId && !interceptedDbId) {
        interceptedDbId = inPageDbId;
        log(`[Nav] Captured dbId from API intercept: ${interceptedDbId}`);
      }

      // Strategy 1: Use the DB id captured from the creation API response
      if (!interceptedDbId) {
        log("[Nav] Waiting up to 10s for DB creation API to return an id...");
        const waitStart = Date.now();
        while (!interceptedDbId && Date.now() - waitStart < 10000) {
          const freshId = await page.evaluate(() => window.__interceptedCreds?.dbId || null).catch(() => null);
          if (freshId) { interceptedDbId = freshId; break; }
          await delay(500);
        }
      }

      log(`[Nav] interceptedDbId=${interceptedDbId}, interceptedEndpoint=${interceptedEndpoint}`);

      if (interceptedDbId) {
        const detailsUrl = `https://console.upstash.com/redis/${interceptedDbId}/details`;
        log(`[Nav] Navigating directly to: ${detailsUrl}`);
        await page.goto(detailsUrl, { waitUntil: "networkidle2", timeout: 30000 }).catch(() => { });
        await delay(4000);
        log(`[Nav] After goto, URL is: ${page.url()}`);
      } else {
        // Strategy 2: Try to get DB id from current page URL or navigation history
        const currentUrl = page.url();
        const urlIdMatch = currentUrl.match(/\/redis\/([a-zA-Z0-9_-]{8,})/);
        if (urlIdMatch) {
          interceptedDbId = urlIdMatch[1];
          const detailsUrl = `https://console.upstash.com/redis/${interceptedDbId}/details`;
          log(`[Nav] Extracted id from URL: ${interceptedDbId}, going to ${detailsUrl}`);
          await page.goto(detailsUrl, { waitUntil: "networkidle2", timeout: 30000 }).catch(() => { });
          await delay(4000);
        } else {
          // Strategy 3: Navigate to list page, find database card matching dbName, and click it
          log("[Nav] Navigating to Redis list page...");
          await page.goto("https://console.upstash.com/redis", { waitUntil: "networkidle2", timeout: 30000 }).catch(() => { });
          await delay(3000);

          log(`[Nav] Looking for DB card matching "${dbName}" on list page...`);
          const cardClicked = await page.evaluate((dbN) => {
            const all = Array.from(document.querySelectorAll('*'));
            const target = all.find(el => {
              const text = (el.textContent || '').trim();
              return text === dbN || text.startsWith(dbN);
            });
            if (target) {
              const clickable = target.closest('a, button, tr, [role="button"], div[class*="card"], div[class*="row"], div[class*="item"]') || target;
              try {
                clickable.click();
                return true;
              } catch { }
            }
            return false;
          }, dbName).catch(() => false);

          if (cardClicked) {
            log(`[Nav] Clicked DB card for "${dbName}". Waiting 4s for navigation...`);
            await delay(4000);
            const afterClickUrl = page.url();
            const idMatch = afterClickUrl.match(/\/redis\/([a-zA-Z0-9_-]{8,})/);
            if (idMatch) {
              interceptedDbId = idMatch[1];
              log(`[Nav] Successfully navigated to DB page: ${afterClickUrl} (id=${interceptedDbId})`);
            }
          }

          // Fallback: check hrefs on list page
          if (!interceptedDbId) {
            const hrefs = await page.evaluate(() =>
              Array.from(document.querySelectorAll('a[href]')).map(a => a.getAttribute('href')).filter(Boolean)
            ).catch(() => []);
            const redisHref = hrefs.find(h => /\/redis\/[a-zA-Z0-9_-]{8,}/.test(h));
            if (redisHref) {
              const idMatch = redisHref.match(/\/redis\/([a-zA-Z0-9_-]{8,})/);
              if (idMatch) {
                interceptedDbId = idMatch[1];
                const detailsUrl = `https://console.upstash.com/redis/${interceptedDbId}/details`;
                log(`[Nav] Got id from list href: ${interceptedDbId}, going to ${detailsUrl}`);
                await page.goto(detailsUrl, { waitUntil: "networkidle2", timeout: 30000 }).catch(() => { });
                await delay(4000);
              }
            }
          }
        }
      }
    }

    log("Extracting REST String, Token, and Full TCP URL...");
    await delay(3000);

    let extractedUrl = null;
    let extractedPassword = null;
    let extractedRestUrl = null;
    let extractedRestToken = null;

    // ── STRATEGY 1: Check in-page intercepted creds from XHR/fetch hooks ──
    const apiCreds = await page.evaluate(() => window.__interceptedCreds || {}).catch(() => ({}));
    if (apiCreds.password && isValidToken(apiCreds.password)) {
      interceptedPassword = apiCreds.password;
      interceptedRestToken = apiCreds.password;
      log(`[Extraction] Got password from API intercept (length ${apiCreds.password.length})`);
    }
    if (apiCreds.endpoint) interceptedEndpoint = apiCreds.endpoint;
    if (apiCreds.restUrl) interceptedRestUrl = apiCreds.restUrl;

    for (let attempt = 1; attempt <= 15; attempt++) {
      try {
        log(`[Extraction ${attempt}/15] Unmasking DOM & scraping credentials...`);

        // Step 1: Ensure we are on the /redis/UUID/details page
        const currentUrl = page.url();
        log(`[Extraction ${attempt}] Current URL: ${currentUrl}`);

        const onDetailsNow = currentUrl.includes('/redis/') && !currentUrl.match(/\/redis\/?$/) && !currentUrl.match(/\/redis\?/);

        if (!onDetailsNow) {
          // Use captured DB id if available
          if (interceptedDbId) {
            const detailsUrl = `https://console.upstash.com/redis/${interceptedDbId}/details`;
            log(`[Extraction ${attempt}] Going directly to: ${detailsUrl}`);
            await page.goto(detailsUrl, { waitUntil: "networkidle2", timeout: 30000 }).catch(() => { });
            await delay(3000);
            log(`[Extraction ${attempt}] Now at: ${page.url()}`);
          } else {
            // Try to extract id from current URL
            const urlIdM = currentUrl.match(/\/redis\/([a-zA-Z0-9_-]{8,})/);
            if (urlIdM) {
              interceptedDbId = urlIdM[1];
              const detailsUrl = `https://console.upstash.com/redis/${interceptedDbId}/details`;
              log(`[Extraction ${attempt}] Got id from URL, going to: ${detailsUrl}`);
              await page.goto(detailsUrl, { waitUntil: "networkidle2", timeout: 30000 }).catch(() => { });
              await delay(3000);
            } else {
              log(`[Extraction ${attempt}] No DB id - checking hrefs on page...`);
              const hrefs = await page.evaluate(() =>
                Array.from(document.querySelectorAll('a[href]')).map(a => a.getAttribute('href')).filter(Boolean)
              ).catch(() => []);
              log(`[Extraction ${attempt}] hrefs: ${JSON.stringify(hrefs.filter(h => h.includes('redis')).slice(0, 10))}`);
              const rh = hrefs.find(h => /\/redis\/[a-zA-Z0-9_-]{8,}/.test(h));
              if (rh) {
                const idM = rh.match(/\/redis\/([a-zA-Z0-9_-]{8,})/);
                if (idM) {
                  interceptedDbId = idM[1];
                  const detailsUrl = `https://console.upstash.com/redis/${interceptedDbId}/details`;
                  log(`[Extraction ${attempt}] Got id from href, going to: ${detailsUrl}`);
                  await page.goto(detailsUrl, { waitUntil: "networkidle2", timeout: 30000 }).catch(() => { });
                  await delay(3000);
                }
              } else {
                log(`[Extraction ${attempt}] No id found anywhere, going to redis list...`);
                await page.goto("https://console.upstash.com/redis", { waitUntil: "networkidle2" }).catch(() => { });
                await delay(3000);
                continue;
              }
            }
          }
        } else if (!currentUrl.includes('/details')) {
          // On DB page but not /details tab
          const baseUrl = currentUrl.split('?')[0].replace(/\/$/, '').replace(/\/details$/, '');
          const detailsUrl = baseUrl + '/details';
          log(`[Extraction ${attempt}] Appending /details: ${detailsUrl}`);
          await page.goto(detailsUrl, { waitUntil: "networkidle2", timeout: 30000 }).catch(() => { });
          await delay(3000);
          log(`[Extraction ${attempt}] Now at: ${page.url()}`);
        }

        // Step 2: Re-check API creds (they may have loaded by now)
        const latestApiCreds = await page.evaluate(() => window.__interceptedCreds || {}).catch(() => ({}));
        if (latestApiCreds.password && isValidToken(latestApiCreds.password)) {
          interceptedPassword = latestApiCreds.password;
          interceptedRestToken = latestApiCreds.password;
        }
        if (latestApiCreds.endpoint && !interceptedEndpoint) interceptedEndpoint = latestApiCreds.endpoint;
        // Step 3: Eye toggle – find and click ALL eye-off buttons to unmask (REST tab is default)
        // Open the REST credential eye only
        await page.evaluate(() => {

          const labels = [...document.querySelectorAll("*")];

          const restLabel = labels.find(el =>
            el.textContent?.trim() === "REST"
          );

          if (!restLabel) return;

          const section =
            restLabel.closest("[role='tabpanel'], section, .rounded, .card")
            || restLabel.parentElement;
          const eye = [...section.querySelectorAll("button")]
            .find(btn =>
              btn.innerHTML.includes("tabler-icon-eye")
            );

          if (eye) eye.click();

        });

        await page.waitForFunction(() => {

          return [...document.querySelectorAll(".view-line")]
            .some(line =>
              line.innerText.includes("UPSTASH_REDIS_REST_TOKEN")
            );

        }, { timeout: 10000 });

        await delay(1000);

        // Step 4: After unmasking, read __interceptedCreds again (eye toggle may trigger API call)
        const afterToggleCreds = await page.evaluate(() => window.__interceptedCreds || {}).catch(() => ({}));
        if (afterToggleCreds.password && isValidToken(afterToggleCreds.password)) {
          interceptedPassword = afterToggleCreds.password;
          interceptedRestToken = afterToggleCreds.password;
          log(`[Extraction ${attempt}] API creds captured post-eye-toggle`);
        }
        if (afterToggleCreds.endpoint && !interceptedEndpoint) interceptedEndpoint = afterToggleCreds.endpoint;
        if (afterToggleCreds.restUrl && !interceptedRestUrl) interceptedRestUrl = afterToggleCreds.restUrl;

        // Step 5: Hover over index 1 copy button (TCP) then click it
        await page.evaluate(() => {
          const copyIcons = Array.from(document.querySelectorAll('svg.tabler-icon-copy, .tabler-icon-copy'));
          if (copyIcons.length > 1) {
            const tcpBtn = copyIcons[1].closest('button') || copyIcons[1].parentElement;
            if (tcpBtn) {
              tcpBtn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
              tcpBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
              tcpBtn.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
              tcpBtn.click();
            }
          }
          // Also click all copy buttons to capture whatever's in clipboard
          copyIcons.forEach(icon => {
            const btn = icon.closest('button') || icon.parentElement;
            if (btn) {
              btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
              btn.click();
            }
          });
        }).catch(() => { });

        // Also try native Puppeteer hover on index 1 copy handle
        try {
          const copyHandles = await page.$$('svg.tabler-icon-copy, .tabler-icon-copy');
          if (copyHandles.length > 1) {
            await copyHandles[1].hover();
            await delay(100);
            const parentBtn = await page.evaluateHandle(el => el.closest('button') || el.parentElement, copyHandles[1]);
            if (parentBtn && parentBtn.asElement()) await parentBtn.asElement().click().catch(() => { });
          }
        } catch { }

        await delay(600);

        const scraped = await page.evaluate(() => {

          const copied = (window.__copiedStrings || []).filter(Boolean);
          const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea')).map(i => i.value).filter(Boolean);

          let editorText =
            [...document.querySelectorAll(".view-line")]
              .map(e => e.innerText)
              .join("\n");

          if (!editorText.trim()) {
            editorText =
              document.querySelector("code")?.textContent ??
              document.querySelector("pre")?.textContent ??
              "";
          }

          // Code/pre blocks
          const codeBlocks = Array.from(document.querySelectorAll('code, pre')).map(el => el.textContent || '');

          // All visible text nodes that look like tokens
          const bodyText = document.body.innerText || '';

          // __NEXT_DATA__ (SSR data sometimes has real tokens)
          const nextDataText = (document.querySelector('#__NEXT_DATA__') || {}).textContent || '';

          function isGoodToken(t) {
            if (!t || typeof t !== 'string') return false;
            const s = t.trim();
            if (s.length < 20) return false;
            if (s.includes('*') || s.includes('•') || s.includes(' ') || s.includes('required') || s.includes('undefined') || s.includes('null')) return false;
            if (/^[A-Za-z0-9+/=]{20,}$/.test(s) === false && !s.startsWith('gQAAAA') && !/^[A-Za-z0-9_-]{20,}$/.test(s)) return false;
            return true;
          }

          let tcpUrl = null;
          let pass = null;
          let rUrl = null;
          let rToken = null;

          const restUrlMatch =
            editorText.match(
              /UPSTASH_REDIS_REST_URL\s*=\s*"?(.+?)"?$/m
            );

          if (restUrlMatch)
            rUrl = restUrlMatch[1].trim();

          const restTokenMatch =
            editorText.match(
              /UPSTASH_REDIS_REST_TOKEN\s*=\s*"?(.+?)"?$/m
            );

          if (restTokenMatch)
            rToken = restTokenMatch[1].trim();

          const tcpMatch =
            editorText.match(
              /REDIS_URL\s*=\s*"?(.+?)"?$/m
            );

          if (tcpMatch)
            tcpUrl = tcpMatch[1].trim();

          if (tcpUrl) {

            const passMatch =
              tcpUrl.match(/default:([^@]+)@/);

            if (passMatch)
              pass = passMatch[1];

          }

          if (!tcpUrl) {
            for (const c of copied) {
              const m = c.match(/rediss?:\/\/[^:@]+:([^@]+)@[a-zA-Z0-9.-]+\.upstash\.io(?::\d+)?/i);
              if (m && isGoodToken(m[1])) { tcpUrl = c.trim(); pass = m[1]; break; }
            }
          }

          return { tcpUrl, pass, rUrl, rToken, copied, inputs, codeBlocks };
        });

        if (scraped && scraped.copied && Array.isArray(scraped.copied)) {
          scraped.copied.forEach(c => addCopiedString(c));
        }

        // Merge all sources & print FULL debug log
        log(`[Extraction ${attempt}] === RAW SCRAPED DATA ===
  - Copied Clipboard Items: ${JSON.stringify(scraped.copied)}
  - DOM Inputs: ${JSON.stringify(scraped.inputs)}
  - Code Blocks: ${JSON.stringify(scraped.codeBlocks)}
  - API Intercepted Password: ${interceptedPassword || 'none'}
  - API Intercepted Endpoint: ${interceptedEndpoint || 'none'}
  - API Intercepted REST URL: ${interceptedRestUrl || 'none'}
  - Parsed REST URL: ${scraped.rUrl || 'none'}
  - Parsed REST Token: ${scraped.rToken || 'none'}
  - Parsed Password: ${scraped.pass || 'none'}
  - Parsed TCP URL: ${scraped.tcpUrl || 'none'}
  =================================`);

        if (interceptedPassword && isValidToken(interceptedPassword)) extractedPassword = interceptedPassword;
        if (interceptedRestToken && isValidToken(interceptedRestToken)) extractedRestToken = interceptedRestToken;
        if (interceptedRestUrl) extractedRestUrl = interceptedRestUrl;
        if (interceptedEndpoint && !extractedRestUrl) extractedRestUrl = `https://${interceptedEndpoint}`;

        if (scraped.rUrl) extractedRestUrl = scraped.rUrl;
        if (scraped.rToken && isValidToken(scraped.rToken)) extractedRestToken = scraped.rToken;
        if (scraped.pass && isValidToken(scraped.pass)) extractedPassword = scraped.pass;
        if (scraped.tcpUrl) {
          const cleanTcp = scraped.tcpUrl.trim();

          try {
            const u = new URL(cleanTcp);

            if (
              u.protocol === "rediss:" &&
              u.hostname.endsWith(".upstash.io") &&
              !cleanTcp.includes("default:@") &&
              !cleanTcp.includes("default:required") &&
              !cleanTcp.includes("****")
            ) {
              extractedUrl = cleanTcp;
            }
          } catch { }
        }

        // Build TCP url from parts if we have token + endpoint
        const token = extractedPassword || extractedRestToken;
        if ((!extractedUrl || extractedUrl.includes('default:@') || extractedUrl.includes('****')) && isValidToken(token) && extractedRestUrl) {
          const host = extractedRestUrl.replace('https://', '').replace('http://', '').split('/')[0].trim();
          extractedUrl = `rediss://default:${token}@${host}:6379`;
          log(`[Extraction ${attempt}] Built TCP URL from token + host: ${host}`);
        }

        if (extractedUrl && isValidToken(extractedPassword || extractedRestToken) &&
          !extractedUrl.includes('default:@') && !extractedUrl.includes('default:required') && !extractedUrl.includes('****')) {
          log(`[SUCCESS] Scraped complete unmasked TCP connection string on attempt ${attempt}!`);
          break;
        }

        log(`[Extraction ${attempt}] Not yet complete. pass=${!!(extractedPassword || extractedRestToken)}, endpoint=${!!extractedRestUrl}, url=${!!extractedUrl}. Retrying...`);
      } catch (err) {
        log(`Extraction retry ${attempt} error: ${err.message}`);
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
        finalRedisUrl = `rediss://default:${finalPassword || "pending"}@${finalEndpoint}:6379`;
        log(`[Notice] Saving database "${dbName}" to apis.env with endpoint ${finalEndpoint}`);
      }
    }

    const finalRestUrl = extractedRestUrl || `https://${finalEndpoint}`;
    const finalRestToken = extractedRestToken || finalPassword || "pending";
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
