import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import {
  getActiveTaskState,
  resetActiveTask,
  setTaskWaitingForOtp,
  resolveOtp,
  stopActiveTask,
  setTaskSuccess,
  setTaskFailed,
  addLog,
  setActiveBrowserInstance,
  getActiveBrowserInstance,
} from "../services/automationService.js";
import { runAutomation } from "../automator.js";
import { sendSuccess, sendBadRequestError } from "../utils/common/response.js";
import { STATUS_CODES } from "../utils/common/constants.js";

export async function getStatusHandler(req, reply) {
  return sendSuccess(reply, "Automation status retrieved successfully", STATUS_CODES.OK, getActiveTaskState());
}

export async function startAutomationHandler(req, reply) {
  const currentState = getActiveTaskState();
  if (currentState.status === "RUNNING" || currentState.status === "WAITING_FOR_OTP") {
    return sendBadRequestError(reply, "Automation engine is already active.");
  }

  const { email, password, dbName } = req.body || {};
  if (!email || !password || !dbName) {
    return sendBadRequestError(reply, "email, password, and dbName are required.");
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanDbName = String(dbName).trim().replace(/[^a-zA-Z0-9-]/g, "");

  if (!cleanEmail.includes("@")) {
    return sendBadRequestError(reply, "Invalid email format.");
  }

  resetActiveTask(cleanEmail, cleanDbName);

  const onLog = (msg) => addLog(msg);

  const onBrowserLaunch = (b) => {
    setActiveBrowserInstance(b);
  };

  const onOtpRequired = ({ attempt, maxAttempts, lastError }) => {
    return new Promise((resolve) => {
      setTaskWaitingForOtp(attempt, maxAttempts, lastError, resolve);
    });
  };

  runAutomation({ email: cleanEmail, password, dbName: cleanDbName, onLog, onOtpRequired, onBrowserLaunch })
    .then((result) => {
      setTaskSuccess(result, cleanDbName);
    })
    .catch((err) => {
      setTaskFailed(err.message);
    });

  return sendSuccess(reply, "Automation process started.", STATUS_CODES.OK, null);
}

export async function submitOtpHandler(req, reply) {
  const currentState = getActiveTaskState();
  if (currentState.status !== "WAITING_FOR_OTP") {
    return sendBadRequestError(reply, "Engine is not currently waiting for OTP input.");
  }

  const { otp } = req.body || {};
  if (!otp || typeof otp !== "string" || otp.trim().length === 0) {
    return sendBadRequestError(reply, "Valid OTP verification code is required.");
  }

  const cleanOtp = otp.trim();
  const success = resolveOtp(cleanOtp);
  if (!success) {
    return sendBadRequestError(reply, "Failed to dispatch OTP code.");
  }

  return sendSuccess(reply, "OTP code dispatched.", STATUS_CODES.OK, null);
}

export async function stopAutomationHandler(req, reply) {
  stopActiveTask();
  return sendSuccess(reply, "Automation process stopped.", STATUS_CODES.OK, null);
}

export async function testSelectorHandler(req, reply) {
  const { url, selector } = req.body || {};
  if (!url) {
    return sendBadRequestError(reply, "Target 'url' is required.");
  }

  const rawSel = (selector || "*").trim();
  let browser = getActiveBrowserInstance();
  let needCloseBrowser = false;

  try {
    if (!browser) {
      let executablePath = null;
      const searchDirs = [
        "/home/nishu/.cache/puppeteer/chrome",
        "/root/.cache/puppeteer/chrome",
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
              if (found) { executablePath = found; break; }
            }
          } catch {}
        }
        if (executablePath) break;
      }

      const launchOpts = {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-blink-features=AutomationControlled"
        ],
      };
      if (executablePath) launchOpts.executablePath = executablePath;

      browser = await puppeteer.launch(launchOpts);
      needCloseBrowser = true;
    }

    const page = await browser.newPage();
    try {
      const response = await page.goto(url, { waitUntil: "networkidle2", timeout: 35000 }).catch(() => null);
      const status = response ? response.status() : 200;
      const finalUrl = page.url();
      const pageTitle = await page.title().catch(() => "");

      // Auto-scroll to trigger lazy loading / React hydration
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 300;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeight || totalHeight > 3000) {
              clearInterval(timer);
              window.scrollTo(0, 0);
              resolve();
            }
          }, 100);
        });
      }).catch(() => {});

      await new Promise(r => setTimeout(r, 1500));

      const evaluationResults = await page.evaluate((targetInput) => {
        const inputStr = targetInput.trim();

        // 1. Collect all distinct classes & IDs across the entire DOM
        const allClasses = new Set();
        const allIds = new Set();
        const allInteractive = [];

        function scanDOM(root, contextName = "main") {
          if (!root) return;
          const elements = Array.from(root.querySelectorAll("*"));

          for (const el of elements) {
            // ID
            if (el.id) allIds.add(el.id);

            // Classes
            const cls = el.className;
            const clsStr = typeof cls === "string" ? cls : (cls.baseVal || "");
            if (clsStr) {
              clsStr.split(/\s+/).filter(Boolean).forEach(c => allClasses.add(c));
            }

            // Interactive elements inventory (buttons, inputs, links, textareas, selects)
            const tag = (el.tagName || "").toLowerCase();
            if (["button", "input", "textarea", "select", "a"].includes(tag) || el.getAttribute("role") === "button" || el.getAttribute("role") === "combobox") {
              if (allInteractive.length < 30) {
                allInteractive.push({
                  tag,
                  id: el.id || undefined,
                  className: clsStr || undefined,
                  type: el.getAttribute("type") || undefined,
                  name: el.getAttribute("name") || undefined,
                  placeholder: el.getAttribute("placeholder") || undefined,
                  text: (el.textContent || "").trim().substring(0, 80) || undefined,
                });
              }
            }

            // Traverse Shadow Root if present
            if (el.shadowRoot) {
              scanDOM(el.shadowRoot, `${contextName} > shadow-root`);
            }
          }
        }

        scanDOM(document, "main");

        // Traverse iframes
        const iframes = Array.from(document.querySelectorAll("iframe"));
        for (let i = 0; i < iframes.length; i++) {
          try {
            const iframeDoc = iframes[i].contentDocument || iframes[i].contentWindow?.document;
            if (iframeDoc) scanDOM(iframeDoc, `iframe[${i}]`);
          } catch {}
        }

        // 2. Perform target selector matching
        const cleanTargets = inputStr.split(",").map(s => s.trim()).filter(Boolean);
        let matchedNodes = [];
        let evaluatedQueriesUsed = [];

        for (const rawQuery of cleanTargets) {
          let candidates = [rawQuery];
          const stripped = rawQuery.replace(/^[.#]/, "");

          if (!rawQuery.startsWith(".") && !rawQuery.startsWith("#") && !rawQuery.includes("[")) {
            candidates.push("." + rawQuery);
            candidates.push("#" + rawQuery);
            candidates.push(`[class*="${rawQuery}"]`);
            candidates.push(`[id*="${rawQuery}"]`);
          } else if (rawQuery.startsWith(".")) {
            candidates.push(`[class*="${stripped}"]`);
          } else if (rawQuery.startsWith("#")) {
            candidates.push(`[id*="${stripped}"]`);
          }

          function queryRoot(root) {
            if (!root) return;
            for (const q of candidates) {
              try {
                const list = Array.from(root.querySelectorAll(q));
                list.forEach(n => {
                  if (!matchedNodes.includes(n)) matchedNodes.push(n);
                });
                if (list.length > 0) evaluatedQueriesUsed.push(q);
              } catch {}
            }

            // Also check all elements in root for class prefix/token matching (e.g. .mtk -> mtk1, mtk5, mtk12)
            const allElements = Array.from(root.querySelectorAll("*"));
            const lowStripped = stripped.toLowerCase();

            allElements.forEach(el => {
              const cls = el.className;
              const clsStr = typeof cls === "string" ? cls : (cls.baseVal || "");
              const idStr = el.id || "";

              const hasMatchingClass = clsStr.split(/\s+/).some(token => {
                const t = token.toLowerCase();
                return t === lowStripped || t.startsWith(lowStripped) || t.includes(lowStripped);
              });

              if (hasMatchingClass || idStr.toLowerCase().includes(lowStripped)) {
                if (!matchedNodes.includes(el)) {
                  matchedNodes.push(el);
                  evaluatedQueriesUsed.push(`class-token("${clsStr}")`);
                }
              }

              if (el.shadowRoot) queryRoot(el.shadowRoot);
            });
          }

          queryRoot(document);

          // Query inside iframes
          const iframes = Array.from(document.querySelectorAll("iframe"));
          for (let i = 0; i < iframes.length; i++) {
            try {
              const iframeDoc = iframes[i].contentDocument || iframes[i].contentWindow?.document;
              if (iframeDoc) queryRoot(iframeDoc);
            } catch {}
          }
        }

        const matches = matchedNodes.slice(0, 25).map(el => {
          const tag = el.tagName ? el.tagName.toLowerCase() : "element";
          const text = (el.textContent || "").trim().substring(0, 150);
          const className = typeof el.className === "string" ? el.className : (el.className?.baseVal || "");
          const id = el.id || undefined;
          const outerHtml = (el.outerHTML || "").substring(0, 250);
          return { tag, id, className, text, outerHtml };
        });

        return {
          evaluatedQueriesUsed: Array.from(new Set(evaluatedQueriesUsed)),
          matchCount: matchedNodes.length,
          totalElements: document.querySelectorAll("*").length,
          allClasses: Array.from(allClasses).sort(),
          allIds: Array.from(allIds).sort(),
          allInteractive,
          matches,
        };
      }, rawSel);

      return sendSuccess(reply, "Selector test & DOM analysis completed.", STATUS_CODES.OK, {
        targetUrl: url,
        finalUrl,
        pageTitle,
        isRedirected: finalUrl !== url,
        inputSelector: rawSel,
        evaluatedQueries: evaluationResults.evaluatedQueriesUsed,
        httpStatus: status,
        totalPageElements: evaluationResults.totalElements,
        matchCount: evaluationResults.matchCount,
        allClassesOnPage: evaluationResults.allClasses,
        allIdsOnPage: evaluationResults.allIds,
        interactiveElements: evaluationResults.allInteractive,
        matches: evaluationResults.matches,
      });
    } finally {
      await page.close().catch(() => {});
      if (needCloseBrowser && browser) {
        await browser.close().catch(() => {});
      }
    }
  } catch (err) {
    return sendBadRequestError(reply, `Failed to analyze URL or evaluate selector: ${err.message}`);
  }
}
