import React from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Globe, HardDrive, CreditCard, RefreshCw, Plus, Copy, Activity } from "lucide-react";
import { DatabaseItem, ToastType } from "../types";

interface OverviewTabProps {
  databases: DatabaseItem[];
  loadDatabases: () => void;
  showToast: (msg: string, type?: ToastType) => void;
  copyToClipboard: (text: string, label: string) => void;
  setSelectedDiagUrl: (url: string) => void;
}

export default function OverviewTab({
  databases,
  loadDatabases,
  showToast,
  copyToClipboard,
  setSelectedDiagUrl,
}: OverviewTabProps) {
  const navigate = useNavigate();

  return (
    <section className="space-y-8 animate-slide-in">
      {/* Top Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1: Commands */}
        <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-slate-400">MONTHLY COMMANDS</span>
            <BarChart3 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">14</span>
            <span className="text-xs text-slate-400">/ 500k quota</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full" style={{ width: "1%" }}></div>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="text-emerald-400">●</span> 7 Writes &nbsp;
            <span className="text-cyan-400">●</span> 7 Reads
          </div>
        </div>

        {/* Metric 2: Bandwidth */}
        <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-slate-400">BANDWIDTH USAGE</span>
            <Globe className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">0 B</span>
            <span className="text-xs text-slate-400">/ 50 GB free</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-purple-400 rounded-full" style={{ width: "0.5%" }}></div>
          </div>
          <div className="text-xs text-emerald-400 font-medium">Optimal network bandwidth</div>
        </div>

        {/* Metric 3: Storage */}
        <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-slate-400">MEMORY STORAGE</span>
            <HardDrive className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">0 B</span>
            <span className="text-xs text-slate-400">/ 256 MB RAM</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-400 rounded-full" style={{ width: "0.5%" }}></div>
          </div>
          <div className="text-xs text-emerald-400 font-medium">Memory engine healthy</div>
        </div>

        {/* Metric 4: Cost */}
        <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-slate-400">ESTIMATED COST</span>
            <CreditCard className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">$0.00</span>
            <span className="text-xs text-slate-400">Free Tier</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full" style={{ width: "0%" }}></div>
          </div>
          <div className="text-xs text-slate-400">Per-request pay-as-you-go</div>
        </div>
      </div>

      {/* Cluster Status Grid */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <h2 className="text-xl font-extrabold text-white">Active Redis Database Clusters</h2>
            <p className="text-xs text-slate-400 mt-1">Real-time status, endpoints, and health ping diagnostics across all provisioned clusters.</p>
          </div>

          <button
            type="button"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2"
            onClick={() => {
              loadDatabases();
              showToast("Refreshing cluster health...", "info");
            }}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh Health</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {databases.length === 0 ? (
            <div className="col-span-full text-center py-12 space-y-4 glass-card rounded-2xl p-8 border border-white/10">
              <p className="text-sm text-slate-400">No active database clusters provisioned yet.</p>
              <button
                type="button"
                className="glow-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2"
                onClick={() => navigate("/provisioner")}
              >
                <Plus className="w-4 h-4" />
                <span>Provision New Database</span>
              </button>
            </div>
          ) : (
            databases.map((db, idx) => (
              <div key={db.name + idx} className="glass-card rounded-2xl p-6 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400"></span>
                      <h3 className="text-base font-extrabold text-white tracking-tight">{db.name}</h3>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                      {db.region || "us-east-1"}
                    </span>
                  </div>

                  <div className="bg-slate-950/60 rounded-xl p-3 border border-white/10 space-y-2 text-xs font-mono">
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Endpoint:</span>
                      <span className="text-slate-200 font-semibold truncate max-w-[180px]">
                        {db.endpoint || `${db.name}.upstash.io`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400">
                      <span>TCP Link:</span>
                      <span className="text-cyan-400 font-semibold truncate max-w-[180px]">
                        {db.redisUrl || `rediss://default:...@${db.endpoint}:6379`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
                    onClick={() => copyToClipboard(db.redisUrl, "TCP Connection Link")}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </button>
                  <button
                    type="button"
                    className="glow-btn-primary px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                    onClick={() => {
                      setSelectedDiagUrl(db.redisUrl);
                      navigate("/diagnostics");
                    }}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Test Health</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
