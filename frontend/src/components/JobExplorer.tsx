import React, { useState } from 'react';
import { Job, Queue } from '../types';
import { api } from '../services/api';
import { formatPayloadToText } from '../utils/formatters';
import { RefreshCw, Search, Plus, Terminal, X } from 'lucide-react';

interface JobExplorerProps {
  jobs: Job[];
  queues: Queue[];
  onRefresh: () => void;
  onOpenLogViewer: (jobId: string) => void;
}

export const JobExplorer: React.FC<JobExplorerProps> = ({
  jobs,
  queues,
  onRefresh,
  onOpenLogViewer
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedQueueId, setSelectedQueueId] = useState(queues[0]?.id || '');
  
  // User-friendly text inputs (No hardcoded JSON typing required)
  const [taskName, setTaskName] = useState('');
  const [workloadSize, setWorkloadSize] = useState(100);
  const [targetSystem, setTargetSystem] = useState('');
  const [delayMs, setDelayMs] = useState(0);

  const filteredJobs = jobs.filter((job) => {
    const matchesStatus = filterStatus === 'ALL' || job.status === filterStatus;
    const formattedText = formatPayloadToText(job.payload);
    const matchesSearch = job.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.queue_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      formattedText.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    // Internally construct JSON payload from simple text fields
    const constructedPayload = {
      taskName: taskName.trim() || 'Custom Task',
      batchSize: Number(workloadSize) || 100,
      targetSystem: targetSystem.trim() || 'System',
      createdViaUI: true
    };

    await api.createJob({
      queueId: selectedQueueId || queues[0]?.id,
      payload: constructedPayload,
      delayMs
    });
    setShowCreateModal(false);
    onRefresh();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'QUEUED':
        return 'bg-violet-500/10 text-violet-400 border-violet-500/30';
      case 'RUNNING':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 animate-pulse';
      case 'COMPLETED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'FAILED':
      case 'DLQ':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search jobs by ID, queue, or task description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 w-72"
            />
          </div>

          <button
            onClick={onRefresh}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
            title="Refresh jobs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
          {['ALL', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'DLQ'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
                filterStatus === status
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              {status}
            </button>
          ))}

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-500 text-black font-semibold text-xs hover:bg-cyan-400 shadow-md ml-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Enqueue Job</span>
          </button>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
              <tr>
                <th className="p-3.5">Job ID</th>
                <th className="p-3.5">Queue Partition</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Attempts</th>
                <th className="p-3.5">Task Description</th>
                <th className="p-3.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No jobs matching current status filter.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-900/40 transition">
                    <td className="p-3.5 font-bold font-mono text-white">{job.id}</td>
                    <td className="p-3.5 font-mono text-cyan-400">{job.queue_name || job.queue_id}</td>
                    <td className="p-3.5 font-mono text-slate-400">{job.type}</td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded border text-[10px] uppercase font-bold font-mono ${getStatusBadge(job.status)}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-400">
                      {job.attempt_count} / {job.max_attempts}
                    </td>
                    {/* Human-readable text format instead of raw JSON! */}
                    <td className="p-3.5 font-medium text-slate-200 max-w-sm truncate">
                      {formatPayloadToText(job.payload)}
                    </td>
                    <td className="p-3.5">
                      <button
                        onClick={() => onOpenLogViewer(job.id)}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono"
                      >
                        <Terminal className="w-3 h-3 text-cyan-400" />
                        <span>Logs</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enqueue Custom Job Modal (Clean Text Inputs, No JSON Typing) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-xl p-6 border border-slate-700 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Enqueue New Background Task</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Queue</label>
                <select
                  value={selectedQueueId}
                  onChange={(e) => setSelectedQueueId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  {queues.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.name} (Priority {q.priority})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Task Title / Description</label>
                <input
                  type="text"
                  required
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="e.g. Generate Monthly Financial Digest"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Workload Items</label>
                  <input
                    type="number"
                    min="1"
                    value={workloadSize}
                    onChange={(e) => setWorkloadSize(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Target System</label>
                  <input
                    type="text"
                    value={targetSystem}
                    onChange={(e) => setTargetSystem(e.target.value)}
                    placeholder="e.g. Analytics Store"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Execution Delay (ms)</label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={delayMs}
                  onChange={(e) => setDelayMs(parseInt(e.target.value))}
                  placeholder="0 for immediate execution"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-500 text-black font-semibold text-xs hover:bg-cyan-400"
                >
                  Enqueue Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
