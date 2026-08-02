import React from "react";
import { Zap } from "lucide-react";

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-50 bg-[#07090e] flex flex-col items-center justify-center space-y-6">
      <div className="relative flex items-center justify-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white shadow-2xl shadow-cyan-500/30 animate-bounce">
          <Zap className="w-10 h-10 fill-current" />
        </div>
        <div className="absolute inset-0 rounded-2xl bg-cyan-400/20 blur-xl animate-pulse"></div>
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-xl font-black tracking-tight text-white">UPSTASH REDIS CLOUD</h1>
        <p className="text-xs text-slate-400 font-mono">Initializing Microservice Engine & Security Tokens...</p>
      </div>

      <div className="w-48 h-1 bg-slate-900 rounded-full overflow-hidden border border-white/10">
        <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full animate-pulse"></div>
      </div>
    </div>
  );
}
