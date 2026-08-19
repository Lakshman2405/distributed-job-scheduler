import React from 'react';
import { Queue, WorkerNode, DlqEntry } from '../types';
import { Cpu, Zap, ShieldAlert, Server, Activity, Database } from 'lucide-react';

interface TopologyProps {
  queues: Queue[];
  workers: WorkerNode[];
  dlqEntries: DlqEntry[];
}

export const TopologyMap: React.FC<TopologyProps> = ({ queues, workers, dlqEntries }) => {
  const activeWorkers = workers.filter((w) => w.status === 'ACTIVE');

  return (
    <div className="glass-panel rounded-xl p-6 border border-slate-800 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <span>Distributed System Topology & Live Dataflow Map</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">Real-time architecture map visualizing client ingresses, partition queues, worker cluster nodes, and DLQ escalation</p>
        </div>
        <div className="flex items-center space-x-3 text-xs font-mono">
          <span className="flex items-center space-x-1.5 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>{activeWorkers.length} Active Workers</span>
          </span>
          <span className="flex items-center space-x-1.5 text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded border border-rose-500/20">
            <span>{dlqEntries.length} Poisoned Jobs</span>
          </span>
        </div>
      </div>

      {/* Network Nodes Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 relative">
        {/* Layer 1: Ingress Gateway */}
        <div className="space-y-4">
          <div className="text-xs font-mono uppercase text-slate-400 font-bold tracking-wider flex items-center space-x-1.5">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>1. Ingress & Triggers</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-xs text-white">REST & Cron Gateway</div>
                <div className="text-[10px] text-slate-400 font-mono">http://localhost:4000/api/v1</div>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 space-y-1">
              <div className="flex justify-between font-mono">
                <span>Idempotency Deduplication:</span>
                <span className="text-emerald-400 font-bold">ACTIVE</span>
              </div>
              <div className="flex justify-between font-mono">
                <span>Timing Wheel Indexer:</span>
                <span className="text-cyan-400 font-bold">O(1) Slot</span>
              </div>
            </div>
          </div>
        </div>

        {/* Layer 2: Partition Queues */}
        <div className="space-y-4">
          <div className="text-xs font-mono uppercase text-slate-400 font-bold tracking-wider flex items-center space-x-1.5">
            <Database className="w-4 h-4 text-indigo-400" />
            <span>2. Partition Queues ({queues.length})</span>
          </div>

          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {queues.map((q) => (
              <div key={q.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-white font-mono">{q.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">Concurrency Limit: {q.concurrency_limit}</div>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Priority {q.priority}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Layer 3: Worker Cluster */}
        <div className="space-y-4">
          <div className="text-xs font-mono uppercase text-slate-400 font-bold tracking-wider flex items-center space-x-1.5">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>3. Worker Cluster</span>
          </div>

          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {workers.map((w) => (
              <div
                key={w.id}
                className={`p-3 rounded-lg border flex items-center justify-between ${
                  w.status === 'ACTIVE'
                    ? 'bg-slate-900 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                }`}
              >
                <div>
                  <div className="font-bold text-xs font-mono">{w.id}</div>
                  <div className="text-[10px] text-slate-400 font-mono">Capacity: {w.current_concurrency} / {w.max_concurrency}</div>
                </div>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${w.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-300'}`}>
                  {w.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Layer 4: Dead Letter Queue & AI */}
        <div className="space-y-4">
          <div className="text-xs font-mono uppercase text-slate-400 font-bold tracking-wider flex items-center space-x-1.5">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>4. DLQ & AI Diagnostics</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-rose-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-white">Poison Pill Vault</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400">
                {dlqEntries.length} Jobs Escalated
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Automated LLM stack-trace analyzer patches payload parameters for 1-click replay.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
