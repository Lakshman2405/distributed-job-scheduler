import { db } from '../../database/db';

/**
 * REPOSITORY PATTERN: Encapsulates database query execution away from business logic (SOLID - Single Responsibility)
 */
export interface IJobRepository {
  findById(id: string): any;
  findQueuedCandidates(queueId: string, limit: number): any[];
  updateStatus(id: string, status: string, workerId?: string | null): void;
  insert(job: any): void;
  countActiveByQueue(queueId: string): number;
}

export class JobRepository implements IJobRepository {
  findById(id: string): any {
    return db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id);
  }

  findQueuedCandidates(queueId: string, limit: number): any[] {
    return db.prepare(`
      SELECT * FROM jobs
      WHERE queue_id = ?
        AND status = 'QUEUED'
        AND datetime(run_at) <= datetime('now')
      ORDER BY priority DESC, datetime(run_at) ASC, id ASC
      LIMIT ?
    `).all(queueId, limit);
  }

  updateStatus(id: string, status: string, workerId?: string | null): void {
    if (workerId !== undefined) {
      db.prepare(`UPDATE jobs SET status = ?, worker_id = ?, updated_at = datetime('now') WHERE id = ?`).run(status, workerId, id);
    } else {
      db.prepare(`UPDATE jobs SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id);
    }
  }

  insert(job: any): void {
    db.prepare(`
      INSERT INTO jobs (
        id, queue_id, project_id, workflow_execution_id, workflow_node_id, type, payload,
        status, priority, run_at, timeout_ms, deduplication_hash, idempotency_key, max_attempts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.id, job.queueId, job.projectId, job.workflowExecutionId || null, job.workflowNodeId || null,
      job.type, JSON.stringify(job.payload || {}), job.status, job.priority, job.runAt, job.timeoutMs,
      job.deduplicationHash, job.idempotencyKey || null, job.maxAttempts
    );
  }

  countActiveByQueue(queueId: string): number {
    const res = db.prepare(`
      SELECT COUNT(*) as count FROM jobs WHERE queue_id = ? AND status IN ('CLAIMED', 'RUNNING')
    `).get(queueId) as any;
    return res.count || 0;
  }
}
