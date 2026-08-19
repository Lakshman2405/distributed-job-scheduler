import { initDatabase, db } from '../database/db';
import { hashPassword } from '../auth/authService';
import { QueueService } from '../services/QueueService';
import { JobService } from '../services/JobService';
import { DagOrchestrator } from '../services/DagOrchestrator';
import { WorkerService } from '../services/WorkerService';
import { v4 as uuidv4 } from 'uuid';

export function runSeed() {
  initDatabase();

  // Clear existing records cleanly
  db.exec(`
    DELETE FROM dead_letter_queue;
    DELETE FROM job_logs;
    DELETE FROM job_executions;
    DELETE FROM job_dependencies;
    DELETE FROM jobs;
    DELETE FROM workflow_nodes;
    DELETE FROM workflows;
    DELETE FROM scheduled_jobs;
    DELETE FROM queues;
    DELETE FROM retry_policies;
    DELETE FROM workers;
    DELETE FROM worker_pools;
    DELETE FROM projects;
    DELETE FROM users;
    DELETE FROM organizations;
  `);

  console.log('🌱 Seeding ApexQueue Enterprise Database...');

  // 1. Organization
  const orgId = `org_${uuidv4().substring(0, 8)}`;
  db.prepare(`INSERT INTO organizations (id, name, slug) VALUES (?, 'Apex Enterprise Systems', 'apex-systems')`).run(orgId);

  // 2. Admin User
  const userId = `usr_${uuidv4().substring(0, 8)}`;
  db.prepare(`
    INSERT INTO users (id, org_id, email, password_hash, role)
    VALUES (?, ?, 'admin@apex.local', ?, 'SUPER_ADMIN')
  `).run(userId, orgId, hashPassword('password123'));

  // 3. Project
  const projectId = `proj_prod_001`;
  const apiKey = `apex_live_key_99887766`;
  db.prepare(`
    INSERT INTO projects (id, org_id, name, description, api_key)
    VALUES (?, ?, 'Production Cloud Infrastructure', 'Core enterprise scheduling & pipeline project', ?)
  `).run(projectId, orgId, apiKey);

  // 4. Worker Pools
  const poolGeneralId = `pool_general`;
  const poolGpuId = `pool_gpu`;
  db.prepare(`
    INSERT INTO worker_pools (id, project_id, name, tags, max_workers) VALUES
    (?, ?, 'General Compute Pool', '["general", "io-heavy"]', 10),
    (?, ?, 'GPU & AI Worker Pool', '["gpu", "ai-inference"]', 4)
  `).run(poolGeneralId, projectId, poolGpuId, projectId);

  // 5. Retry Policies
  const polFixedId = `pol_fixed`;
  const polLinearId = `pol_linear`;
  const polExpId = `pol_exponential`;

  db.prepare(`
    INSERT INTO retry_policies (id, name, strategy, max_retries, base_delay_ms, max_delay_ms) VALUES
    (?, 'Fixed 2s Delay', 'FIXED', 3, 2000, 2000),
    (?, 'Linear Step Backoff', 'LINEAR', 4, 1500, 10000),
    (?, 'Exponential Jitter (Recommended)', 'EXPONENTIAL_JITTER', 3, 1000, 30000)
  `).run(polFixedId, polLinearId, polExpId);

  // 6. Queues
  const qHigh = QueueService.createQueue({
    projectId,
    workerPoolId: poolGeneralId,
    name: 'High-Priority Transactions',
    priority: 10,
    concurrencyLimit: 5,
    rateLimitPerSec: 200,
    retryPolicyId: polExpId
  });

  const qBatch = QueueService.createQueue({
    projectId,
    workerPoolId: poolGeneralId,
    name: 'Batch ETL Processing',
    priority: 5,
    concurrencyLimit: 3,
    rateLimitPerSec: 50,
    retryPolicyId: polLinearId
  });

  const qEmail = QueueService.createQueue({
    projectId,
    workerPoolId: poolGeneralId,
    name: 'Email Notifications',
    priority: 7,
    concurrencyLimit: 8,
    rateLimitPerSec: 500,
    retryPolicyId: polFixedId
  });

  const qAi = QueueService.createQueue({
    projectId,
    workerPoolId: poolGpuId,
    name: 'AI Model Inference',
    priority: 9,
    concurrencyLimit: 2,
    rateLimitPerSec: 20,
    retryPolicyId: polExpId
  });

  // 7. Register Initial Workers
  WorkerService.registerWorker(poolGeneralId, 5);
  WorkerService.registerWorker(poolGeneralId, 5);
  WorkerService.registerWorker(poolGpuId, 2);

  // 8. Create Scheduled Cron Job
  const sjId = `sched_${uuidv4().substring(0, 8)}`;
  db.prepare(`
    INSERT INTO scheduled_jobs (id, project_id, queue_id, name, cron_expression, timezone, payload, next_run_at, status)
    VALUES (?, ?, ?, 'System Health Heartbeat & Metrics Rollup', '*/5 * * * *', 'UTC', ?, datetime('now', '+5 minutes'), 'ACTIVE')
  `).run(sjId, projectId, qBatch.id, JSON.stringify({ task: 'rollup_metrics', aggregateWindow: '5m' }));

  // 9. Create DAG Workflow
  DagOrchestrator.createWorkflow(
    projectId,
    'E-Commerce Data Pipeline (ETL & Recommendation ML)',
    'Cascading workflow from ingestion -> validation -> analytics & model fine-tuning',
    [
      {
        name: 'Ingest Raw Transactions',
        queueId: qHigh.id,
        payloadTemplate: { source: 's3://apex-datalake/raw-transactions.json', batchSize: 500 },
        parentNodeNames: [],
        joinCondition: 'ALL_SUCCESS'
      },
      {
        name: 'Clean & Validate Data',
        queueId: qBatch.id,
        payloadTemplate: { schemaValidation: 'strict', dropNulls: true },
        parentNodeNames: ['Ingest Raw Transactions'],
        joinCondition: 'ALL_SUCCESS'
      },
      {
        name: 'Generate Customer Analytics',
        queueId: qBatch.id,
        payloadTemplate: { reportType: 'daily_revenue_breakdown' },
        parentNodeNames: ['Clean & Validate Data'],
        joinCondition: 'ALL_SUCCESS'
      },
      {
        name: 'Train Recommendation ML Model',
        queueId: qAi.id,
        payloadTemplate: { modelArchitecture: 'Transformer-Rec', epochs: 5 },
        parentNodeNames: ['Clean & Validate Data'],
        joinCondition: 'ALL_SUCCESS'
      },
      {
        name: 'Send Executive Digest Email',
        queueId: qEmail.id,
        payloadTemplate: { recipientGroup: 'executives', templateId: 'daily_digest' },
        parentNodeNames: ['Generate Customer Analytics', 'Train Recommendation ML Model'],
        joinCondition: 'ALL_SUCCESS'
      }
    ]
  );

  // 10. Populate Immediate Jobs
  for (let i = 1; i <= 8; i++) {
    JobService.createJob({
      queueId: qHigh.id,
      projectId,
      payload: { transactionId: `tx_100${i}`, amount: 150.0 + i * 25, currency: 'USD' }
    });
  }

  for (let i = 1; i <= 5; i++) {
    JobService.createJob({
      queueId: qEmail.id,
      projectId,
      payload: { recipient: `user${i}@customer.org`, subject: `Welcome to ApexQueue ${i}` }
    });
  }

  // 11. Create a Poison Pill Job for DLQ demonstration
  const poisonJob = JobService.createJob({
    queueId: qBatch.id,
    projectId,
    payload: {
      shouldFail: true,
      errorMessage: 'CHAOS_POISON_PILL: Memory access violation at address 0xDEADBEEF during ETL parse',
      chaosTag: 'DEMO_DLQ_POISON_PILL'
    }
  });

  console.log('✅ Seed completed successfully!');
  console.log(`🔑 Login Credentials: admin@apex.local / password123`);
  console.log(`🔑 API Key: ${apiKey}`);
}

if (require.main === module) {
  runSeed();
}
