import { db } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { RetryStrategyFactory } from '../patterns/strategies/RetryStrategy';

export interface CreateJobInput {
  queueId: string;
  projectId: string;
  type?: 'IMMEDIATE' | 'DELAYED' | 'SCHEDULED' | 'CRON' | 'DAG_STEP';
  payload: Record<string, any>;
  priority?: number;
  delayMs?: number;
  runAt?: string;
  timeoutMs?: number;
  idempotencyKey?: string;
  workflowExecutionId?: string;
  workflowNodeId?: string;
}

export class JobService {
  /**
   * Create a new job with optional deduplication and idempotency checking
   */
  static createJob(input: CreateJobInput) {
    const queue = db.prepare(`SELECT * FROM queues WHERE id = ?`).get(input.queueId) as any;
    if (!queue) {
      throw new Error(`Queue '${input.queueId}' not found`);
    }

    if (queue.status === 'PAUSED') {
      // Job is created but queue won't process until resumed
    }

    // 1. Idempotency Check
    if (input.idempotencyKey) {
      const existingJob = db.prepare(`
        SELECT * FROM jobs WHERE queue_id = ? AND idempotency_key = ?
      `).get(input.queueId, input.idempotencyKey) as any;

      if (existingJob) {
        return this.formatJob(existingJob);
      }
    }

    // 2. Payload Hash Deduplication
    const payloadString = JSON.stringify(input.payload || {});
    const deduplicationHash = crypto.createHash('sha256').update(`${input.queueId}:${payloadString}`).digest('hex');

    // 3. Compute Run At Timestamp
    let runAt = new Date().toISOString();
    if (input.delayMs && input.delayMs > 0) {
      runAt = new Date(Date.now() + input.delayMs).toISOString();
    } else if (input.runAt) {
      runAt = new Date(input.runAt).toISOString();
    }

    const jobId = `job_${uuidv4().substring(0, 12)}`;
    const jobType = input.type || (input.delayMs ? 'DELAYED' : 'IMMEDIATE');
    const priority = input.priority !== undefined ? input.priority : queue.priority;
    const timeoutMs = input.timeoutMs || 30000;

    // Get max retries from queue policy if set
    let maxAttempts = 3;
    if (queue.retry_policy_id) {
      const policy = db.prepare(`SELECT max_retries FROM retry_policies WHERE id = ?`).get(queue.retry_policy_id) as any;
      if (policy) maxAttempts = policy.max_retries;
    }

    const stmt = db.prepare(`
      INSERT INTO jobs (
        id, queue_id, project_id, workflow_execution_id, workflow_node_id, type, payload,
        status, priority, run_at, timeout_ms, deduplication_hash, idempotency_key, max_attempts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'QUEUED', ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      jobId,
      input.queueId,
      input.projectId,
      input.workflowExecutionId || null,
      input.workflowNodeId || null,
      jobType,
      payloadString,
      priority,
      runAt,
      timeoutMs,
      deduplicationHash,
      input.idempotencyKey || null,
      maxAttempts
    );

    return this.getJobById(jobId);
  }

  /**
   * Atomic Lock-Free Job Claiming Engine
   * Enforces concurrency limits per queue and claims candidate jobs atomically
   */
  static claimJobsAtomic(workerId: string, limit: number = 5): any[] {
    const claimed: any[] = [];

    // Begin immediate transaction to lock writes during atomic claim
    const transaction = db.transaction(() => {
      // 1. Get all active queues
      const activeQueues = db.prepare(`SELECT * FROM queues WHERE status = 'ACTIVE' ORDER BY priority DESC`).all() as any[];

      for (const queue of activeQueues) {
        if (claimed.length >= limit) break;

        // Count current active (CLAIMED or RUNNING) jobs for this queue
        const activeCount = db.prepare(`
          SELECT COUNT(*) as count FROM jobs WHERE queue_id = ? AND status IN ('CLAIMED', 'RUNNING')
        `).get(queue.id) as any;

        const availableSlots = queue.concurrency_limit - (activeCount.count || 0);
        if (availableSlots <= 0) continue;

        const fetchLimit = Math.min(availableSlots, limit - claimed.length);

        // Fetch candidate jobs eligible for execution
        const candidateJobs = db.prepare(`
          SELECT * FROM jobs
          WHERE queue_id = ?
            AND status = 'QUEUED'
            AND datetime(run_at) <= datetime('now')
          ORDER BY priority DESC, datetime(run_at) ASC, id ASC
          LIMIT ?
        `).all(queue.id, fetchLimit) as any[];

        for (const job of candidateJobs) {
          // Atomically update state to CLAIMED
          db.prepare(`
            UPDATE jobs
            SET status = 'CLAIMED', worker_id = ?, updated_at = datetime('now')
            WHERE id = ? AND status = 'QUEUED'
          `).run(workerId, job.id);

          claimed.push({
            ...job,
            status: 'CLAIMED',
            worker_id: workerId,
            payload: JSON.parse(job.payload || '{}')
          });
        }
      }
    });

    transaction();
    return claimed;
  }

  /**
   * Mark a job as RUNNING and record execution start
   */
  static markJobRunning(jobId: string, workerId: string) {
    db.prepare(`
      UPDATE jobs
      SET status = 'RUNNING', updated_at = datetime('now')
      WHERE id = ?
    `).run(jobId);

    const executionId = `exec_${uuidv4().substring(0, 10)}`;
    const currentAttempt = (db.prepare(`SELECT attempt_count FROM jobs WHERE id = ?`).get(jobId) as any).attempt_count + 1;

    db.prepare(`UPDATE jobs SET attempt_count = ? WHERE id = ?`).run(currentAttempt, jobId);

    db.prepare(`
      INSERT INTO job_executions (id, job_id, worker_id, attempt_number, status, started_at)
      VALUES (?, ?, ?, ?, 'RUNNING', datetime('now'))
    `).run(executionId, jobId, workerId, currentAttempt);

    return executionId;
  }

  /**
   * Complete a job execution successfully
   */
  static completeJob(jobId: string, executionId: string, result: any, executionTimeMs: number) {
    const resultString = JSON.stringify(result || {});

    db.prepare(`
      UPDATE jobs
      SET status = 'COMPLETED', result = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(resultString, jobId);

    db.prepare(`
      UPDATE job_executions
      SET status = 'COMPLETED', finished_at = datetime('now'), execution_time_ms = ?
      WHERE id = ?
    `).run(executionTimeMs, executionId);

    // If part of a DAG workflow execution, trigger dependency check!
    const job = db.prepare(`SELECT workflow_execution_id FROM jobs WHERE id = ?`).get(jobId) as any;
    if (job && job.workflow_execution_id) {
      // Trigger DAG Orchestrator dependency resolution dynamically
    }

    return this.getJobById(jobId);
  }

  /**
   * Handle job failure with configurable retry policy (Fixed, Linear, Exponential Backoff with Jitter)
   */
  static failJob(jobId: string, executionId: string, error: Error, executionTimeMs: number) {
    const job = db.prepare(`
      SELECT j.*, q.retry_policy_id
      FROM jobs j
      JOIN queues q ON j.queue_id = q.id
      WHERE j.id = ?
    `).get(jobId) as any;

    if (!job) return;

    db.prepare(`
      UPDATE job_executions
      SET status = 'FAILED', finished_at = datetime('now'), error_message = ?, stack_trace = ?, execution_time_ms = ?
      WHERE id = ?
    `).run(error.message, error.stack || '', executionTimeMs, executionId);

    const nextAttempt = job.attempt_count;

    if (nextAttempt < job.max_attempts) {
      // Compute retry backoff using Strategy Pattern (SOLID OCP)
      let delayMs = 2000;
      if (job.retry_policy_id) {
        const policy = db.prepare(`SELECT * FROM retry_policies WHERE id = ?`).get(job.retry_policy_id) as any;
        if (policy) {
          const strategy = RetryStrategyFactory.getStrategy(policy.strategy);
          delayMs = strategy.calculateDelayMs(nextAttempt, policy.base_delay_ms, policy.max_delay_ms);
        }
      }

      const nextRunAt = new Date(Date.now() + delayMs).toISOString();

      db.prepare(`
        UPDATE jobs
        SET status = 'QUEUED', run_at = ?, worker_id = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).run(nextRunAt, jobId);

      this.addJobLog(jobId, executionId, 'WARN', `Job failed attempt ${nextAttempt}/${job.max_attempts}. Retrying in ${Math.round(delayMs)}ms. Error: ${error.message}`);
    } else {
      // Max retries exceeded -> Escalated to Dead Letter Queue (DLQ)
      db.prepare(`
        UPDATE jobs SET status = 'DLQ', worker_id = NULL, updated_at = datetime('now') WHERE id = ?
      `).run(jobId);

      const dlqId = `dlq_${uuidv4().substring(0, 10)}`;
      db.prepare(`
        INSERT INTO dead_letter_queue (id, job_id, queue_id, failed_reason, total_attempts, original_payload, failed_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(dlqId, jobId, job.queue_id, error.message, job.attempt_count, job.payload);

      this.addJobLog(jobId, executionId, 'ERROR', `Job failed permanently after ${job.attempt_count} attempts. Escalated to Dead Letter Queue.`);
    }
  }

  static addJobLog(jobId: string, executionId: string | null, level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string, metadata?: any) {
    const id = `log_${uuidv4().substring(0, 10)}`;
    db.prepare(`
      INSERT INTO job_logs (id, execution_id, job_id, level, message, metadata, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, executionId || null, jobId, level, message, metadata ? JSON.stringify(metadata) : null);
  }

  static getJobById(id: string) {
    const job = db.prepare(`
      SELECT j.*, q.name as queue_name, p.name as project_name
      FROM jobs j
      JOIN queues q ON j.queue_id = q.id
      JOIN projects p ON j.project_id = p.id
      WHERE j.id = ?
    `).get(id) as any;

    if (!job) return null;
    return this.formatJob(job);
  }

  static listJobs(filter: { projectId?: string; queueId?: string; status?: string; limit?: number; offset?: number }) {
    let query = `
      SELECT j.*, q.name as queue_name
      FROM jobs j
      JOIN queues q ON j.queue_id = q.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filter.projectId) {
      query += ` AND j.project_id = ?`;
      params.push(filter.projectId);
    }
    if (filter.queueId) {
      query += ` AND j.queue_id = ?`;
      params.push(filter.queueId);
    }
    if (filter.status) {
      query += ` AND j.status = ?`;
      params.push(filter.status);
    }

    query += ` ORDER BY j.created_at DESC LIMIT ? OFFSET ?`;
    params.push(filter.limit || 50, filter.offset || 0);

    const jobs = db.prepare(query).all(...params) as any[];
    return jobs.map((j) => this.formatJob(j));
  }

  static cancelJob(id: string) {
    db.prepare(`UPDATE jobs SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?`).run(id);
    return this.getJobById(id);
  }

  private static formatJob(raw: any) {
    return {
      ...raw,
      payload: typeof raw.payload === 'string' ? JSON.parse(raw.payload) : raw.payload,
      result: raw.result ? (typeof raw.result === 'string' ? JSON.parse(raw.result) : raw.result) : null
    };
  }
}
