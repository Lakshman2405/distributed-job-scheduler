import { describe, it, expect, beforeAll } from 'vitest';
import { initDatabase, db } from '../database/db';
import { QueueService } from '../services/QueueService';
import { JobService } from '../services/JobService';
import { WorkerService } from '../services/WorkerService';
import { StaleWorkerReaper } from '../workers/StaleWorkerReaper';

describe('ApexQueue Engine Unit & Integration Tests', () => {
  let projectId: string;
  let queueId: string;

  beforeAll(() => {
    initDatabase();
    db.exec(`DELETE FROM jobs; DELETE FROM queues; DELETE FROM projects; DELETE FROM worker_pools; DELETE FROM workers; DELETE FROM users; DELETE FROM organizations;`);

    const orgId = 'org_test_001';
    db.prepare(`INSERT INTO organizations (id, name, slug) VALUES (?, 'Test Org', 'test-org')`).run(orgId);

    projectId = 'proj_test_001';
    db.prepare(`INSERT INTO projects (id, org_id, name, api_key) VALUES (?, ?, 'Test Project', 'key_test')`).run(projectId, orgId);

    const queue = QueueService.createQueue({
      projectId,
      name: 'test-unit-queue',
      priority: 8,
      concurrencyLimit: 2
    });
    queueId = queue.id;
  });

  it('should create a job and verify initial QUEUED state', () => {
    const job = JobService.createJob({
      queueId,
      projectId,
      payload: { testKey: 'testValue' }
    });

    expect(job).toBeDefined();
    expect(job.status).toBe('QUEUED');
    expect(job.priority).toBe(8);
    expect(job.payload.testKey).toBe('testValue');
  });

  it('should enforce idempotency key deduplication', () => {
    const key = 'idem_unique_12345';

    const job1 = JobService.createJob({
      queueId,
      projectId,
      payload: { data: 'original' },
      idempotencyKey: key
    });

    const job2 = JobService.createJob({
      queueId,
      projectId,
      payload: { data: 'duplicate_attempt' },
      idempotencyKey: key
    });

    expect(job1.id).toBe(job2.id);
  });

  it('should claim jobs atomically enforcing queue concurrency limits', () => {
    // Queue concurrency limit is set to 2. Let's create 4 jobs.
    for (let i = 0; i < 4; i++) {
      JobService.createJob({
        queueId,
        projectId,
        payload: { index: i }
      });
    }

    const worker = WorkerService.registerWorker(undefined, 5);

    const claimed = JobService.claimJobsAtomic(worker.id, 5);

    // Should only claim up to concurrencyLimit (2)
    expect(claimed.length).toBeLessThanOrEqual(2);
    expect(claimed[0].status).toBe('CLAIMED');
  });

  it('should detect stale dead workers and reclaim orphaned jobs', () => {
    const worker = WorkerService.registerWorker(undefined, 5);
    const job = JobService.createJob({
      queueId,
      projectId,
      payload: { orphan: true }
    });

    // Manually claim job under worker
    db.prepare(`UPDATE jobs SET status = 'CLAIMED', worker_id = ? WHERE id = ?`).run(worker.id, job.id);

    // Set worker heartbeat to 30s ago
    db.prepare(`UPDATE workers SET last_heartbeat_at = datetime('now', '-30 seconds') WHERE id = ?`).run(worker.id);

    // Run reaper
    StaleWorkerReaper.reapStaleWorkers(true);

    const updatedWorker = WorkerService.getWorkerById(worker.id);
    expect(updatedWorker.status).toBe('DEAD');

    const reclaimedJob = JobService.getJobById(job.id);
    expect(reclaimedJob.status).toBe('QUEUED');
    expect(reclaimedJob.worker_id).toBeNull();
  });
});
