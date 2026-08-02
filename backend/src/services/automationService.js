import fs from "fs";
import { APIS_ENV_PATH } from "../config/envConfig.js";

const activeTask = {
  status: "IDLE",
  step: 0,
  logs: [],
  redisUrl: null,
  credentials: null,
  otpError: null,
  otpAttempt: 1,
  maxOtpAttempts: 3,
  error: null,
  otpResolver: null,
};

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
  activeTask.status = "RUNNING";
  activeTask.step = 1;
  activeTask.logs = [];
  activeTask.redisUrl = null;
  activeTask.credentials = null;
  activeTask.otpError = null;
  activeTask.otpAttempt = 1;
  activeTask.error = null;
  activeTask.otpResolver = null;
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
    activeTask.otpResolver(null);
    activeTask.otpResolver = null;
  }
  activeTask.status = "STOPPED";
  activeTask.error = "Engine stopped by user.";
}

export function setTaskSuccess(result, cleanDbName) {
  if (activeTask.status === "STOPPED") return;
  activeTask.status = "SUCCESS";
  activeTask.step = 8;
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
                  !activeTask.redisUrl.includes("default:required") &&
                  !activeTask.redisUrl.includes("****") &&
                  resToken &&
                  resToken !== "required" &&
                  resToken.length > 15;

  if (isValid) {
    try {
      const list = readApisEnvFile();
      const epMatch = activeTask.redisUrl.match(/@([^:\/]+)/);
      const ep = epMatch ? epMatch[1] : "new-upstash-db.upstash.io";
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
      addLog("[SUCCESS] Saved database credentials to local storage (apis.env)");
    } catch (e) {
      console.error("Failed to auto-save credentials:", e.message);
    }
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
