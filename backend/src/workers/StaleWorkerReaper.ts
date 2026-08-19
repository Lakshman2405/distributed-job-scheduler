import { db } from '../database/db';
import { LeaderElectionService } from '../services/LeaderElectionService';
import { v4 as uuidv4 } from 'uuid';

export class StaleWorkerReaper {
  private static timerHandle: NodeJS.Timeout | null = null;
  private static staleThresholdSeconds: number = 15;

  static start() {
    if (this.timerHandle) return;

    // Check for dead workers every 5 seconds
    this.timerHandle = setInterval(() => {
      this.reapStaleWorkers();
    }, 5000);
  }

  static stop() {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  static reapStaleWorkers(force: boolean = false) {
    if (!force && !LeaderElectionService.getIsLeader()) return;

    try {
      // Find workers whose last heartbeat is older than threshold
      const deadWorkers = db.prepare(`
        SELECT * FROM workers
        WHERE status != 'DEAD'
          AND datetime(last_heartbeat_at) < datetime('now', '-${this.staleThresholdSeconds} seconds')
      `).all() as any[];

      for (const worker of deadWorkers) {
        // Mark worker status as DEAD
        db.prepare(`UPDATE workers SET status = 'DEAD' WHERE id = ?`).run(worker.id);

        // Fetch orphan jobs claimed/running by this dead worker
        const orphanJobs = db.prepare(`
          SELECT * FROM jobs WHERE worker_id = ? AND status IN ('CLAIMED', 'RUNNING')
        `).all(worker.id) as any[];

        for (const job of orphanJobs) {
          if (job.attempt_count < job.max_attempts) {
            // Re-queue orphan job for another healthy worker
            db.prepare(`
              UPDATE jobs
              SET status = 'QUEUED', worker_id = NULL, updated_at = datetime('now')
              WHERE id = ?
            `).run(job.id);

            const logId = `log_${uuidv4().substring(0, 10)}`;
            db.prepare(`
              INSERT INTO job_logs (id, job_id, level, message, timestamp)
              VALUES (?, ?, 'WARN', ?, datetime('now'))
            `).run(logId, job.id, `Worker '${worker.id}' crashed/lost heartbeat. Job reclaimed and returned to QUEUED status.`);
          } else {
            // Escalate to DLQ if max attempts reached
            db.prepare(`
              UPDATE jobs SET status = 'DLQ', worker_id = NULL, updated_at = datetime('now') WHERE id = ?
            `).run(job.id);

            const dlqId = `dlq_${uuidv4().substring(0, 10)}`;
            db.prepare(`
              INSERT INTO dead_letter_queue (id, job_id, queue_id, failed_reason, total_attempts, original_payload, failed_at)
              VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            `).run(dlqId, job.id, job.queue_id, `Worker '${worker.id}' crashed during execution.`, job.attempt_count, job.payload);
          }
        }
      }
    } catch {
      // Resilience against transient DB lock contention
    }
  }
}
