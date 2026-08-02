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

