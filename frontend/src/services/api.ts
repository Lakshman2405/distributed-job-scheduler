import { Queue, Job, WorkerNode, Workflow, DlqEntry, SystemHealth } from '../types';

const API_BASE = '/api/v1';

async function fetchJson(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('apex_token') || 'demo-token';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...options.headers
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  // Login
  async login(email: string, password: string) {
    const data = await fetchJson(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    localStorage.setItem('apex_token', data.token);
    return data;
  },

  // Queues
  async getQueues(): Promise<Queue[]> {
    const data = await fetchJson(`${API_BASE}/queues`);
    return data.queues;
  },

  async updateQueueStatus(id: string, status: 'ACTIVE' | 'PAUSED' | 'DRAINING') {
    const data = await fetchJson(`${API_BASE}/queues/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    return data.queue;
  },

  async createQueue(input: { name: string; priority?: number; concurrencyLimit?: number }) {
    const data = await fetchJson(`${API_BASE}/queues`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return data.queue;
  },

  // Jobs
  async getJobs(params: { queueId?: string; status?: string } = {}): Promise<Job[]> {
    const query = new URLSearchParams();
    if (params.queueId) query.set('queueId', params.queueId);
    if (params.status) query.set('status', params.status);

    const data = await fetchJson(`${API_BASE}/jobs?${query.toString()}`);
    return data.jobs;
  },

  async getJobDetails(id: string) {
    return fetchJson(`${API_BASE}/jobs/${id}`);
  },

  async createJob(input: { queueId: string; payload: any; priority?: number; delayMs?: number }) {
    const data = await fetchJson(`${API_BASE}/jobs`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return data.job;
  },

  async cancelJob(id: string) {
    return fetchJson(`${API_BASE}/jobs/${id}/cancel`, { method: 'POST' });
  },

  // Workflows
  async getWorkflows(): Promise<Workflow[]> {
    const data = await fetchJson(`${API_BASE}/workflows`);
    return data.workflows;
  },

  async executeWorkflow(id: string, payload?: any) {
    return fetchJson(`${API_BASE}/workflows/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify({ payload })
    });
  },

  // DLQ & AI
  async getDlqEntries(): Promise<DlqEntry[]> {
    const data = await fetchJson(`${API_BASE}/dlq`);
    return data.dlq;
  },

  async aiAnalyzeDlq(id: string) {
    const data = await fetchJson(`${API_BASE}/dlq/${id}/ai-analyze`, { method: 'POST' });
    return data.report;
  },

  async replayDlqJob(id: string, patchedPayload?: any) {
    return fetchJson(`${API_BASE}/dlq/${id}/replay`, {
      method: 'POST',
      body: JSON.stringify({ patchedPayload })
    });
  },

  // Workers
  async getWorkers(): Promise<WorkerNode[]> {
    const data = await fetchJson(`${API_BASE}/workers`);
    return data.workers;
  },

  // Chaos & Seed
  async triggerChaos(type: string) {
    return fetchJson(`${API_BASE}/chaos/trigger`, {
      method: 'POST',
      body: JSON.stringify({ type })
    });
  },

  async reseedData() {
    return fetchJson(`${API_BASE}/seed/generate`, { method: 'POST' });
  }
};
