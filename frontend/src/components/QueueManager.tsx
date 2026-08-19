import React, { useState } from 'react';
import { Queue } from '../types';
import { api } from '../services/api';
import { Cpu, Play, Pause, Plus, Sliders } from 'lucide-react';

interface QueueManagerProps {
  queues: Queue[];
  onRefresh: () => void;
}

export const QueueManager: React.FC<QueueManagerProps> = ({ queues, onRefresh }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newQueueName, setNewQueueName] = useState('');
  const [newPriority, setNewPriority] = useState(5);
  const [newConcurrency, setNewConcurrency] = useState(5);

  const handleToggleStatus = async (queue: Queue) => {
    const nextStatus = queue.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    await api.updateQueueStatus(queue.id, nextStatus);
    onRefresh();
  };

  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueueName.trim()) return;
    await api.createQueue({
      name: newQueueName,
      priority: newPriority,
      concurrencyLimit: newConcurrency
    });
    setNewQueueName('');
    setShowCreateModal(false);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <span>Queue Management & Partition Control</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">Configure priority rankings, worker concurrency limits, and pause/resume queue execution state</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs shadow-lg shadow-cyan-500/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Queue</span>
        </button>
      </div>

      {/* Queue Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {queues.map((q) => (
          <div key={q.id} className="glass-panel rounded-xl p-6 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">{q.name}</h3>
                <span className="text-xs font-mono text-slate-400">ID: {q.id}</span>
              </div>
              <button
                onClick={() => handleToggleStatus(q)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition ${
                  q.status === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                }`}
              >
                {q.status === 'ACTIVE' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{q.status === 'ACTIVE' ? 'Pause Queue' : 'Resume Queue'}</span>
              </button>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-4 gap-2 text-center p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 font-mono text-xs">
              <div>
                <span className="block text-slate-400">Queued</span>
                <span className="text-violet-400 font-bold text-sm">{q.metrics?.queued || 0}</span>
              </div>
              <div>
                <span className="block text-slate-400">Active</span>
                <span className="text-cyan-400 font-bold text-sm">{q.metrics?.active || 0}</span>
              </div>
              <div>
                <span className="block text-slate-400">Done</span>
                <span className="text-emerald-400 font-bold text-sm">{q.metrics?.completed || 0}</span>
              </div>
              <div>
                <span className="block text-slate-400">Failed</span>
                <span className="text-rose-400 font-bold text-sm">{q.metrics?.failed || 0}</span>
              </div>
            </div>

            {/* Config Sliders & Specs */}
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Priority Weight:</span>
                <span className="font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-bold">P{q.priority}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Concurrency Limit:</span>
                <span className="font-mono text-white font-bold">{q.concurrency_limit} concurrent jobs</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Retry Strategy:</span>
                <span className="font-mono text-indigo-400">{q.retry_policy_name || 'Exponential Jitter'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for Creating New Queue */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-xl p-6 border border-slate-700 space-y-4">
            <h3 className="text-lg font-bold text-white">Create New Execution Queue</h3>
            <form onSubmit={handleCreateQueue} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Queue Name</label>
                <input
                  type="text"
                  required
                  value={newQueueName}
                  onChange={(e) => setNewQueueName(e.target.value)}
                  placeholder="e.g. image-processing-queue"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Priority (1-10)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={newPriority}
                  onChange={(e) => setNewPriority(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Concurrency Limit</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={newConcurrency}
                  onChange={(e) => setNewConcurrency(parseInt(e.target.value))}
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
                  Create Queue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
