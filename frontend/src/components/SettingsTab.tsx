import React, { useState } from "react";
import {
  ShieldCheck,
  RefreshCw,
  Terminal,
  CheckCircle2,
  Sliders,
  Cpu,
  Download,
  FileJson,
  FileSpreadsheet,
  Globe,
  Lock,
  Flame,
  Zap
} from "lucide-react";
import { ToastType, DatabaseItem, ShaderSettings, EngineSettings } from "../types";

interface SettingsTabProps {
  showToast: (msg: string, type?: ToastType) => void;
  databases: DatabaseItem[];
  shaderSettings: ShaderSettings;
  setShaderSettings: React.Dispatch<React.SetStateAction<ShaderSettings>>;
  engineSettings: EngineSettings;
  setEngineSettings: React.Dispatch<React.SetStateAction<EngineSettings>>;
}

export default function SettingsTab({
  showToast,
  databases,
  shaderSettings,
  setShaderSettings,
  engineSettings,
  setEngineSettings,
}: SettingsTabProps) {

  const handlePurgeCache = () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
        if ("caches" in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name));
          });
        }
      }
      showToast("Stale build assets & browser cache purged!", "success");
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      showToast("Failed to clear browser cache.", "error");
    }
  };

  const handleExportEnv = () => {
    if (databases.length === 0) {
      showToast("No database configurations available to export.", "warn");
      return;
    }

    let envContent = `# UPSTASH CLUSTER ENVIRONMENT CONFIGURATIONS\n# Generated: ${new Date().toISOString()}\n\n`;
    databases.forEach((db, i) => {
      envContent += `# --- Database ${i + 1}: ${db.name} ---\n`;
      envContent += `UPSTASH_REDIS_${i + 1}_REST_URL="${db.restUrl}"\n`;
      envContent += `UPSTASH_REDIS_${i + 1}_REST_TOKEN="${db.restToken}"\n`;
      envContent += `UPSTASH_REDIS_${i + 1}_URL="${db.redisUrl}"\n\n`;
    });

    const blob = new Blob([envContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ".env.upstash";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Downloaded .env.upstash file!", "success");
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(databases, null, 2));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = "upstash-databases-backup.json";
    a.click();
    showToast("Exported database list as JSON!", "success");
  };

  const handleExportCsv = () => {
    if (databases.length === 0) {
      showToast("No databases to export.", "warn");
      return;
    }
    const headers = ["Name", "Endpoint", "Port", "Region", "REST_URL", "REST_Token", "Redis_URL"];
    const rows = databases.map((d) => [
      d.name,
      d.endpoint,
      d.port,
      d.region || "us-east-1",
      d.restUrl,
      d.restToken,
      d.redisUrl,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const a = document.createElement("a");
    a.href = encodedUri;
    a.download = "upstash-clusters-telemetry.csv";
    a.click();
    showToast("Exported clusters telemetry as CSV!", "success");
  };

  return (
    <section className="space-y-6 animate-slide-in">
      <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-8">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-extrabold text-white">System, Shader & Automation Settings</h2>
            <p className="text-xs text-slate-400 mt-1">Configure WebGL background shaders, scraper worker threads, environment exports, and security headers.</p>
          </div>
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
            TLS & Helmet Secured
          </span>
        </div>

        {/* Grid Section 1: Shader Customizer & Engine Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* WebGL Shader Controls */}
          <div className="glass-card rounded-2xl p-6 space-y-4 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">WebGL Shader Customizer</h3>
                <p className="text-xs text-slate-400">Adjust background animation parameters live.</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {/* Theme Palette Switcher */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">Shader Color Palette</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "cyber", name: "Cyber", color: "from-cyan-500 to-purple-600" },
                    { id: "neon", name: "Neon", color: "from-purple-500 to-pink-500" },
                    { id: "matrix", name: "Matrix", color: "from-emerald-500 to-teal-500" },
                    { id: "gold", name: "Gold", color: "from-amber-500 to-rose-500" },
                  ].map((thm) => (
                    <button
                      key={thm.id}
                      type="button"
                      onClick={() => setShaderSettings((prev) => ({ ...prev, theme: thm.id as any }))}
                      className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 ${
                        shaderSettings.theme === thm.id
                          ? "border-cyan-400 bg-cyan-500/20 text-white shadow-lg shadow-cyan-500/20"
                          : "border-white/10 bg-slate-950/60 text-slate-400 hover:text-white"
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full bg-gradient-to-r ${thm.color}`}></span>
                      <span>{thm.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Speed Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Shader Motion Speed:</span>
                  <span className="text-cyan-400 font-bold">{shaderSettings.speed.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  value={shaderSettings.speed}
                  onChange={(e) => setShaderSettings((prev) => ({ ...prev, speed: parseFloat(e.target.value) }))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Glow Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Background Glow:</span>
                  <span className="text-purple-400 font-bold">{shaderSettings.glow.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={shaderSettings.glow}
                  onChange={(e) => setShaderSettings((prev) => ({ ...prev, glow: parseFloat(e.target.value) }))}
                  className="w-full accent-purple-400 cursor-pointer"
                />
              </div>

              {/* Density Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Streak Density:</span>
                  <span className="text-emerald-400 font-bold">{shaderSettings.density.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={shaderSettings.density}
                  onChange={(e) => setShaderSettings((prev) => ({ ...prev, density: parseFloat(e.target.value) }))}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Automation Engine Settings */}
          <div className="glass-card rounded-2xl p-6 space-y-4 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Automator Engine Parameters</h3>
                <p className="text-xs text-slate-400">Headless scraper & worker concurrency config.</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {/* User Agent Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">Scraper User-Agent Header</label>
                <select
                  value={engineSettings.userAgent}
                  onChange={(e) => setEngineSettings((prev) => ({ ...prev, userAgent: e.target.value }))}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="Chrome-Headless-132">Chrome Headless v132 (Linux x86_64)</option>
                  <option value="Firefox-Quantum-Automation">Firefox Quantum Automation v128</option>
                  <option value="Edge-Chromium-Bot">Edge Chromium Automation v131</option>
                  <option value="Custom-Upstash-Bot">Custom Upstash Scraper Bot</option>
                </select>
              </div>

              {/* Concurrency Threads */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Max Worker Threads:</span>
                  <span className="text-purple-400 font-bold">{engineSettings.concurrency} threads</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="1"
                  value={engineSettings.concurrency}
                  onChange={(e) => setEngineSettings((prev) => ({ ...prev, concurrency: parseInt(e.target.value, 10) }))}
                  className="w-full accent-purple-400 cursor-pointer"
                />
              </div>

              {/* Timeout Sec */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Request Timeout Limit:</span>
                  <span className="text-amber-400 font-bold">{engineSettings.timeoutSec}s</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={engineSettings.timeoutSec}
                  onChange={(e) => setEngineSettings((prev) => ({ ...prev, timeoutSec: parseInt(e.target.value, 10) }))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              {/* Proxy Rotation Toggle */}
              <div className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-xl border border-white/10">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-slate-300">Proxy IP Masking & Rotation</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEngineSettings((prev) => ({ ...prev, proxyRotation: !prev.proxyRotation }))}
                  className={`w-10 h-5 rounded-full transition-all relative ${
                    engineSettings.proxyRotation ? "bg-cyan-500" : "bg-slate-800"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${
                      engineSettings.proxyRotation ? "left-5" : "left-0.5"
                    }`}
                  ></span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Data Export & Backup Hub */}
        <div className="glass-card rounded-2xl p-6 space-y-4 border border-white/10">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Cluster Data Export & Backup Hub</h3>
                <p className="text-xs text-slate-400">Export environment variables, JSON database backups, and CSV telemetry logs.</p>
              </div>
            </div>
            <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/30">
              {databases.length} Database Clusters
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <button
              type="button"
              onClick={handleExportEnv}
              className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 hover:border-emerald-500/40 text-left space-y-2 group transition-all"
            >
              <div className="flex items-center justify-between text-emerald-400">
                <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-mono bg-emerald-500/20 px-2 py-0.5 rounded">.env</span>
              </div>
              <h4 className="text-xs font-extrabold text-white">Export `.env.upstash`</h4>
              <p className="text-[11px] text-slate-400 leading-normal">Generate ready-to-use environment variables for Node.js backend.</p>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 hover:border-cyan-500/40 text-left space-y-2 group transition-all"
            >
              <div className="flex items-center justify-between text-cyan-400">
                <FileJson className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-mono bg-cyan-500/20 px-2 py-0.5 rounded">JSON</span>
              </div>
              <h4 className="text-xs font-extrabold text-white">Backup Cluster JSON</h4>
              <p className="text-[11px] text-slate-400 leading-normal">Full JSON metadata export of all scrapable database tokens.</p>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 hover:border-purple-500/40 text-left space-y-2 group transition-all"
            >
              <div className="flex items-center justify-between text-purple-400">
                <FileSpreadsheet className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-mono bg-purple-500/20 px-2 py-0.5 rounded">CSV</span>
              </div>
              <h4 className="text-xs font-extrabold text-white">Export Telemetry CSV</h4>
              <p className="text-[11px] text-slate-400 leading-normal">Spreadsheet format for cluster inventory & region analytics.</p>
            </button>
          </div>
        </div>

        {/* Section 3: Cache Cleaner & Transport Security */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Stale Cache Cleaner */}
          <div className="glass-card rounded-2xl p-6 space-y-4 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Stale Production Cache Cleaner</h3>
                <p className="text-xs text-slate-400">Purge local storage, session data, and service worker caches.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-white/10 font-mono">
              Use this when new production builds are deployed to ensure no legacy JS/CSS assets persist in browser storage.
            </p>

            <button
              type="button"
              onClick={handlePurgeCache}
              className="w-full px-4 py-2.5 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Purge Stale Cache & Reload</span>
            </button>
          </div>

          {/* Security Headers */}
          <div className="glass-card rounded-2xl p-6 space-y-4 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Transport Security & Headers</h3>
                <p className="text-xs text-slate-400">Active server security parameters.</p>
              </div>
            </div>

            <ul className="space-y-2 text-xs font-mono text-slate-300">
              <li className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-lg border border-white/10">
                <span className="text-slate-400">X-Frame-Options:</span>
                <span className="text-emerald-400 font-bold">DENY</span>
              </li>
              <li className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-lg border border-white/10">
                <span className="text-slate-400">X-Content-Type-Options:</span>
                <span className="text-emerald-400 font-bold">nosniff</span>
              </li>
              <li className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-lg border border-white/10">
                <span className="text-slate-400">Payload Limit:</span>
                <span className="text-cyan-400 font-bold">1 MB</span>
              </li>
            </ul>
          </div>
        </div>

        {/* OpenAPI Swagger UI link */}
        <div className="glass-card rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 border border-white/10">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-cyan-400" />
            <div>
              <h4 className="text-sm font-extrabold text-white">OpenAPI 3.0 Interactive Swagger UI</h4>
              <p className="text-xs text-slate-400">View schemas, response parameters, and live API endpoints at /docs.</p>
            </div>
          </div>

          <a
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="glow-btn-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
          >
            <span>Open Swagger Docs</span>
            <CheckCircle2 className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
