import { db } from '../database/db';
import { v4 as uuidv4 } from 'uuid';

export interface CreateQueueInput {
  projectId: string;
  workerPoolId?: string;
  name: string;
  priority?: number;
  concurrencyLimit?: number;
  rateLimitPerSec?: number;
  retryPolicyId?: string;
}

export class QueueService {
  static createQueue(input: CreateQueueInput) {
    const id = `queue_${uuidv4().substring(0, 8)}`;
    const stmt = db.prepare(`
      INSERT INTO queues (
        id, project_id, worker_pool_id, name, priority, concurrency_limit, rate_limit_per_sec, retry_policy_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `);

    stmt.run(
      id,
      input.projectId,
      input.workerPoolId || null,
      input.name,
      input.priority || 5,
      input.concurrencyLimit || 5,
      input.rateLimitPerSec || 100,
      input.retryPolicyId || null
    );

    return this.getQueueById(id);
  }

  static getQueueById(id: string) {
    const queue = db.prepare(`
      SELECT q.*, r.name as retry_policy_name, r.strategy as retry_strategy, r.max_retries, r.base_delay_ms
      FROM queues q
      LEFT JOIN retry_policies r ON q.retry_policy_id = r.id
      WHERE q.id = ?
    `).get(id);

    if (!queue) return null;
    return this.enrichQueueWithMetrics(queue);
  }

  static listQueues(projectId: string) {
    const queues = db.prepare(`
      SELECT q.*, r.name as retry_policy_name
      FROM queues q
      LEFT JOIN retry_policies r ON q.retry_policy_id = r.id
      WHERE q.project_id = ?
      ORDER BY q.priority DESC, q.created_at ASC
    `).all(projectId);

    return queues.map((q: any) => this.enrichQueueWithMetrics(q));
  }

  static updateQueueStatus(id: string, status: 'ACTIVE' | 'PAUSED' | 'DRAINING') {
    db.prepare(`UPDATE queues SET status = ? WHERE id = ?`).run(status, id);
    return this.getQueueById(id);
  }

  static updateQueueConfig(id: string, config: { priority?: number; concurrencyLimit?: number; rateLimitPerSec?: number }) {
    const updates: string[] = [];
    const params: any[] = [];

    if (config.priority !== undefined) {
      updates.push('priority = ?');
      params.push(config.priority);
    }
    if (config.concurrencyLimit !== undefined) {
      updates.push('concurrency_limit = ?');
      params.push(config.concurrencyLimit);
    }
    if (config.rateLimitPerSec !== undefined) {
      updates.push('rate_limit_per_sec = ?');
      params.push(config.rateLimitPerSec);
    }

    if (updates.length > 0) {
      params.push(id);
      db.prepare(`UPDATE queues SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    return this.getQueueById(id);
  }

  static enrichQueueWithMetrics(queue: any) {
    const counts = db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'QUEUED' THEN 1 ELSE 0 END) as queued_count,
        SUM(CASE WHEN status IN ('CLAIMED', 'RUNNING') THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN status IN ('FAILED', 'DLQ') THEN 1 ELSE 0 END) as failed_count
      FROM jobs
      WHERE queue_id = ?
    `).get(queue.id) as any;

    return {
      ...queue,
      metrics: {
        queued: counts.queued_count || 0,
        active: counts.active_count || 0,
        completed: counts.completed_count || 0,
        failed: counts.failed_count || 0,
        concurrencyUtilizationPct: Math.round(((counts.active_count || 0) / (queue.concurrency_limit || 1)) * 100)
      }
    };
  }
}
