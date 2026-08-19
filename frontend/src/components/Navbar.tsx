import React from 'react';
import { Cpu, RefreshCw, Zap, ShieldAlert, Activity, ShieldCheck, Search } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isConnected: boolean;
  currentUser: any;
  onReseed: () => void;
  onOpenChaos: () => void;
  onOpenAuth: () => void;
  onOpenCommand: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isConnected,
  currentUser,
  onReseed,
  onOpenChaos,
  onOpenAuth,
  onOpenCommand
}) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'queues', label: 'Queues', icon: Cpu },
    { id: 'jobs', label: 'Jobs', icon: RefreshCw },
    { id: 'dag', label: 'Workflows', icon: Zap },
    { id: 'workers', label: 'Workers', icon: Cpu },
    { id: 'dlq', label: 'DLQ Vault', icon: ShieldAlert }
  ];

  return (
    <header className="border-b border-slate-800 bg-[#090d16]/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3 cursor-pointer shrink-0" onClick={() => setActiveTab('overview')}>
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent">
                ApexQueue
              </span>
              <span className="block text-[10px] uppercase tracking-widest font-mono text-cyan-400 font-semibold">
                Distributed Engine
              </span>
            </div>
          </div>

          {/* Navigation Tabs (Consistent 1-2 Word Labels, No Text Wrapping) */}
          <nav className="hidden md:flex items-center space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Actions & Status */}
          <div className="flex items-center space-x-2.5 shrink-0">
            {/* Search Launcher Button */}
            <button
              onClick={onOpenCommand}
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white transition font-sans"
              title="Search System Features & Commands"
            >
              <Search className="w-3.5 h-3.5 text-cyan-400" />
              <span>Quick Search</span>
            </button>

            {/* Connection Status Pill */}
            <div className="hidden lg:flex items-center space-x-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-slate-300">{isConnected ? 'WS LIVE' : 'RECONNECTING'}</span>
            </div>

            {/* Auth Role Badge Button */}
            <button
              onClick={onOpenAuth}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 font-mono transition"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>{currentUser?.role || 'SUPER_ADMIN'}</span>
            </button>

            {/* Re-seed Load Button */}
            <button
              onClick={onReseed}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Seed Load</span>
            </button>

            {/* Chaos Control Panel Trigger */}
            <button
              onClick={onOpenChaos}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Chaos Lab</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
