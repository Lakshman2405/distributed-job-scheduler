import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { OverviewDashboard } from './components/OverviewDashboard';
import { QueueManager } from './components/QueueManager';
import { JobExplorer } from './components/JobExplorer';
import { DagVisualizer } from './components/DagVisualizer';
import { WorkerMonitor } from './components/WorkerMonitor';
import { DlqInspector } from './components/DlqInspector';
import { ChaosControlPanel } from './components/ChaosControlPanel';
import { TerminalLogViewer } from './components/TerminalLogViewer';
import { AiDiagnosticsModal } from './components/AiDiagnosticsModal';
import { AuthModal } from './components/AuthModal';
import { CommandPalette } from './components/CommandPalette';
import { api } from './services/api';
import { Queue, Job, WorkerNode, Workflow, DlqEntry, SystemHealth } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workers, setWorkers] = useState<WorkerNode[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [dlqEntries, setDlqEntries] = useState<DlqEntry[]>([]);

  // Auth & Modals state
  const [currentUser, setCurrentUser] = useState<any>({
    email: 'admin@apex.local',
    role: 'SUPER_ADMIN'
  });
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isChaosOpen, setIsChaosOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [activeLogJobId, setActiveLogJobId] = useState<string | null>(null);
  const [activeDlqAiId, setActiveDlqAiId] = useState<string | null>(null);

  const refreshAll = async () => {
    try {
      const qData = await api.getQueues().catch(() => []);
      const jData = await api.getJobs().catch(() => []);
      const wData = await api.getWorkers().catch(() => []);
      const wfData = await api.getWorkflows().catch(() => []);
      const dlqData = await api.getDlqEntries().catch(() => []);

      setQueues(qData || []);
      setJobs(jData || []);
      setWorkers(wData || []);
      setWorkflows(wfData || []);
      setDlqEntries(dlqData || []);

      const completedCount = (jData || []).filter((j) => j.status === 'COMPLETED').length;
      const failedCount = (jData || []).filter((j) => j.status === 'FAILED' || j.status === 'DLQ').length;
      const runningCount = (jData || []).filter((j) => j.status === 'RUNNING' || j.status === 'CLAIMED').length;
      const queuedCount = (jData || []).filter((j) => j.status === 'QUEUED' || j.status === 'SCHEDULED').length;

      setHealth({
        status: 'HEALTHY',
        timestamp: new Date().toISOString(),
        jobs: {
          total: (jData || []).length,
          queued: queuedCount,
          running: runningCount,
          completed: completedCount,
          failed: failedCount
        },
        workers: {
          total: (wData || []).length,
          active: (wData || []).filter((w) => w.status === 'ACTIVE').length,
          dead: (wData || []).filter((w) => w.status === 'DEAD').length
        },
        queues: { activeCount: (qData || []).length },
        dlq: { pendingCount: (dlqData || []).length }
      });
    } catch (err) {
      console.error('Refresh error:', err);
    }
  };

  useEffect(() => {
    refreshAll();

    // Check user me endpoint
    fetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${localStorage.getItem('apex_token') || ''}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setCurrentUser(data.user);
      })
      .catch(() => {});

    // Auto refresh data every 3 seconds
    const interval = setInterval(refreshAll, 3000);

    // Initialize WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'METRICS_PULSE') {
          refreshAll();
        }
      } catch {}
    };

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, []);

  const handleReseed = async () => {
    await api.reseedData();
    refreshAll();
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isConnected={isConnected}
        currentUser={currentUser}
        onReseed={handleReseed}
        onOpenChaos={() => setIsChaosOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenCommand={() => setIsCommandOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {activeTab === 'overview' && (
          <OverviewDashboard
            health={health}
            queues={queues}
            workers={workers}
            dlqEntries={dlqEntries}
            onNavigate={setActiveTab}
          />
        )}
        {activeTab === 'queues' && (
          <QueueManager queues={queues} onRefresh={refreshAll} />
        )}
        {activeTab === 'jobs' && (
          <JobExplorer
            jobs={jobs}
            queues={queues}
            onRefresh={refreshAll}
            onOpenLogViewer={(jobId) => setActiveLogJobId(jobId)}
          />
        )}
        {activeTab === 'dag' && (
          <DagVisualizer workflows={workflows} onRefresh={refreshAll} />
        )}
        {activeTab === 'workers' && (
          <WorkerMonitor workers={workers} />
        )}
        {activeTab === 'dlq' && (
          <DlqInspector
            entries={dlqEntries}
            onAiAnalyze={(dlqId) => setActiveDlqAiId(dlqId)}
            onReplay={async (dlqId) => {
              await api.replayDlqJob(dlqId);
              refreshAll();
            }}
          />
        )}
      </main>

      {/* Modals & Overlays */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onLoginSuccess={(user) => setCurrentUser(user)}
        onLogout={() => {
          localStorage.removeItem('apex_token');
          setCurrentUser({ email: 'guest@system.local', role: 'VIEWER' });
        }}
      />

      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onNavigate={setActiveTab}
        onOpenChaos={() => setIsChaosOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onReseed={handleReseed}
      />

      <ChaosControlPanel
        isOpen={isChaosOpen}
        onClose={() => setIsChaosOpen(false)}
        onRefresh={refreshAll}
      />

      <TerminalLogViewer
        jobId={activeLogJobId}
        onClose={() => setActiveLogJobId(null)}
      />

      <AiDiagnosticsModal
        dlqId={activeDlqAiId}
        onClose={() => setActiveDlqAiId(null)}
        onRefresh={refreshAll}
      />
    </div>
  );
};
