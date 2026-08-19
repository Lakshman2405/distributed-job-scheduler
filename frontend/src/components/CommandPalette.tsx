import React, { useState, useEffect } from 'react';
import { Search, Zap, ShieldAlert, Cpu, Activity, RefreshCw, X, Key } from 'lucide-react';

interface CommandProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onOpenChaos: () => void;
  onOpenAuth: () => void;
  onReseed: () => void;
}

export const CommandPalette: React.FC<CommandProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenChaos,
  onOpenAuth,
  onReseed
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open handled externally or toggled
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    { id: 'nav_overview', title: 'Go to Overview Dashboard', icon: Activity, action: () => { onNavigate('overview'); onClose(); } },
    { id: 'nav_queues', title: 'Manage Queue Configurations', icon: Cpu, action: () => { onNavigate('queues'); onClose(); } },
    { id: 'nav_jobs', title: 'Explore Background Jobs', icon: RefreshCw, action: () => { onNavigate('jobs'); onClose(); } },
    { id: 'nav_dag', title: 'Visualize DAG Workflow Pipelines', icon: Zap, action: () => { onNavigate('dag'); onClose(); } },
    { id: 'nav_workers', title: 'Monitor Worker Cluster Nodes', icon: Cpu, action: () => { onNavigate('workers'); onClose(); } },
    { id: 'nav_dlq', title: 'Inspect Dead Letter Queue (DLQ)', icon: ShieldAlert, action: () => { onNavigate('dlq'); onClose(); } },
    { id: 'chaos', title: 'Trigger Chaos Engineering Resilience Experiments', icon: ShieldAlert, action: () => { onOpenChaos(); onClose(); } },
    { id: 'auth', title: 'Manage JWT Tokens & Copy API Keys', icon: Key, action: () => { onOpenAuth(); onClose(); } },
    { id: 'reseed', title: 'Re-Seed Database Load', icon: RefreshCw, action: () => { onReseed(); onClose(); } }
  ];

  const filteredActions = actions.filter((a) => a.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-start justify-center pt-24 p-4">
      <div className="glass-panel w-full max-w-xl rounded-xl border border-cyan-500/40 shadow-2xl overflow-hidden space-y-0">
        <div className="flex items-center px-4 py-3 border-b border-slate-800 bg-slate-900/90">
          <Search className="w-5 h-5 text-cyan-400 mr-3" />
          <input
            type="text"
            autoFocus
            placeholder="Type a command or search platform features... (Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-white focus:outline-none placeholder-slate-500 font-sans"
          />
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60 p-2">
          {filteredActions.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">No matching commands found.</div>
          ) : (
            filteredActions.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  className="p-3 rounded-lg hover:bg-slate-800/80 cursor-pointer flex items-center justify-between text-xs text-slate-200 transition group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-1.5 rounded bg-slate-800 group-hover:bg-cyan-500/20 text-cyan-400">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-medium group-hover:text-white">{item.title}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Execute</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
