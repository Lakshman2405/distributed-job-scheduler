import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { formatPayloadToText } from '../utils/formatters';
import { Sparkles, RotateCcw, X, CheckCircle2 } from 'lucide-react';

interface AiModalProps {
  dlqId: string | null;
  onClose: () => void;
  onRefresh: () => void;
}

export const AiDiagnosticsModal: React.FC<AiModalProps> = ({ dlqId, onClose, onRefresh }) => {
  const [report, setReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replaySuccess, setReplaySuccess] = useState(false);

  useEffect(() => {
    if (!dlqId) return;
    setIsLoading(true);
    setReplaySuccess(false);
    api.aiAnalyzeDlq(dlqId).then((data) => {
      setReport(data);
    }).finally(() => {
      setIsLoading(false);
    });
  }, [dlqId]);

  if (!dlqId) return null;

  const handlePatchAndReplay = async () => {
    if (!report) return;
    setIsReplaying(true);
    try {
      await api.replayDlqJob(dlqId, report.patchedPayload);
      setReplaySuccess(true);
      setTimeout(() => {
        onClose();
        onRefresh();
      }, 1500);
    } catch (err: any) {
      alert(`Replay failed: ${err.message}`);
    } finally {
      setIsReplaying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-xl rounded-xl p-6 border border-violet-500/40 space-y-6 shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-violet-500/20 pb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-violet-500/20 text-violet-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">AI Failure Root Cause Analysis</h3>
              <p className="text-xs text-violet-300">Intelligent diagnostic report & automated patch recommendation</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 space-y-3">
            <Sparkles className="w-8 h-8 text-violet-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-mono">Analyzing failure stack trace, payload, and attempt context...</p>
          </div>
        ) : report ? (
          <div className="space-y-4 text-xs">
            {/* Error Classification Pill */}
            <div className="p-3 rounded-lg bg-violet-950/40 border border-violet-500/30 text-violet-300 space-y-1 font-mono">
              <span className="text-[10px] uppercase font-bold text-violet-400">Error Classification Category:</span>
              <div className="text-sm font-bold text-white">{report.category}</div>
            </div>

            {/* Root Cause Analysis */}
            <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Root Cause Breakdown:</span>
              <p className="text-slate-200 leading-relaxed font-medium">{report.rootCause}</p>
            </div>

            {/* Recommended Fix */}
            <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-emerald-400">AI Recommended Solution:</span>
              <p className="text-emerald-300 leading-relaxed font-medium">{report.recommendedFix}</p>
            </div>

            {/* Patched Task Parameters (No Raw JSON) */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-cyan-400">AI Patched Task Parameters:</span>
              <div className="text-cyan-200 font-medium">{formatPayloadToText(report.patchedPayload)}</div>
            </div>

            {/* Replay Action */}
            <div className="flex justify-end pt-2">
              {replaySuccess ? (
                <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Job Patched & Re-Queued!</span>
                </div>
              ) : (
                <button
                  onClick={handlePatchAndReplay}
                  disabled={isReplaying}
                  className="flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{isReplaying ? 'Applying Patch...' : '1-Click Apply Patch & Replay Job'}</span>
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
