import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Terminal, X, RefreshCw } from 'lucide-react';

interface TerminalProps {
  jobId: string | null;
  onClose: () => void;
}

export const TerminalLogViewer: React.FC<TerminalProps> = ({ jobId, onClose }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [jobDetails, setJobDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    setIsLoading(true);
    api.getJobDetails(jobId).then((data) => {
      setJobDetails(data.job);
      setLogs(data.logs || []);
    }).finally(() => {
      setIsLoading(false);
    });
  }, [jobId]);

  if (!jobId) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-3xl rounded-xl border border-slate-700 overflow-hidden shadow-2xl flex flex-col h-[520px]">
        {/* Terminal Header */}
        <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span className="font-mono font-bold text-xs text-white">Execution Console — {jobId}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Terminal Window */}
        <div className="bg-black/90 p-4 font-mono text-xs text-slate-200 overflow-y-auto flex-1 space-y-2">
          {isLoading ? (
            <div className="text-slate-500 animate-pulse">Loading execution logs...</div>
          ) : logs.length === 0 ? (
            <div className="text-slate-500">[SYSTEM] No streaming logs recorded yet for this job.</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="flex items-start space-x-2">
                <span className="text-slate-600 text-[10px] select-none">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                <span className={`px-1 rounded text-[10px] font-bold ${
                  log.level === 'ERROR' ? 'bg-rose-500/20 text-rose-400' :
                  log.level === 'WARN' ? 'bg-amber-500/20 text-amber-400' : 'bg-cyan-500/20 text-cyan-400'
                }`}>
                  {log.level}
                </span>
                <span className="text-slate-200">{log.message}</span>
              </div>
            ))
          )}
        </div>

        {/* Terminal Footer */}
        {jobDetails && (
          <div className="bg-slate-900 px-4 py-2 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex justify-between">
            <span>Status: <strong className="text-cyan-400">{jobDetails.status}</strong></span>
            <span>Worker: <strong className="text-slate-300">{jobDetails.worker_id || 'Unassigned'}</strong></span>
            <span>Attempts: <strong className="text-slate-300">{jobDetails.attempt_count} / {jobDetails.max_attempts}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
};
