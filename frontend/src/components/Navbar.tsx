import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Zap, Home, Database, PlusCircle, Activity, Settings } from "lucide-react";

interface NavbarProps {
  databasesCount: number;
}

export default function Navbar({ databasesCount }: NavbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Brand & Logo */}
        <Link 
          to="/"
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform duration-200">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-extrabold tracking-tight text-white leading-tight">
              UPSTASH REDIS
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Console & Cloud Engine
            </span>
          </div>
        </Link>

        {/* Page Routes Navigation */}
        <nav className="flex items-center gap-1 sm:gap-1.5 bg-slate-950/60 p-1.5 rounded-2xl border border-white/10 overflow-x-auto max-w-full">
          <Link
            to="/"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
              pathname === "/"
                ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </Link>

          <Link
            to="/clusters"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
              pathname === "/clusters"
                ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Clusters</span>
            <span className="bg-cyan-500 text-slate-950 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
              {databasesCount}
            </span>
          </Link>

          <Link
            to="/provisioner"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
              pathname === "/provisioner"
                ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Provisioner</span>
          </Link>

          <Link
            to="/diagnostics"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
              pathname === "/diagnostics"
                ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Diagnostics</span>
          </Link>

          <Link
            to="/settings"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
              pathname === "/settings"
                ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </Link>
        </nav>

        {/* Right Header Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse-dot"></span>
            <span className="tracking-wider">ONLINE</span>
          </div>

          <button
            type="button"
            className="glow-btn-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
            onClick={() => navigate("/provisioner")}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Provision DB</span>
          </button>
        </div>
      </div>
    </header>
  );
}
