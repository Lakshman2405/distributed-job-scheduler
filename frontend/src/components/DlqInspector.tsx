import React from 'react';
import { DlqEntry } from '../types';
import { formatPayloadToText } from '../utils/formatters';
import { ShieldAlert, Sparkles, RotateCcw, AlertTriangle } from 'lucide-react';

interface DlqProps {
  entries: DlqEntry[];
  onAiAnalyze: (id: string) => void;
  onReplay: (id: string) => void;
}

export const DlqInspector: React.FC<DlqProps> = ({ entries, onAiAnalyze, onReplay }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <span>Dead Letter Queue (DLQ) & AI Diagnostics</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">Poison-pill jobs and permanent failures escalated for automated AI root cause analysis and patched replay</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="glass-panel rounded-xl p-12 text-center border border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">Dead Letter Queue is Empty!</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            All background jobs are executing cleanly across worker nodes. To test DLQ handling, open the <strong>Chaos Lab</strong> and inject a poison pill job.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="glass-panel rounded-xl p-6 border border-rose-500/30 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span className="font-bold text-base text-white font-mono">{entry.job_id}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono">
                      Failed after {entry.total_attempts} attempts
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Queue Partition: {entry.queue_name || entry.queue_id}</div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => onAiAnalyze(entry.id)}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-violet-500/20 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ask AI Root Cause</span>
                  </button>

                  <button
                    onClick={() => onReplay(entry.id)}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-xs font-semibold transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Replay Job</span>
                  </button>
                </div>
              </div>

              {/* Error Callout */}
              <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-500/20 text-rose-300 font-mono text-xs">
                <span className="font-bold uppercase block text-[10px] text-rose-400 mb-1">Error Failure Reason:</span>
                {entry.failed_reason}
              </div>

              {/* Human-Readable Task Summary (No Raw JSON) */}
              <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <span className="block text-slate-400 text-[10px] font-mono uppercase mb-1">Original Task Parameters:</span>
                <div className="font-medium text-white">{formatPayloadToText(entry.original_payload)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
