import {
  getActiveTaskState,
  resetActiveTask,
  setTaskWaitingForOtp,
  resolveOtp,
  stopActiveTask,
  setTaskSuccess,
  setTaskFailed,
  addLog,
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

  const onOtpRequired = ({ attempt, maxAttempts, lastError }) => {
    return new Promise((resolve) => {
      setTaskWaitingForOtp(attempt, maxAttempts, lastError, resolve);
    });
  };

  runAutomation({ email: cleanEmail, password, dbName: cleanDbName, onLog, onOtpRequired })
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
