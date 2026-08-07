import React, { useState, useEffect, useRef } from "react";
import {
  Eye,
  EyeOff,
  Play,
  Square,
  Trash2,
  KeyRound,
  AlertCircle,
  Database,
  Radio,
  Layers,
  Sparkles,
  Globe,
  GripHorizontal,
  Copy,
  Check,
  Code2,
  Settings2,
  Download
} from "lucide-react";
import { ToastType, ScrapableTargetType } from "../types";
import ResizableSplitPanel from "./ResizableSplitPanel";

interface ProvisionerTabProps {
  showToast: (msg: string, type?: ToastType) => void;
  loadDatabases: () => void;
}

const PROVISIONER_STORAGE_KEY = "upstash_provisioner_saved_inputs_v1";

const getSavedInputs = () => {
  try {
    const raw = localStorage.getItem(PROVISIONER_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
};

export default function ProvisionerTab({ showToast, loadDatabases }: ProvisionerTabProps) {
  const saved = getSavedInputs();

  // Target Type State
  const [targetType, setTargetType] = useState<ScrapableTargetType>(saved.targetType || "redis");

  // Account & Form State (Loaded from localStorage, no hardcoded defaults)
  const [keyTag, setKeyTag] = useState(saved.keyTag || "");
  const [email, setEmail] = useState(saved.email || "");
  const [password, setPassword] = useState(saved.password || "");
  const [dbName, setDbName] = useState(saved.dbName || "");
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopyField = (val: string, label: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopiedField(label);
    showToast(`${label} copied to clipboard!`, "success");
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Target-specific Extended State
  const [kafkaTopic, setKafkaTopic] = useState(saved.kafkaTopic || "");
  const [kafkaPartitions, setKafkaPartitions] = useState(saved.kafkaPartitions || 3);
  const [qstashQueue, setQstashQueue] = useState(saved.qstashQueue || "");
  const [vectorMetric, setVectorMetric] = useState(saved.vectorMetric || "cosine");
  const [vectorDimensions, setVectorDimensions] = useState(saved.vectorDimensions || 1536);
  const [webTargetUrl, setWebTargetUrl] = useState(saved.webTargetUrl || "");
  const [webCssSelector, setWebCssSelector] = useState(saved.webCssSelector || "");

  // Auto-save form inputs to localStorage on every update
  useEffect(() => {
    try {
      const config = {
        targetType,
        keyTag,
        email,
        password,
        dbName,
        kafkaTopic,
        kafkaPartitions,
        qstashQueue,
        vectorMetric,
        vectorDimensions,
        webTargetUrl,
        webCssSelector,
      };
      localStorage.setItem(PROVISIONER_STORAGE_KEY, JSON.stringify(config));
    } catch {}
  }, [
    targetType,
    keyTag,
    email,
    password,
    dbName,
    kafkaTopic,
    kafkaPartitions,
    qstashQueue,
    vectorMetric,
    vectorDimensions,
    webTargetUrl,
    webCssSelector,
  ]);

  // Terminal & Resizing State
  const [terminalHeight, setTerminalHeight] = useState(380);
  const [isResizingHeight, setIsResizingHeight] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);

  // Engine Execution State
  const [taskStatus, setTaskStatus] = useState<string>("IDLE");
  const [taskStep, setTaskStep] = useState<number>(0);
  const [checkpointsCompleted, setCheckpointsCompleted] = useState<number[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [copiedStrings, setCopiedStrings] = useState<string[]>([]);
  const [interceptedUrls, setInterceptedUrls] = useState<any[]>([]);
  const [returnedData, setReturnedData] = useState<any>(null);
  const [inspectionTab, setInspectionTab] = useState<"logs" | "copied" | "urls" | "returned">("logs");
  const [otpCode, setOtpCode] = useState("");
  const [otpAttempt, setOtpAttempt] = useState(1);
  const [maxOtpAttempts, setMaxOtpAttempts] = useState(3);
  const [otpError, setOtpError] = useState("");
  const [isSubmittingOtp, setIsSubmittingOtp] = useState(false);

  const terminalBodyRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleKeyTagChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tag = e.target.value;
    setKeyTag(tag);
    const tagClean = tag.trim();

    if (tagClean) {
      // Update email with +tag
      setEmail((prevEmail) => {
        if (!prevEmail) return `user+${tagClean}@gmail.com`;
        if (prevEmail.includes("+")) {
          return prevEmail.replace(/\+[^@]*@/, `+${tagClean}@`);
        }
        if (prevEmail.includes("@")) {
          const [local, domain] = prevEmail.split("@");
          return `${local}+${tagClean}@${domain}`;
        }
        return `${prevEmail}+${tagClean}@gmail.com`;
      });

      // Update Database Name, Kafka Topic, and QStash Queue
      setDbName(`redis-db${tagClean}`);
      setKafkaTopic(`topic-events-${tagClean}`);
      setQstashQueue(`queue-task-${tagClean}`);
    } else {
      setDbName("redis-db");
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/v1/automate/status");
      if (!res.ok) return;
      const resData = await res.json();
      const data = resData.data || resData;

      setTaskStatus(data.status);
      if (data.step) setTaskStep(data.step);
      if (data.checkpointsCompleted && Array.isArray(data.checkpointsCompleted)) {
        setCheckpointsCompleted(data.checkpointsCompleted);
      }
      if (data.logs && Array.isArray(data.logs)) {
        setLogs(data.logs);
      }
      if (data.copiedStrings && Array.isArray(data.copiedStrings)) {
        setCopiedStrings(data.copiedStrings);
      }
      if (data.interceptedUrls && Array.isArray(data.interceptedUrls)) {
        setInterceptedUrls(data.interceptedUrls);
      }
      if (data.returnedData) {
        setReturnedData(data.returnedData);
      }

      if (data.status === "WAITING_FOR_OTP") {
        setOtpAttempt(data.otpAttempt || 1);
        setMaxOtpAttempts(data.maxOtpAttempts || 3);
        setOtpError(data.otpError || "");
      }

      if (data.status === "SUCCESS") {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        loadDatabases();
      } else if (data.status === "FAILED" || data.status === "STOPPED") {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      }
    } catch (err) {
      console.error("Poll status error:", err);
    }
  };

  useEffect(() => {
    fetchStatus();
    pollIntervalRef.current = setInterval(fetchStatus, 1500);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [logs]);

  // Terminal Height Dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingHeight) {
        setTerminalHeight((prev) => Math.max(220, Math.min(750, prev - e.movementY)));
      }
    };
    const handleMouseUp = () => setIsResizingHeight(false);

    if (isResizingHeight) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingHeight]);

  const handleStartAutomation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !dbName) {
      showToast("Please fill in email, password, and target resource name.", "warn");
      return;
    }

    try {
      const res = await fetch("/api/v1/automate/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, dbName, targetType, kafkaTopic, qstashQueue, vectorMetric }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Automation initialized for target: ${targetType.toUpperCase()}`, "success");
        setLogs([]);
        setTaskStatus("RUNNING");
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = setInterval(fetchStatus, 1500);
      } else {
        showToast(data.message || data.error || "Failed to start automation.", "error");
      }
    } catch (err) {
      showToast("Network error starting automation engine.", "error");
    }
  };

  const handleStopAutomation = async () => {
    try {
      const res = await fetch("/api/v1/automate/stop", { method: "POST" });
      if (res.ok) {
        showToast("Automation execution halted.", "info");
        setTaskStatus("STOPPED");
      } else {
        showToast("Failed to stop execution.", "error");
      }
    } catch (err) {
      showToast("Network error stopping automation.", "error");
    }
  };

  const handleSubmitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 6) {
      showToast("Please enter a valid 6-digit OTP code.", "warn");
      return;
    }

    setIsSubmittingOtp(true);
    try {
      const res = await fetch("/api/v1/automate/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: otpCode.trim() }),
      });
      if (res.ok) {
        showToast("OTP verification token submitted!", "success");
        setOtpCode("");
        setOtpError("");
      } else {
        const data = await res.json();
        showToast(data.message || data.error || "OTP verification failed.", "error");
      }
    } catch (err) {
      showToast("Error submitting OTP token.", "error");
    } finally {
      setIsSubmittingOtp(false);
    }
  };

  // Schema format payload for preview
  const getSchemaSample = () => {
    switch (targetType) {
      case "redis":
        return {
          target: "Upstash Redis Cluster",
          extracted_fields: ["ENDPOINT", "PORT", "PASSWORD", "REST_URL", "REST_TOKEN", "READ_ONLY_REST_TOKEN"],
          connection_format: `rediss://default:<password>@${dbName}.upstash.io:6379`,
          rest_api: `https://${dbName}.upstash.io`
        };
      case "kafka":
        return {
          target: "Upstash Kafka Cluster",
          extracted_fields: ["BROKER_URL", "SASL_USERNAME", "SASL_PASSWORD", "TOPIC_NAME", "REST_CONSUMER_URL"],
          topic: kafkaTopic,
          partitions: kafkaPartitions,
          retention: "604800s (7 days)"
        };
      case "qstash":
        return {
          target: "Upstash QStash Queue",
          extracted_fields: ["QSTASH_TOKEN", "CURRENT_SIGNING_KEY", "NEXT_SIGNING_KEY", "QUEUE_URL"],
          queue_name: qstashQueue,
          rate_limit: "100 msgs/sec"
        };
      case "vector":
        return {
          target: "Upstash Vector Index",
          extracted_fields: ["VECTOR_REST_URL", "VECTOR_REST_TOKEN", "READ_ONLY_TOKEN", "INDEX_DIMENSIONS"],
          dimensions: vectorDimensions,
          metric: vectorMetric.toUpperCase()
        };
      case "web_scraper":
        return {
          target: "Custom Web DOM & API Scraper",
          extracted_fields: ["TITLE", "META_TAGS", "OPEN_GRAPH", "MATCHED_SELECTORS", "JSON_PAYLOADS"],
          target_url: webTargetUrl,
          css_selector: webCssSelector
        };
    }
  };

  const copySchemaJson = () => {
    navigator.clipboard.writeText(JSON.stringify(getSchemaSample(), null, 2));
    setCopiedSchema(true);
    showToast("Scrapable schema copied to clipboard!", "success");
    setTimeout(() => setCopiedSchema(false), 2000);
  };

  const isRunning = taskStatus === "RUNNING" || taskStatus === "WAITING_FOR_OTP";

  const leftFormPanel = (
    <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h2 className="text-lg font-extrabold text-white">Automated Provisioner & Scraper</h2>
          <p className="text-xs text-slate-400 mt-0.5">Select a target scrapable resource and execute automated signup/provisioning.</p>
        </div>
        <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/30">
          Puppeteer Engine
        </span>
      </div>

      {/* Target Scrapable Entity Selector */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-300">Select Scrapable Target Type</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { id: "redis", label: "Redis DB", icon: Database, color: "text-rose-400 border-rose-500/30 bg-rose-500/10" },
            { id: "kafka", label: "Kafka Cluster", icon: Radio, color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" },
            { id: "qstash", label: "QStash Queue", icon: Layers, color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
            { id: "vector", label: "Vector Index", icon: Sparkles, color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
            { id: "web_scraper", label: "Web Scraper", icon: Globe, color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
          ].map((t) => {
            const IconComp = t.icon;
            const isSelected = targetType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTargetType(t.id as ScrapableTargetType)}
                className={`p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all ${isSelected
                  ? `${t.color} ring-2 ring-cyan-400/50 scale-[1.02]`
                  : "bg-slate-950/40 border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
                  }`}
              >
                <IconComp className="w-4 h-4" />
                <span className="text-xs font-bold">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleStartAutomation} className="space-y-4">
        {/* Account Tag */}
        <div className="space-y-1.5">
          <label htmlFor="keyTag" className="block text-xs font-bold text-slate-300">
            Account Tag / Number
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              id="keyTag"
              value={keyTag}
              onChange={handleKeyTagChange}
              placeholder="e.g. 2514567, dev1"
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono transition-all"
            />
            <button
              type="button"
              onClick={() => handleCopyField(keyTag, "Account Tag")}
              className="absolute right-2 text-slate-400 hover:text-cyan-400 p-1.5 rounded-lg hover:bg-white/10 transition-all"
              title="Copy Account Tag"
            >
              {copiedField === "Account Tag" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <span className="text-[11px] text-slate-500 block">Auto-generates unique email alias and resource identifiers</span>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-xs font-bold text-slate-300">
            Account Email *
          </label>
          <div className="relative flex items-center">
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
            />
            <button
              type="button"
              onClick={() => handleCopyField(email, "Account Email")}
              className="absolute right-2 text-slate-400 hover:text-cyan-400 p-1.5 rounded-lg hover:bg-white/10 transition-all"
              title="Copy Account Email"
            >
              {copiedField === "Account Email" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-xs font-bold text-slate-300">
            Account Password *
          </label>
          <div className="relative flex items-center">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-4 pr-16 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
            />
            <div className="absolute right-2 flex items-center gap-1">
              <button
                type="button"
                className="p-1.5 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-white/10 transition-all"
                onClick={() => handleCopyField(password, "Account Password")}
                title="Copy Password"
              >
                {copiedField === "Account Password" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-all"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
                title="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Target Dynamic Options */}
        {targetType === "redis" && (
          <div className="space-y-1.5">
            <label htmlFor="dbName" className="block text-xs font-bold text-slate-300">
              Database Name *
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                id="dbName"
                value={dbName}
                onChange={(e) => setDbName(e.target.value)}
                required
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono transition-all"
              />
              <button
                type="button"
                onClick={() => handleCopyField(dbName, "Database Name")}
                className="absolute right-2 text-slate-400 hover:text-cyan-400 p-1.5 rounded-lg hover:bg-white/10 transition-all"
                title="Copy Database Name"
              >
                {copiedField === "Database Name" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}

        {targetType === "kafka" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">Topic Name</label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={kafkaTopic}
                  onChange={(e) => setKafkaTopic(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-3 pr-9 py-2 text-xs text-white font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleCopyField(kafkaTopic, "Kafka Topic")}
                  className="absolute right-1.5 text-slate-400 hover:text-cyan-400 p-1 rounded-lg hover:bg-white/10 transition-all"
                  title="Copy Topic Name"
                >
                  {copiedField === "Kafka Topic" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">Partitions</label>
              <input
                type="number"
                value={kafkaPartitions}
                onChange={(e) => setKafkaPartitions(Number(e.target.value))}
                min={1}
                max={10}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>
          </div>
        )}

        {targetType === "qstash" && (
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">QStash Queue Name</label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={qstashQueue}
                onChange={(e) => setQstashQueue(e.target.value)}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-xs text-white font-mono"
              />
              <button
                type="button"
                onClick={() => handleCopyField(qstashQueue, "QStash Queue")}
                className="absolute right-2 text-slate-400 hover:text-cyan-400 p-1.5 rounded-lg hover:bg-white/10 transition-all"
                title="Copy Queue Name"
              >
                {copiedField === "QStash Queue" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}

        {targetType === "vector" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">Distance Metric</label>
              <select
                value={vectorMetric}
                onChange={(e) => setVectorMetric(e.target.value)}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="cosine">Cosine</option>
                <option value="euclidean">Euclidean</option>
                <option value="dot_product">Dot Product</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">Dimensions</label>
              <select
                value={vectorDimensions}
                onChange={(e) => setVectorDimensions(Number(e.target.value))}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value={1536}>1536 (OpenAI)</option>
                <option value={768}>768 (Bert/Jina)</option>
                <option value={384}>384 (MiniLM)</option>
              </select>
            </div>
          </div>
        )}

        {targetType === "web_scraper" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">Target Web URL</label>
              <div className="relative flex items-center">
                <input
                  type="url"
                  value={webTargetUrl}
                  onChange={(e) => setWebTargetUrl(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-4 pr-10 py-2 text-xs text-white font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleCopyField(webTargetUrl, "Target URL")}
                  className="absolute right-2 text-slate-400 hover:text-cyan-400 p-1.5 rounded-lg hover:bg-white/10 transition-all"
                  title="Copy Target URL"
                >
                  {copiedField === "Target URL" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">DOM CSS Selector</label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={webCssSelector}
                  onChange={(e) => setWebCssSelector(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-4 pr-10 py-2 text-xs text-white font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleCopyField(webCssSelector, "CSS Selector")}
                  className="absolute right-2 text-slate-400 hover:text-cyan-400 p-1.5 rounded-lg hover:bg-white/10 transition-all"
                  title="Copy CSS Selector"
                >
                  {copiedField === "CSS Selector" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="glow-btn-primary flex-1 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
            disabled={isRunning}
          >
            <Play className="w-4 h-4" />
            <span>{isRunning ? "Engine Automating Target..." : `Start Scraping ${targetType.toUpperCase()}`}</span>
          </button>

          {isRunning && (
            <button
              type="button"
              className="px-4 py-3 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 transition-all flex items-center justify-center gap-2"
              onClick={handleStopAutomation}
            >
              <Square className="w-4 h-4" />
              <span>Stop</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );

  const rightTerminalPanel = (
    <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-4 flex flex-col justify-between h-full">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h2 className="text-lg font-extrabold text-white">Live Engine Terminal Output</h2>
          <span className="text-[11px] text-slate-400">Drag middle handle to resize left/right panels horizontally</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all flex items-center gap-1.5"
            onClick={() => {
              if (logs.length === 0) return;
              navigator.clipboard.writeText(logs.join("\n"));
              showToast("Console logs copied to clipboard!", "success");
            }}
            title="Copy all terminal logs"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy Logs</span>
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center gap-1.5"
            onClick={() => setLogs([])}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Console</span>
          </button>
        </div>
      </div>

      {/* 8-Step Checkpoints Tracker */}
      <div className="bg-slate-950/80 border border-white/10 rounded-2xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Provisioning Checkpoints Progression</span>
          </span>
          <span className="text-[10px] font-mono text-cyan-400 font-bold bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/30">
            Step {taskStep}/8 ({checkpointsCompleted.length || (taskStatus === "SUCCESS" ? 8 : 0)} Checkpoints)
          </span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
          {[
            { num: 1, label: "Browser" },
            { num: 2, label: "Navigate" },
            { num: 3, label: "Sign Up" },
            { num: 4, label: "OTP" },
            { num: 5, label: "Dashboard" },
            { num: 6, label: "Hydrate" },
            { num: 7, label: "Modal" },
            { num: 8, label: "Extract" },
          ].map((s) => {
            const isCompleted = checkpointsCompleted.includes(s.num) || taskStep > s.num || taskStatus === "SUCCESS";
            const isCurrent = taskStep === s.num && taskStatus === "RUNNING";
            return (
              <div
                key={s.num}
                className={`p-1.5 rounded-xl border text-center flex flex-col items-center justify-center transition-all ${
                  isCompleted
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : isCurrent
                    ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 animate-pulse ring-1 ring-cyan-400/50"
                    : "bg-slate-900/60 border-white/5 text-slate-500"
                }`}
              >
                <div className="flex items-center gap-1">
                  {isCompleted ? <Check className="w-3 h-3 text-emerald-400" /> : <span className="text-[10px] font-mono font-bold">{s.num}</span>}
                </div>
                <span className="text-[9px] font-medium leading-tight mt-0.5">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scrapable Schema Preview Box */}
      <div className="bg-slate-950/60 border border-cyan-500/20 rounded-2xl p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold">
            <Code2 className="w-4 h-4" />
            <span>Extracted Scrapable Schema Preview</span>
          </div>
          <button
            type="button"
            onClick={copySchemaJson}
            className="text-[11px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all"
          >
            {copiedSchema ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copiedSchema ? "Copied" : "Copy JSON"}</span>
          </button>
        </div>
        <pre className="text-[11px] font-mono text-slate-300 bg-slate-950 p-2.5 rounded-xl overflow-x-auto max-h-28 border border-white/5">
          {JSON.stringify(getSchemaSample(), null, 2)}
        </pre>
      </div>

      {/* Sub-Navigation Tabs for Real-Time Inspection */}
      <div className="flex items-center gap-1 bg-slate-950/80 p-1.5 rounded-2xl border border-white/10 overflow-x-auto">
        <button
          type="button"
          onClick={() => setInspectionTab("logs")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            inspectionTab === "logs"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <span>Logs ({logs.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setInspectionTab("copied")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            inspectionTab === "copied"
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <span>Copied Data ({copiedStrings.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setInspectionTab("urls")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            inspectionTab === "urls"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <span>Fetched URLs ({interceptedUrls.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setInspectionTab("returned")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            inspectionTab === "returned"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <span>Returned Data</span>
        </button>
      </div>

      {/* Terminal Console / Inspection Display with Resizable Height handle */}
      <div
        className="bg-slate-950 border border-white/10 rounded-2xl overflow-hidden flex flex-col relative transition-all"
        style={{ height: `${terminalHeight}px` }}
      >
        <div className="bg-slate-900/80 px-4 py-2 border-b border-white/10 flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-400">
            {inspectionTab === "logs" && "puppeteer@upstash-scraper ~ logs"}
            {inspectionTab === "copied" && "puppeteer@upstash-scraper ~ copied-strings"}
            {inspectionTab === "urls" && "puppeteer@upstash-scraper ~ intercepted-urls"}
            {inspectionTab === "returned" && "puppeteer@upstash-scraper ~ returned-payload"}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-500">Height: {terminalHeight}px</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
            </div>
          </div>
        </div>

        <div
          className="p-4 font-mono text-xs leading-relaxed space-y-1 overflow-y-auto flex-1 select-text"
          style={{ userSelect: "text", WebkitUserSelect: "text" }}
          ref={terminalBodyRef}
        >
          {inspectionTab === "logs" && (
            logs.length === 0 ? (
              <div className="text-slate-500 select-text">
                [Engine Ready] Select a scrapable target and click "Start Scraping" to initialize headless execution...
              </div>
            ) : (
              logs.map((line, i) => {
                let cls = "text-slate-300 select-text";
                if (line.includes("[SUCCESS]") || line.includes("SUCCESS") || line.includes("COMPLETE")) cls = "text-emerald-400 font-semibold select-text";
                else if (line.includes("[ERROR]") || line.includes("Error") || line.includes("FAILED")) cls = "text-rose-400 font-semibold select-text";
                else if (line.includes("[WARN]") || line.includes("[ACTION REQUIRED]") || line.includes("WARNING")) cls = "text-amber-400 font-semibold select-text";

                return (
                  <div key={i} className={cls} style={{ userSelect: "text", WebkitUserSelect: "text" }}>
                    {line}
                  </div>
                );
              })
            )
          )}

          {inspectionTab === "copied" && (
            copiedStrings.length === 0 ? (
              <div className="text-slate-500 select-text">No strings copied or extracted to clipboard yet.</div>
            ) : (
              copiedStrings.map((str, idx) => (
                <div key={idx} className="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-xl border border-white/5 gap-2">
                  <span className="text-purple-300 font-mono text-xs truncate select-text">{str}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(str);
                      showToast("Copied string to clipboard!", "success");
                    }}
                    className="text-[10px] font-mono text-purple-400 hover:text-white px-2 py-1 bg-purple-500/10 rounded-lg border border-purple-500/20"
                  >
                    Copy
                  </button>
                </div>
              ))
            )
          )}

          {inspectionTab === "urls" && (
            interceptedUrls.length === 0 ? (
              <div className="text-slate-500 select-text">No URLs intercepted during execution yet.</div>
            ) : (
              interceptedUrls.map((item, idx) => {
                const u = typeof item === "string" ? item : item.url;
                const status = typeof item === "object" ? item.status : 200;
                const ts = typeof item === "object" ? item.timestamp : "";

                return (
                  <div key={idx} className="flex items-center justify-between bg-slate-900/60 p-2 rounded-xl border border-white/5 text-[11px] gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${status === 200 ? "bg-emerald-500/20 text-emerald-400" : "bg-cyan-500/20 text-cyan-400"}`}>
                        {status || 200}
                      </span>
                      <a href={u} target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline truncate select-text">
                        {u}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      {ts && <span className="text-slate-500 text-[10px]">{ts}</span>}
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(u);
                          showToast("Copied URL to clipboard!", "success");
                        }}
                        className="text-[10px] text-cyan-400 hover:text-white px-2 py-0.5 bg-cyan-500/10 rounded border border-cyan-500/20"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                );
              })
            )
          )}

          {inspectionTab === "returned" && (
            !returnedData ? (
              <div className="text-slate-500 select-text">Automation run has not completed or returned payload yet.</div>
            ) : (
              <pre className="text-amber-300 bg-slate-950 p-3 rounded-xl border border-amber-500/20 text-[11px] font-mono select-text overflow-x-auto">
                {JSON.stringify(returnedData, null, 2)}
              </pre>
            )
          )}
        </div>

        {/* Vertical Resize Drag Handle for Terminal Height */}
        <div
          onMouseDown={() => setIsResizingHeight(true)}
          className="h-3 bg-slate-900/90 border-t border-white/10 hover:bg-cyan-500/20 cursor-ns-resize flex items-center justify-center transition-colors group"
          title="Drag vertically to adjust terminal height"
        >
          <GripHorizontal className="w-4 h-3 text-slate-500 group-hover:text-cyan-400" />
        </div>
      </div>

      {/* OTP Verification Banner */}
      {taskStatus === "WAITING_FOR_OTP" && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-2">
              <KeyRound className="w-4 h-4" />
              Email Verification Code Required
            </span>
            <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-md">
              Attempt {otpAttempt} of {maxOtpAttempts}
            </span>
          </div>

          {otpError && (
            <div className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              <span>{otpError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitOtp} className="flex gap-2">
            <div className="relative flex-1 flex items-center">
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Enter 6-digit OTP code"
                maxLength={6}
                className="w-full bg-slate-950 border border-white/10 rounded-xl pl-4 pr-10 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                required
                autoFocus
              />
              {otpCode && (
                <button
                  type="button"
                  onClick={() => handleCopyField(otpCode, "OTP Code")}
                  className="absolute right-2 text-slate-400 hover:text-amber-400 p-1 rounded-lg hover:bg-white/10 transition-all"
                  title="Copy OTP Code"
                >
                  {copiedField === "OTP Code" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            <button
              type="submit"
              className="glow-btn-primary px-4 py-2 rounded-xl text-xs font-bold"
              disabled={isSubmittingOtp}
            >
              {isSubmittingOtp ? "Submitting..." : "Submit Code"}
            </button>
          </form>
        </div>
      )}
    </div>
  );

  return (
    <section className="animate-slide-in space-y-6">
      <ResizableSplitPanel left={leftFormPanel} right={rightTerminalPanel} initialLeftWidthPercent={42} />
    </section>
  );
}
