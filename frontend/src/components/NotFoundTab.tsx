import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertOctagon, Home, ArrowLeft } from "lucide-react";

export default function NotFoundTab() {
  const navigate = useNavigate();

  return (
    <section className="min-h-[70vh] flex items-center justify-center p-4 sm:p-6 animate-slide-in relative">

      {/* Transparent Glassmorphism Card Element */}
      <div className="relative z-10 bg-slate-950/30 backdrop-blur-2xl w-full max-w-lg rounded-3xl p-8 border border-rose-500/40 text-center space-y-6 shadow-2xl shadow-rose-500/20">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto shadow-lg shadow-rose-500/20">
          <AlertOctagon className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/30">
            HTTP 404 NOT FOUND
          </span>
          <h1 className="text-2xl font-black text-white">Resource Not Found</h1>
          <p className="text-xs text-slate-300 leading-relaxed max-w-md mx-auto">
            The requested page or endpoint route does not exist in the Upstash Cloud Console microservice workspace.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            className="glow-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2"
            onClick={() => navigate("/")}
          >
            <Home className="w-4 h-4" />
            <span>Return to Homepage</span>
          </button>

          <button
            type="button"
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center gap-2"
            onClick={() => navigate("/clusters")}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>View Clusters</span>
          </button>
        </div>
      </div>
    </section>
  );
}
