import React from "react";
import { Link } from "react-router-dom";
import { Zap, ShieldCheck, RefreshCw, ExternalLink, Terminal } from "lucide-react";
import { ToastType } from "../types";

interface FooterProps {
  showToast: (msg: string, type?: ToastType) => void;
}

export default function Footer({ showToast }: FooterProps) {
  const handleClearCache = () => {
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
      showToast("Stale build cache cleared successfully! Reloading page...", "success");
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      showToast("Failed to purge stale browser cache.", "error");
    }
  };

  return (
    <footer className="w-full glass-panel border-t border-white/10 mt-16 py-10 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Col */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white shadow-md">
                <Zap className="w-4 h-4 fill-current" />
              </div>
              <span className="text-sm font-extrabold text-white tracking-tight">UPSTASH CONSOLE</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Enterprise serverless Redis provisioning microservice, real-time diagnostic engine, and REST token manager.
            </p>
          </div>

          {/* Quick Navigation Col */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Page Navigation</span>
            <ul className="space-y-2 text-xs text-slate-400 font-medium">
              <li>
                <Link to="/" className="hover:text-cyan-400 transition-colors">
                  Home Landing
                </Link>
              </li>
              <li>
                <Link to="/clusters" className="hover:text-cyan-400 transition-colors">
                  Clusters & Credentials
                </Link>
              </li>
              <li>
                <Link to="/provisioner" className="hover:text-cyan-400 transition-colors">
                  Automation Work Area
                </Link>
              </li>
              <li>
                <Link to="/diagnostics" className="hover:text-cyan-400 transition-colors">
                  Live Diagnostics
                </Link>
              </li>
              <li>
                <Link to="/settings" className="hover:text-cyan-400 transition-colors">
                  Security & Cache Settings
                </Link>
              </li>
            </ul>
          </div>

          {/* Developer & Docs Col */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">API & Docs</span>
            <ul className="space-y-2 text-xs text-slate-400 font-medium">
              <li>
                <a href="/docs" target="_blank" rel="noreferrer" className="hover:text-cyan-400 transition-colors inline-flex items-center gap-1">
                  <span>OpenAPI Swagger Docs</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a href="/api/v1/databases" target="_blank" rel="noreferrer" className="hover:text-cyan-400 transition-colors inline-flex items-center gap-1">
                  <span>JSON Databases API</span>
                  <Terminal className="w-3 h-3" />
                </a>
              </li>
              <li>
                <Link to="/settings" className="hover:text-cyan-400 transition-colors">
                  Security & Cache Settings
                </Link>
              </li>
            </ul>
          </div>

          {/* Stale Cache Cleaner Col */}
          <div className="space-y-3 md:col-span-1">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Production Maintenance</span>
            <p className="text-xs text-slate-400">Purge stale build assets and browser state cache after new deployments.</p>
            <button
              type="button"
              onClick={handleClearCache}
              className="w-full px-3.5 py-2 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Purge Stale Build Cache</span>
            </button>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 font-mono">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Transport TLS Security & Helmet Protected</span>
          </div>

          <div>
            <span>Upstash Cloud Console v1.0.0 &copy; {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
