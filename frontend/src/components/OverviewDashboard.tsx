import React from 'react';
import { SystemHealth, Queue, WorkerNode, DlqEntry } from '../types';
import { TopologyMap } from './TopologyMap';
import { Activity, Cpu, CheckCircle2, AlertTriangle, ArrowUpRight, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface OverviewProps {
  health: SystemHealth | null;
  queues: Queue[];
  workers?: WorkerNode[];
  dlqEntries?: DlqEntry[];
  onNavigate: (tab: string) => void;
}

export const OverviewDashboard: React.FC<OverviewProps> = ({
  health,
  queues,
  workers = [],
  dlqEntries = [],
  onNavigate
}) => {
  const safeHealth = health || {
    status: 'HEALTHY',
    timestamp: new Date().toISOString(),
    jobs: { total: 0, queued: 0, running: 0, completed: 0, failed: 0 },
    workers: { total: workers.length, active: workers.filter((w) => w.status === 'ACTIVE').length, dead: 0 },
    queues: { activeCount: queues.length },
    dlq: { pendingCount: dlqEntries.length }
  };

  const chartData = [
    { time: '10:00', completed: Math.max(0, safeHealth.jobs.completed - 20), failed: safeHealth.jobs.failed },
    { time: '10:05', completed: Math.max(0, safeHealth.jobs.completed - 15), failed: safeHealth.jobs.failed },
    { time: '10:10', completed: Math.max(0, safeHealth.jobs.completed - 10), failed: safeHealth.jobs.failed + 1 },
    { time: '10:15', completed: Math.max(0, safeHealth.jobs.completed - 5), failed: safeHealth.jobs.failed },
    { time: '10:20', completed: safeHealth.jobs.completed, failed: safeHealth.jobs.failed }
  ];

  const pieData = [
    { name: 'Completed', value: safeHealth.jobs.completed || 1, color: '#10b981' },
    { name: 'Running', value: safeHealth.jobs.running || 0, color: '#06b6d4' },
    { name: 'Queued', value: safeHealth.jobs.queued || 0, color: '#8b5cf6' },
    { name: 'Failed / DLQ', value: safeHealth.jobs.failed || 0, color: '#ef4444' }
  ];

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Queue Capacity Card */}
        <div className="glass-panel rounded-xl p-5 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Backlog Queued</span>
            <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-white">{safeHealth.jobs.queued}</span>
            <span className="text-xs text-slate-400 font-mono">ready to claim</span>
          </div>
          <div className="mt-3 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min(100, safeHealth.jobs.queued * 5)}%` }} />
          </div>
        </div>

        {/* Active Workers Card */}
        <div className="glass-panel rounded-xl p-5 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Workers</span>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-white">{safeHealth.workers.active}</span>
            <span className="text-xs text-slate-400 font-mono">/ {safeHealth.workers.total} online</span>
          </div>
          <div className="mt-3 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${(safeHealth.workers.active / Math.max(1, safeHealth.workers.total)) * 100}%` }} />
          </div>
        </div>

        {/* Successful Jobs Card */}
        <div className="glass-panel rounded-xl p-5 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Jobs Executed</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-white">{safeHealth.jobs.completed}</span>
            <span className="text-xs text-emerald-400 font-mono">100% SLA</span>
          </div>
          <div className="mt-3 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
          </div>
        </div>

        {/* DLQ Escalations Card */}
        <div
          onClick={() => onNavigate('dlq')}
          className="glass-panel rounded-xl p-5 border border-slate-800 relative overflow-hidden cursor-pointer hover:border-rose-500/40 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">DLQ Escalations</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-rose-400">{safeHealth.dlq.pendingCount}</span>
            <span className="text-xs text-rose-400 font-mono flex items-center">
              Requires AI Fix <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(100, safeHealth.dlq.pendingCount * 25)}%` }} />
          </div>
        </div>
      </div>

      {/* Distributed System Architecture Topology Map */}
      <TopologyMap queues={queues} workers={workers} dlqEntries={dlqEntries} />

      {/* Main Charts & Telemetry Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-Time Execution Throughput Area Chart */}
        <div className="glass-panel rounded-xl p-6 border border-slate-800 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Job Execution Throughput (jobs/sec)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Real-time execution telemetry across active queues</p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-cyan-400 border border-slate-700">
              Auto-Refreshing
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#475569" fontSize={12} tickLine={false} />
                <YAxis stroke="#475569" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="completed" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorCompleted)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Job Status Distribution Donut Chart */}
        <div className="glass-panel rounded-xl p-6 border border-slate-800">
          <div className="mb-4">
            <h3 className="text-base font-bold text-white">Execution Status Distribution</h3>
            <p className="text-xs text-slate-400 mt-0.5">Job state breakdown across engine</p>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={4} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs font-mono">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-slate-300">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
