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

export default function ProvisionerTab({ showToast, loadDatabases }: ProvisionerTabProps) {
  // Target Type State
  const [targetType, setTargetType] = useState<ScrapableTargetType>("redis");

  // Account & Form State
  const [keyTag, setKeyTag] = useState(() => Date.now().toString().slice(-4));
  const [email, setEmail] = useState(`nisanisready+${keyTag}@gmail.com`);
  const [password, setPassword] = useState("Qwertyui12345678@dreamupstash");
  const [dbName, setDbName] = useState(`redis-db${keyTag}`);
  const [showPassword, setShowPassword] = useState(false);

  // Target-specific Extended State
  const [kafkaTopic, setKafkaTopic] = useState(`topic-events-${keyTag}`);
  const [kafkaPartitions, setKafkaPartitions] = useState(3);
  const [qstashQueue, setQstashQueue] = useState(`queue-task-${keyTag}`);
  const [vectorMetric, setVectorMetric] = useState("cosine");
  const [vectorDimensions, setVectorDimensions] = useState(1536);
  const [webTargetUrl, setWebTargetUrl] = useState("https://upstash.com/docs");
  const [webCssSelector, setWebCssSelector] = useState(".docs-content code");

  // Terminal & Resizing State
  const [terminalHeight, setTerminalHeight] = useState(380);
  const [isResizingHeight, setIsResizingHeight] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);

  // Engine Execution State
  const [taskStatus, setTaskStatus] = useState<string>("IDLE");
  const [logs, setLogs] = useState<string[]>([]);
  const [otpCode, setOtpCode] = useState("");
  const [otpAttempt, setOtpAttempt] = useState(1);
  const [maxOtpAttempts, setMaxOtpAttempts] = useState(3);
  const [otpError, setOtpError] = useState("");
  const [isSubmittingOtp, setIsSubmittingOtp] = useState(false);

  const terminalBodyRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleKeyTagChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tag = e.target.value.trim();
    setKeyTag(tag);
    if (tag) {
      setEmail((prev) => {
        if (prev.includes("+")) return prev.replace(/\+[^@]*@/, `+${tag}@`);
        if (prev.includes("@")) {
          const parts = prev.split("@");
          return `${parts[0]}+${tag}@${parts[1]}`;
        }
        return `nisanisready+${tag}@gmail.com`;
      });
      setDbName(`redis-db${tag}`);
      setKafkaTopic(`topic-events-${tag}`);
      setQstashQueue(`queue-task-${tag}`);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/v1/automate/status");
      if (!res.ok) return;
      const resData = await res.json();
      const data = resData.data || resData;

      setTaskStatus(data.status);
      if (data.logs && Array.isArray(data.logs)) {
        setLogs(data.logs);
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
                className={`p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all ${
                  isSelected
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
          <input
            type="text"
            id="keyTag"
            value={keyTag}
            onChange={handleKeyTagChange}
            placeholder="e.g. 7, 8, dev1"
            className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono transition-all"
          />
          <span className="text-[11px] text-slate-500 block">Auto-generates unique email alias and resource identifiers</span>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-xs font-bold text-slate-300">
            Account Email *
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-xs font-bold text-slate-300">
            Account Password *
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
            />
            <button
              type="button"
              className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
              onClick={() => setShowPassword(!showPassword)}
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Target Dynamic Options */}
        {targetType === "redis" && (
          <div className="space-y-1.5">
            <label htmlFor="dbName" className="block text-xs font-bold text-slate-300">
              Database Name *
            </label>
            <input
              type="text"
              id="dbName"
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              required
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono transition-all"
            />
          </div>
        )}

        {targetType === "kafka" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">Topic Name</label>
              <input
                type="text"
                value={kafkaTopic}
                onChange={(e) => setKafkaTopic(e.target.value)}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
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
            <input
              type="text"
              value={qstashQueue}
              onChange={(e) => setQstashQueue(e.target.value)}
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono"
            />
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
              <input
                type="url"
                value={webTargetUrl}
                onChange={(e) => setWebTargetUrl(e.target.value)}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2 text-xs text-white font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">DOM CSS Selector</label>
              <input
                type="text"
                value={webCssSelector}
                onChange={(e) => setWebCssSelector(e.target.value)}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2 text-xs text-white font-mono"
              />
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
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center gap-1.5"
            onClick={() => setLogs([])}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Console</span>
          </button>
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

      {/* Terminal Console with Resizable Height handle */}
      <div
        className="bg-slate-950 border border-white/10 rounded-2xl overflow-hidden flex flex-col relative transition-all"
        style={{ height: `${terminalHeight}px` }}
      >
        <div className="bg-slate-900/80 px-4 py-2 border-b border-white/10 flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-400">puppeteer@upstash-scraper ~ bash</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-500">Height: {terminalHeight}px</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
            </div>
          </div>
        </div>

        <div className="p-4 font-mono text-xs leading-relaxed space-y-1 overflow-y-auto flex-1" ref={terminalBodyRef}>
          {logs.length === 0 ? (
            <div className="text-slate-500">
              [Engine Ready] Select a scrapable target and click "Start Scraping" to initialize headless execution...
            </div>
          ) : (
            logs.map((line, i) => {
              let cls = "text-slate-300";
              if (line.includes("[SUCCESS]") || line.includes("SUCCESS") || line.includes("COMPLETE")) cls = "text-emerald-400 font-semibold";
              else if (line.includes("[ERROR]") || line.includes("Error") || line.includes("FAILED")) cls = "text-rose-400 font-semibold";
              else if (line.includes("[WARN]") || line.includes("[ACTION REQUIRED]") || line.includes("WARNING")) cls = "text-amber-400 font-semibold";

              return (
                <div key={i} className={cls}>
                  {line}
                </div>
              );
            })
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
            <input
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="Enter 6-digit OTP code"
              maxLength={6}
              className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
              required
              autoFocus
            />
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
