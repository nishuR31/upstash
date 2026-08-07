import fs from "fs";
import { APIS_ENV_PATH } from "../config/envConfig.js";

const activeTask = {
  status: "IDLE",
  step: 0,
  checkpointsCompleted: [],
  logs: [],
  copiedStrings: [],
  interceptedUrls: [],
  returnedData: null,
  redisUrl: null,
  credentials: null,
  otpError: null,
  otpAttempt: 1,
  maxOtpAttempts: 3,
  error: null,
  otpResolver: null,
};

let currentBrowserInstance = null;

export function setActiveBrowserInstance(browser) {
  currentBrowserInstance = browser;
}

export function getActiveBrowserInstance() {
  return currentBrowserInstance;
}

export function setTaskStep(stepNumber) {
  activeTask.step = stepNumber;
  if (!activeTask.checkpointsCompleted.includes(stepNumber)) {
    activeTask.checkpointsCompleted.push(stepNumber);
  }
}

export function addCopiedString(str) {
  if (!str || typeof str !== "string") return;
  const cleaned = str.trim();
  if (!cleaned) return;
  if (!activeTask.copiedStrings.includes(cleaned)) {
    activeTask.copiedStrings.push(cleaned);
  }
}

export function addInterceptedUrl(entry) {
  if (!entry) return;
  const urlStr = typeof entry === "string" ? entry : entry.url;
  if (!urlStr) return;

  const exists = activeTask.interceptedUrls.some(u => (typeof u === "string" ? u : u.url) === urlStr);
  if (!exists) {
    if (activeTask.interceptedUrls.length >= 200) {
      activeTask.interceptedUrls.shift();
    }
    activeTask.interceptedUrls.push(entry);
  }
}

export function setReturnedData(data) {
  activeTask.returnedData = data;
}

export function getActiveTaskState() {
  return { ...activeTask };
}

export function addLog(msg) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${msg}`;
  activeTask.logs.push(logEntry);
  console.log(logEntry);
}

export function resetActiveTask(email, dbName) {
  if (currentBrowserInstance) {
    try { currentBrowserInstance.close().catch(() => {}); } catch {}
    currentBrowserInstance = null;
  }
  if (activeTask.otpResolver) {
    try { activeTask.otpResolver(null); } catch {}
    activeTask.otpResolver = null;
  }

  activeTask.status = "RUNNING";
  activeTask.step = 1;
  activeTask.checkpointsCompleted = [1];
  activeTask.logs = [];
  activeTask.copiedStrings = [];
  activeTask.interceptedUrls = [];
  activeTask.returnedData = null;
  activeTask.redisUrl = null;
  activeTask.credentials = null;
  activeTask.otpError = null;
  activeTask.otpAttempt = 1;
  activeTask.error = null;
  addLog(`[START] Initializing provisioning process for email: ${email}, DB: ${dbName}...`);
}

export function setTaskWaitingForOtp(attempt, maxAttempts, lastError, resolver) {
  activeTask.status = "WAITING_FOR_OTP";
  activeTask.otpAttempt = attempt;
  activeTask.maxOtpAttempts = maxAttempts;
  activeTask.otpError = lastError || null;
  activeTask.otpResolver = resolver;
  addLog(`[ACTION REQUIRED] Verification code required. Enter 6-digit OTP code.`);
}

export function resolveOtp(otpCode) {
  if (activeTask.status !== "WAITING_FOR_OTP" || !activeTask.otpResolver) {
    return false;
  }
  const resolver = activeTask.otpResolver;
  activeTask.otpResolver = null;
  activeTask.status = "RUNNING";
  activeTask.otpError = null;
  addLog(`[OTP RECEIVED] Code (${otpCode}) dispatched to headless engine.`);
  resolver(otpCode);
  return true;
}

export function stopActiveTask() {
  addLog("[STOPPED] Stop signal received. Halting automation engine...");
  if (activeTask.otpResolver) {
    try { activeTask.otpResolver(null); } catch {}
    activeTask.otpResolver = null;
  }
  if (currentBrowserInstance) {
    try { currentBrowserInstance.close().catch(() => {}); } catch {}
    currentBrowserInstance = null;
  }
  activeTask.status = "STOPPED";
  activeTask.error = "Engine stopped by user.";
}

export function setTaskSuccess(result, cleanDbName) {
  if (activeTask.status === "STOPPED") return;
  activeTask.status = "SUCCESS";
  activeTask.step = 8;
  if (!activeTask.checkpointsCompleted.includes(8)) {
    activeTask.checkpointsCompleted.push(8);
  }
  activeTask.returnedData = result;
  if (typeof result === "string") {
    activeTask.redisUrl = result;
    activeTask.credentials = { redisUrl: result };
  } else {
    activeTask.redisUrl = result.redisUrl;
    activeTask.credentials = result;
  }

  const resToken = activeTask.credentials?.restToken || activeTask.credentials?.password || "";
  const isValid = activeTask.redisUrl &&
                  !activeTask.redisUrl.includes("default:@") &&
                  !activeTask.redisUrl.includes("default:pending") &&
                  !activeTask.redisUrl.includes("default:required") &&
                  !activeTask.redisUrl.includes("****") &&
                  resToken &&
                  resToken !== "pending" &&
                  resToken !== "required" &&
                  resToken.length > 15;

  if (isValid) {
    try {
      const list = readApisEnvFile();
      const epMatch = activeTask.redisUrl.match(/@([^:\/]+)/);
      const ep = epMatch ? epMatch[1] : activeTask.credentials?.endpoint || `${cleanDbName || "redis-db"}.upstash.io`;
      const savedDbName = cleanDbName || ep.replace(".upstash.io", "");
      const newItem = {
        name: savedDbName,
        redisUrl: activeTask.redisUrl,
        restUrl: activeTask.credentials?.restUrl || `https://${ep}`,
        restToken: resToken,
      };
      const existingIndex = list.findIndex(item => item.redisUrl === newItem.redisUrl || item.name === savedDbName);
      if (existingIndex >= 0) {
        list[existingIndex] = { ...list[existingIndex], ...newItem };
      } else {
        list.push(newItem);
      }
      writeApisEnvFile(list);
      addLog(`[SUCCESS] Verified & saved active database "${savedDbName}" to apis.env`);
    } catch (e) {
      console.error("Failed to save credentials to apis.env:", e.message);
    }
  } else {
    addLog(`[NOTICE] Credentials incomplete (password masked/pending). Skipping saving dummy entry to apis.env.`);
  }
}

export function setTaskFailed(errMessage) {
  if (activeTask.status === "STOPPED") return;
  activeTask.status = "FAILED";
  activeTask.error = errMessage;
  addLog(`[ERROR] Automation Failure: ${errMessage}`);
}

export function readApisEnvFile() {
  if (!fs.existsSync(APIS_ENV_PATH)) return [];
  try {
    const raw = fs.readFileSync(APIS_ENV_PATH, "utf8").trim();
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading apis.env:", err.message);
    return [];
  }
}

export function writeApisEnvFile(data) {
  try {
    fs.writeFileSync(APIS_ENV_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing apis.env:", err.message);
  }
}
