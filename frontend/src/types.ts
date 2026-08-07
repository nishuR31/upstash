export interface DatabaseItem {
  id: string;
  name: string;
  endpoint: string;
  port: number;
  restUrl: string;
  restToken: string;
  redisUrl: string;
  region?: string;
  status?: string;
  readOnly?: boolean;
  locked?: boolean;
}

export type ActiveTab = "home" | "clusters" | "provisioner" | "diagnostics" | "settings" | "notfound";

export type ToastType = "success" | "error" | "warn" | "info";

export interface ToastItem {
  id: number;
  msg: string;
  type: ToastType;
}

export type TaskStatus = "IDLE" | "RUNNING" | "WAITING_FOR_OTP" | "SUCCESS" | "FAILED" | "STOPPED";

export interface InterceptedUrlItem {
  url: string;
  status?: number;
  timestamp?: string;
}

export interface TaskState {
  status: TaskStatus;
  step: number;
  checkpointsCompleted?: number[];
  logs: string[];
  copiedStrings?: string[];
  interceptedUrls?: (string | InterceptedUrlItem)[];
  returnedData?: any;
  redisUrl?: string | null;
  credentials?: any;
  otpError?: string | null;
  otpAttempt?: number;
  maxOtpAttempts?: number;
  error?: string | null;
}

export type ScrapableTargetType = "redis" | "kafka" | "qstash" | "vector" | "web_scraper";

export interface ScrapableTargetConfig {
  id: ScrapableTargetType;
  label: string;
  description: string;
  icon: string;
  extractedFields: string[];
}

export interface ShaderSettings {
  speed: number;
  glow: number;
  density: number;
  theme: "cyber" | "neon" | "matrix" | "gold";
}

export interface EngineSettings {
  userAgent: string;
  concurrency: number;
  timeoutSec: number;
  proxyRotation: boolean;
  autoRetry: boolean;
}

export interface CliCommandResult {
  command: string;
  timestamp: string;
  status: "OK" | "ERR";
  output: string;
  latencyMs: number;
}

export interface SelectorTestResult {
  targetUrl: string;
  selector: string;
  httpStatus: number;
  htmlLengthBytes: number;
  matchCount: number;
  matches: { tag: string; text: string }[];
}

