import React from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Play, Database, Activity, ShieldCheck, Cpu, ArrowRight } from "lucide-react";
import { DatabaseItem } from "../types";

interface HomeTabProps {
  databases: DatabaseItem[];
}

export default function HomeTab({ databases }: HomeTabProps) {
  const navigate = useNavigate();

  return (
    <section className="space-y-12 animate-slide-in relative">
      {/* Hero Section */}
      <div className="glass-panel rounded-3xl p-8 sm:p-12 border border-white/10 relative overflow-hidden space-y-6">
        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Serverless Upstash Automation Hub v1.0.0</span>
          </div>

          <div className="space-y-4 max-w-3xl">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              Automated Upstash Redis <br />
              <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
                Provisioning & Diagnostic Engine
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Instant headless cluster creation, 6-digit OTP verification handling, REST token extraction, and live IORedis diagnostic testing in one unified workspace.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="button"
              className="glow-btn-primary px-6 py-3 rounded-xl text-xs font-extrabold flex items-center gap-2"
              onClick={() => navigate("/provisioner")}
            >
              <Play className="w-4 h-4" />
              <span>Launch Provisioning Engine</span>
            </button>

            <button
              type="button"
              className="px-6 py-3 rounded-xl text-xs font-bold text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2"
              onClick={() => navigate("/clusters")}
            >
              <Database className="w-4 h-4" />
              <span>View Active Clusters ({databases.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
        {/* Feature 1 */}
        <div className="glass-card rounded-2xl p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
          <h3 className="text-base font-extrabold text-white">Headless Puppeteer Engine</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Automates account signup, DOM unmasking, clipboard interception, and REST token scraping with 0 manual steps.
          </p>
          <button
            onClick={() => navigate("/provisioner")}
            className="text-xs font-bold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 pt-1"
          >
            <span>Open Work Area</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Feature 2 */}
        <div className="glass-card rounded-2xl p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Activity className="w-5 h-5" />
          </div>
          <h3 className="text-base font-extrabold text-white">Live IORedis Diagnostics</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Executes PING, SET, GET, DEL round-trip connection latency tests directly against your TLS Redis cluster endpoints.
          </p>
          <button
            onClick={() => navigate("/diagnostics")}
            className="text-xs font-bold text-purple-400 hover:text-purple-300 inline-flex items-center gap-1 pt-1"
          >
            <span>Run Health Check</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Feature 3 */}
        <div className="glass-card rounded-2xl p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-extrabold text-white">Security & Stale Cache Control</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Built-in Helmet security headers, OpenAPI 3.0 docs, rate limiting, and instant stale cache purger for new deployments.
          </p>
          <button
            onClick={() => navigate("/settings")}
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 pt-1"
          >
            <span>View Settings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
