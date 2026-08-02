import React from "react";

export default function PageLoader() {
  return (
    <div className="w-full py-16 flex flex-col items-center justify-center space-y-4 animate-slide-in">
      <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
      <span className="text-xs font-mono text-slate-400">Loading module workspace...</span>
    </div>
  );
}
