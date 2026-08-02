import React from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  dbName: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ConfirmModal({ isOpen, dbName, onClose, onConfirm }: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-slide-in">
      <div className="glass-card w-full max-w-md rounded-3xl p-6 border border-cyan-500/40 space-y-5 shadow-2xl shadow-cyan-500/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h3 className="text-base font-extrabold text-white">Confirm Database Link Deletion</h3>
        </div>

        <div className="space-y-2 text-xs text-slate-300">
          <p>
            Are you sure you want to remove the database link <strong className="text-white font-bold">"{dbName}"</strong> from your saved credentials file?
          </p>
          <p className="text-slate-400">
            This action will delete the stored connection parameters from local apis.env.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/30 transition-all"
            onClick={onConfirm}
          >
            Delete Link
          </button>
        </div>
      </div>
    </div>
  );
}
