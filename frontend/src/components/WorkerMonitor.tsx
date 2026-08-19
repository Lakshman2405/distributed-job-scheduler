import React from 'react';
import { WorkerNode } from '../types';
import { Cpu, Server, Activity, ShieldCheck } from 'lucide-react';

interface WorkerProps {
  workers: WorkerNode[];
}

export const WorkerMonitor: React.FC<WorkerProps> = ({ workers }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <span>Distributed Worker Cluster Nodes</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">Live worker daemons, CPU/RAM telemetry, active concurrency allocations, and heartbeat counters</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workers.map((w) => {
          const isDead = w.status === 'DEAD';
          return (
            <div
              key={w.id}
              className={`glass-panel rounded-xl p-6 border transition ${
                isDead ? 'border-rose-500/40 bg-rose-950/10' : 'border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Server className={`w-5 h-5 ${isDead ? 'text-rose-400' : 'text-cyan-400'}`} />
                  <span className="font-bold text-sm text-white font-mono">{w.id}</span>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${
                  isDead
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}>
                  {w.status}
                </span>
              </div>

              <div className="mt-4 space-y-3 font-mono text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Host / PID:</span>
                  <span className="text-white">{w.hostname} (PID {w.pid})</span>
                </div>

                <div className="flex justify-between text-slate-400">
                  <span>Concurrency Load:</span>
                  <span className="text-cyan-400 font-bold">{w.current_concurrency} / {w.max_concurrency} active</span>
                </div>

                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-cyan-400 h-full rounded-full"
                    style={{ width: `${(w.current_concurrency / Math.max(1, w.max_concurrency)) * 100}%` }}
                  />
                </div>

                <div className="flex justify-between text-slate-400">
                  <span>Capabilities:</span>
                  <span className="text-indigo-300">{Array.isArray(w.capabilities) ? w.capabilities.join(', ') : w.capabilities}</span>
                </div>

                <div className="flex justify-between text-slate-400 pt-2 border-t border-slate-800">
                  <span>Last Heartbeat:</span>
                  <span className="text-slate-300">{new Date(w.last_heartbeat_at).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
