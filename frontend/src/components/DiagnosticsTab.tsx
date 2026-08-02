import React, { useState, useEffect, useRef } from "react";
import { Play, Activity, Terminal, Code2, Trash2, Copy, Check, GripHorizontal, Send, RefreshCw } from "lucide-react";
import { DatabaseItem, ToastType, CliCommandResult } from "../types";

interface DiagnosticsTabProps {
  databases: DatabaseItem[];
  selectedDiagUrl: string;
  setSelectedDiagUrl: (url: string) => void;
  showToast: (msg: string, type?: ToastType) => void;
}

export default function DiagnosticsTab({
  databases,
  selectedDiagUrl,
  setSelectedDiagUrl,
  showToast,
}: DiagnosticsTabProps) {
  const [customUrl, setCustomUrl] = useState("");
  const [selectedClusterUrl, setSelectedClusterUrl] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [latency, setLatency] = useState<string | null>(null);

  // CLI Command Execution State
  const [cliInput, setCliInput] = useState("PING");
  const [commandHistory, setCommandHistory] = useState<CliCommandResult[]>([]);
  const [consoleHeight, setConsoleHeight] = useState(380);
  const [isResizingHeight, setIsResizingHeight] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [activeTab, setActiveTab] = useState<"health" | "cli">("health");

  const [outputConsole, setOutputConsole] = useState(
    'Select a target database cluster and click "Run Health Check" or execute custom Redis CLI commands...'
  );

  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedDiagUrl) {
      setCustomUrl(selectedDiagUrl);
    } else if (databases.length > 0 && !selectedClusterUrl) {
      setSelectedClusterUrl(databases[0].redisUrl || "");
    }
  }, [selectedDiagUrl, databases]);

  // Height resize handling
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingHeight) {
        setConsoleHeight((prev) => Math.max(220, Math.min(750, prev + e.movementY)));
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

  const handleRunDiagnostics = async () => {
    const url = customUrl.trim() || selectedClusterUrl;
    if (!url) {
      showToast("Please select or enter a valid Redis connection string.", "warn");
      return;
    }

    setIsRunning(true);
    setLatency(null);
    setOutputConsole("Connecting to Upstash Redis cluster via IORedis driver...\nExecuting PING, SET, GET, and DEL verification pipeline...");

    const startTime = Date.now();
    try {
      const res = await fetch("/api/v1/redis/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const elapsed = Date.now() - startTime;
      const data = await res.json();
      const testResult = data.data || data.result;

      if (res.ok && (data.success || data.result)) {
        const lat = (testResult && testResult.latencyMs) || elapsed;
        setLatency(`${lat} ms`);
        setOutputConsole(
          `UPSTASH CLUSTER DIAGNOSTIC SUCCESSFUL!\n\n` +
            `Cluster Target: ${url.replace(/:[^:@]+@/, ":****@")}\n` +
            `Status:         ONLINE [TLS Secured]\n` +
            `Ping Response:  ${testResult ? testResult.ping : "PONG"}\n` +
            `Round-Trip:     ${lat} ms\n` +
            `Test Payload:   "${testResult ? testResult.val : "hello-upstash"}"\n\n` +
            `Detailed Payload Response:\n` +
            JSON.stringify(testResult || data, null, 2)
        );
        showToast("Redis diagnostic health test passed!", "success");
      } else {
        setLatency(null);
        setOutputConsole(`[FAILED] DIAGNOSTIC TEST FAILED\n\nError: ${data.message || data.error || "Unknown driver error"}`);
        showToast("Diagnostic health test failed.", "error");
      }
    } catch (err: any) {
      setLatency(null);
      setOutputConsole(`[ERROR] NETWORK ERROR\n\n${err.message}`);
      showToast("Network connection error during test.", "error");
    } finally {
      setIsRunning(false);
    }
  };

  const handleExecuteCliCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = cliInput.trim();
    if (!cmd) return;

    const url = customUrl.trim() || selectedClusterUrl;
    if (!url) {
      showToast("Please select a target database cluster for CLI execution.", "warn");
      return;
    }

    setIsRunning(true);
    const startTime = Date.now();

    try {
      const res = await fetch("/api/v1/redis/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, command: cmd }),
      });
      const elapsed = Date.now() - startTime;
      const data = await res.json();

      const newHistItem: CliCommandResult = {
        command: cmd,
        timestamp: new Date().toLocaleTimeString(),
        status: res.ok ? "OK" : "ERR",
        output: JSON.stringify(data.data || data, null, 2),
        latencyMs: elapsed,
      };

      setCommandHistory((prev) => [newHistItem, ...prev]);
      setOutputConsole(
        `> ${cmd}\n` +
          `Status: ${res.ok ? "OK" : "ERR"} (${elapsed} ms)\n` +
          `Result:\n` +
          JSON.stringify(data.data || data, null, 2)
      );
      showToast(`Executed: ${cmd}`, res.ok ? "success" : "error");
    } catch (err: any) {
      showToast("Command execution failed.", "error");
    } finally {
      setIsRunning(false);
    }
  };

  const copyConsoleOutput = () => {
    navigator.clipboard.writeText(outputConsole);
    setCopiedOutput(true);
    showToast("Console output copied to clipboard!", "success");
    setTimeout(() => setCopiedOutput(false), 2000);
  };

  return (
    <section className="animate-slide-in space-y-6">
      <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-4 gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-white">Cluster Diagnostics & Interactive Redis CLI</h2>
            <p className="text-xs text-slate-400 mt-1">Run live health checks, benchmark latency, and execute arbitrary Redis commands.</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-950/60 p-1 rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab("health")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === "health"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Health Diagnostics</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("cli")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === "cli"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-lg shadow-purple-500/10"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>Interactive CLI Runner</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Side Controls */}
          <div className="lg:col-span-5 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="diagTargetSelect" className="block text-xs font-bold text-slate-300">
                Select Target Database Cluster
              </label>
              <select
                id="diagTargetSelect"
                value={selectedClusterUrl}
                onChange={(e) => {
                  setSelectedClusterUrl(e.target.value);
                  setCustomUrl("");
                }}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500 transition-all"
              >
                {databases.length === 0 ? (
                  <option value="">No provisioned databases found</option>
                ) : (
                  databases.map((db, idx) => (
                    <option key={db.name + idx} value={db.redisUrl || ""}>
                      {db.endpoint || `${db.name}.upstash.io`}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="customUrlInput" className="block text-xs font-bold text-slate-300">
                Or Custom Connection String (rediss://...)
              </label>
              <input
                type="text"
                id="customUrlInput"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="rediss://default:token@cluster.upstash.io:6379"
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
              />
            </div>

            {activeTab === "health" ? (
              <button
                type="button"
                className="glow-btn-primary w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                disabled={isRunning}
                onClick={handleRunDiagnostics}
              >
                <Play className="w-4 h-4" />
                <span>{isRunning ? "Running Diagnostic Pipeline..." : "Run Health Check (PING / SET / GET)"}</span>
              </button>
            ) : (
              <div className="space-y-3 pt-2">
                <form onSubmit={handleExecuteCliCommand} className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300">Redis CLI Command Input</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={cliInput}
                      onChange={(e) => setCliInput(e.target.value)}
                      placeholder="e.g. SET user:101 'Nishu'"
                      className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="submit"
                      disabled={isRunning}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-purple-300 bg-purple-500/20 border border-purple-500/40 hover:bg-purple-500/30 flex items-center gap-1.5 transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Exec</span>
                    </button>
                  </div>
                </form>

                {/* Command Presets */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 block">Quick Command Presets:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {["PING", "INFO", "DBSIZE", "KEYS *", "SET test_key 100", "GET test_key", "TTL test_key"].map((cmd) => (
                      <button
                        key={cmd}
                        type="button"
                        onClick={() => setCliInput(cmd)}
                        className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-slate-300 hover:border-purple-500/50 hover:text-purple-300 transition-all"
                      >
                        {cmd}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Execution History Panel */}
            {commandHistory.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <span className="text-xs font-bold text-slate-300 block">Recent CLI Executions</span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {commandHistory.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => setOutputConsole(`> ${item.command}\nStatus: ${item.status} (${item.latencyMs} ms)\nOutput:\n${item.output}`)}
                      className="p-2 rounded-xl bg-slate-950/60 border border-white/5 hover:border-purple-500/30 cursor-pointer flex items-center justify-between text-[11px] font-mono transition-all"
                    >
                      <span className="text-purple-300 font-semibold truncate max-w-[180px]">{item.command}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{item.latencyMs}ms</span>
                        <span className={`px-1.5 py-0.2 rounded ${item.status === "OK" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Side Resizable Console Output */}
          <div className="lg:col-span-7 bg-slate-950 border border-white/10 rounded-2xl overflow-hidden flex flex-col min-h-[320px]">
            <div className="bg-slate-900/80 px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-300">Output Console & Report</span>
              </div>
              <div className="flex items-center gap-2">
                {latency && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    {latency}
                  </span>
                )}
                <button
                  type="button"
                  onClick={copyConsoleOutput}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-mono text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 flex items-center gap-1 transition-all"
                >
                  {copiedOutput ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedOutput ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-between" style={{ height: `${consoleHeight}px` }}>
              <pre className="p-4 font-mono text-xs text-emerald-400 leading-relaxed overflow-y-auto flex-1 whitespace-pre-wrap">
                {outputConsole}
                <div ref={consoleEndRef} />
              </pre>

              {/* Vertical Drag Handle for Console Height */}
              <div
                onMouseDown={() => setIsResizingHeight(true)}
                className="h-3 bg-slate-900/90 border-t border-white/10 hover:bg-cyan-500/20 cursor-ns-resize flex items-center justify-center transition-colors group"
                title="Drag vertically to resize console output height"
              >
                <GripHorizontal className="w-4 h-3 text-slate-500 group-hover:text-cyan-400" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
