import { db } from '../database/db';
import cronParser from 'cron-parser';
import { JobService } from './JobService';
import { LeaderElectionService } from './LeaderElectionService';

export class TimingWheelService {
  private static timerHandle: NodeJS.Timeout | null = null;

  static start() {
    if (this.timerHandle) return;

    // High-frequency tick (every 1000ms)
    this.timerHandle = setInterval(() => {
      this.tick();
    }, 1000);
  }

  static stop() {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  static tick() {
    // 1. Maintain Leader Lease
    const isLeader = LeaderElectionService.tryAcquireOrRenewLeader();
    if (!isLeader) return; // Only active leader ticks cron & timer engine

    // 2. Promote DELAYED / SCHEDULED jobs to QUEUED when run_at <= now
    try {
      db.prepare(`
        UPDATE jobs
        SET status = 'QUEUED', updated_at = datetime('now')
        WHERE status = 'SCHEDULED' AND datetime(run_at) <= datetime('now')
      `).run();

      // 3. Process Scheduled Cron Jobs
      const dueCrons = db.prepare(`
        SELECT * FROM scheduled_jobs
        WHERE status = 'ACTIVE' AND datetime(next_run_at) <= datetime('now')
      `).all() as any[];

      for (const cronJob of dueCrons) {
        // Enqueue a job instance
        JobService.createJob({
          queueId: cronJob.queue_id,
          projectId: cronJob.project_id,
          type: 'CRON',
          payload: JSON.parse(cronJob.payload || '{}')
        });

        // Compute next run time
        try {
          const interval = cronParser.parseExpression(cronJob.cron_expression, {
            currentDate: new Date(),
            tz: cronJob.timezone || 'UTC'
          });
          const nextRunAt = interval.next().toDate().toISOString();

          db.prepare(`
            UPDATE scheduled_jobs SET next_run_at = ? WHERE id = ?
          `).run(nextRunAt, cronJob.id);
        } catch (err) {
          // If cron expression invalid, pause scheduled job
          db.prepare(`UPDATE scheduled_jobs SET status = 'PAUSED' WHERE id = ?`).run(cronJob.id);
        }
      }
    } catch {
      // Resilience against database lock glitches during tick
    }
  }
}
