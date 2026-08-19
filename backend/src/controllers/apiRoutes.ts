import { Router, Request, Response } from 'express';
import { db } from '../database/db';
import { authenticate, requireRole, generateToken, hashPassword, comparePassword, AuthRequest } from '../auth/authService';
import { QueueService } from '../services/QueueService';
import { JobService } from '../services/JobService';
import { WorkerService } from '../services/WorkerService';
import { DagOrchestrator } from '../services/DagOrchestrator';
import { ChaosEngine } from '../services/ChaosEngine';
import { MetricsService } from '../services/MetricsService';
import { AiDiagnosticsService } from '../services/AiDiagnosticsService';
import { runSeed } from '../seed/seedRunner';
import { v4 as uuidv4 } from 'uuid';

export const apiRouter = Router();

// ==========================================
// 1. AUTHENTICATION & USERS
// ==========================================
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Email and password required' } });
  }

  const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as any;
  if (!user || !comparePassword(password, user.password_hash)) {
    return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role,
    orgId: user.org_id
  });

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      orgId: user.org_id
    }
  });
});

apiRouter.post('/auth/register', (req: Request, res: Response) => {
  const { email, password, orgName } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Email and password required' } });
  }

  const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
  if (existing) {
    return res.status(409).json({ error: { code: 'USER_EXISTS', message: 'User with this email already exists' } });
  }

  const orgId = `org_${uuidv4().substring(0, 8)}`;
  db.prepare(`INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)`).run(orgId, orgName || 'My Organization', `org-${Date.now()}`);

  const userId = `usr_${uuidv4().substring(0, 8)}`;
  const passwordHash = hashPassword(password);
  db.prepare(`INSERT INTO users (id, org_id, email, password_hash, role) VALUES (?, ?, ?, ?, 'ORG_ADMIN')`).run(userId, orgId, email, passwordHash);

  const token = generateToken({ id: userId, email, role: 'ORG_ADMIN', orgId });
  return res.status(201).json({ token, user: { id: userId, email, role: 'ORG_ADMIN', orgId } });
});

apiRouter.get('/auth/me', authenticate, (req: AuthRequest, res: Response) => {
  return res.json({ user: req.user });
});

// ==========================================
// 2. PROJECTS & ORGANIZATIONS
// ==========================================
apiRouter.get('/projects', authenticate, (req: AuthRequest, res: Response) => {
  const projects = db.prepare(`SELECT * FROM projects WHERE org_id = ? ORDER BY created_at DESC`).all(req.user?.orgId) as any[];
  return res.json({ projects });
});

apiRouter.post('/projects', authenticate, requireRole(['SUPER_ADMIN', 'ORG_ADMIN']), (req: AuthRequest, res: Response) => {
  const { name, description } = req.body;
  const projectId = `proj_${uuidv4().substring(0, 8)}`;
  const apiKey = `apex_${uuidv4().replace(/-/g, '')}`;

  db.prepare(`
    INSERT INTO projects (id, org_id, name, description, api_key)
    VALUES (?, ?, ?, ?, ?)
  `).run(projectId, req.user?.orgId, name, description || null, apiKey);

  const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId);
  return res.status(201).json({ project });
});

// ==========================================
// 3. QUEUES
// ==========================================
apiRouter.get('/queues', authenticate, (req: AuthRequest, res: Response) => {
  const { projectId } = req.query;
  const targetProjectId = (projectId as string) || (db.prepare(`SELECT id FROM projects LIMIT 1`).get() as any)?.id;

  if (!targetProjectId) return res.json({ queues: [] });
  const queues = QueueService.listQueues(targetProjectId);
  return res.json({ queues });
});

apiRouter.post('/queues', authenticate, requireRole(['SUPER_ADMIN', 'ORG_ADMIN', 'DEVELOPER']), (req: AuthRequest, res: Response) => {
  const { projectId, name, priority, concurrencyLimit, rateLimitPerSec } = req.body;
  if (!name) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Queue name is required' } });

  const targetProjectId = projectId || (db.prepare(`SELECT id FROM projects LIMIT 1`).get() as any)?.id;
  const queue = QueueService.createQueue({
    projectId: targetProjectId,
    name,
    priority,
    concurrencyLimit,
    rateLimitPerSec
  });

  return res.status(201).json({ queue });
});

apiRouter.put('/queues/:id/status', authenticate, requireRole(['SUPER_ADMIN', 'ORG_ADMIN', 'DEVELOPER']), (req: Request, res: Response) => {
  const { status } = req.body;
  if (!['ACTIVE', 'PAUSED', 'DRAINING'].includes(status)) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid status value' } });
  }

  const queue = QueueService.updateQueueStatus(req.params.id, status);
  return res.json({ queue });
});

apiRouter.put('/queues/:id/config', authenticate, requireRole(['SUPER_ADMIN', 'ORG_ADMIN', 'DEVELOPER']), (req: Request, res: Response) => {
  const queue = QueueService.updateQueueConfig(req.params.id, req.body);
  return res.json({ queue });
});

// ==========================================
// 4. JOBS
// ==========================================
apiRouter.get('/jobs', authenticate, (req: AuthRequest, res: Response) => {
  const { projectId, queueId, status, limit, offset } = req.query;
  const jobs = JobService.listJobs({
    projectId: projectId as string,
    queueId: queueId as string,
    status: status as string,
    limit: limit ? parseInt(limit as string) : 50,
    offset: offset ? parseInt(offset as string) : 0
  });

  return res.json({ jobs });
});

apiRouter.get('/jobs/:id', authenticate, (req: Request, res: Response) => {
  const job = JobService.getJobById(req.params.id);
  if (!job) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Job not found' } });

  const logs = db.prepare(`SELECT * FROM job_logs WHERE job_id = ? ORDER BY timestamp ASC`).all(req.params.id) as any[];
  const executions = db.prepare(`SELECT * FROM job_executions WHERE job_id = ? ORDER BY attempt_number ASC`).all(req.params.id) as any[];

  return res.json({ job, logs, executions });
});

apiRouter.post('/jobs', authenticate, (req: AuthRequest, res: Response) => {
  const { queueId, payload, priority, delayMs, runAt, idempotencyKey } = req.body;
  if (!queueId || !payload) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'queueId and payload are required' } });
  }

  const queue = db.prepare(`SELECT project_id FROM queues WHERE id = ?`).get(queueId) as any;
  if (!queue) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Queue not found' } });

  const job = JobService.createJob({
    queueId,
    projectId: queue.project_id,
    payload,
    priority,
    delayMs,
    runAt,
    idempotencyKey
  });

  return res.status(201).json({ job });
});

apiRouter.post('/jobs/:id/cancel', authenticate, (req: Request, res: Response) => {
  const job = JobService.cancelJob(req.params.id);
  return res.json({ job });
});

// ==========================================
// 5. WORKFLOWS (DAGs)
// ==========================================
apiRouter.get('/workflows', authenticate, (req: Request, res: Response) => {
  const project = db.prepare(`SELECT id FROM projects LIMIT 1`).get() as any;
  if (!project) return res.json({ workflows: [] });

  const workflows = DagOrchestrator.listWorkflows(project.id);
  return res.json({ workflows });
});

apiRouter.post('/workflows/:id/execute', authenticate, (req: Request, res: Response) => {
  const result = DagOrchestrator.executeWorkflow(req.params.id, req.body.payload);
  return res.json({ result });
});

// ==========================================
// 6. DEAD LETTER QUEUE (DLQ) & AI DIAGNOSTICS
// ==========================================
apiRouter.get('/dlq', authenticate, (req: Request, res: Response) => {
  const dlqEntries = db.prepare(`
    SELECT dlq.*, j.payload, q.name as queue_name
    FROM dead_letter_queue dlq
    JOIN jobs j ON dlq.job_id = j.id
    JOIN queues q ON dlq.queue_id = q.id
    ORDER BY dlq.failed_at DESC
  `).all() as any[];

  return res.json({
    dlq: dlqEntries.map((d) => ({
      ...d,
      original_payload: typeof d.original_payload === 'string' ? JSON.parse(d.original_payload) : d.original_payload
    }))
  });
});

apiRouter.post('/dlq/:id/ai-analyze', authenticate, (req: Request, res: Response) => {
  const report = AiDiagnosticsService.analyzeDlqEntry(req.params.id);
  return res.json({ report });
});

apiRouter.post('/dlq/:id/replay', authenticate, (req: Request, res: Response) => {
  const result = AiDiagnosticsService.replayDlqJob(req.params.id, req.body.patchedPayload);
  return res.json({ result });
});

// ==========================================
// 7. WORKERS
// ==========================================
apiRouter.get('/workers', authenticate, (req: Request, res: Response) => {
  const workers = WorkerService.listWorkers();
  return res.json({ workers });
});

// ==========================================
// 8. CHAOS & DEMO GENERATOR
// ==========================================
apiRouter.post('/chaos/trigger', authenticate, requireRole(['SUPER_ADMIN', 'ORG_ADMIN']), (req: Request, res: Response) => {
  try {
    const { type } = req.body || {};
    if (!type) {
      return res.status(400).json({ error: { message: 'Chaos event type is required' } });
    }
    const result = ChaosEngine.triggerChaos(type);
    return res.json({ result });
  } catch (err: any) {
    return res.status(500).json({ error: { message: err.message || 'Chaos experiment execution failed' } });
  }
});

apiRouter.post('/seed/generate', authenticate, (req: Request, res: Response) => {
  runSeed();
  return res.json({ success: true, message: 'Database re-seeded with realistic synthetic load.' });
});
