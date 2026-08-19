import { db } from '../database/db';

export class MetricsService {
  static getSystemHealth() {
    const jobStats = db.prepare(`
      SELECT
        COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'QUEUED' THEN 1 ELSE 0 END) as queued,
        SUM(CASE WHEN status = 'RUNNING' THEN 1 ELSE 0 END) as running,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status IN ('FAILED', 'DLQ') THEN 1 ELSE 0 END) as failed
      FROM jobs
    `).get() as any;

    const workerStats = db.prepare(`
      SELECT
        COUNT(*) as total_workers,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_workers,
        SUM(CASE WHEN status = 'DEAD' THEN 1 ELSE 0 END) as dead_workers
      FROM workers
    `).get() as any;

    const queueStats = db.prepare(`
      SELECT COUNT(*) as total_queues FROM queues WHERE status = 'ACTIVE'
    `).get() as any;

    const dlqCount = db.prepare(`SELECT COUNT(*) as count FROM dead_letter_queue`).get() as any;

    return {
      status: 'HEALTHY',
      timestamp: new Date().toISOString(),
      jobs: {
        total: jobStats.total_jobs || 0,
        queued: jobStats.queued || 0,
        running: jobStats.running || 0,
        completed: jobStats.completed || 0,
        failed: jobStats.failed || 0
      },
      workers: {
        total: workerStats.total_workers || 0,
        active: workerStats.active_workers || 0,
        dead: workerStats.dead_workers || 0
      },
      queues: {
        activeCount: queueStats.total_queues || 0
      },
      dlq: {
        pendingCount: dlqCount.count || 0
      }
    };
  }

  static generatePrometheusMetrics(): string {
    const health = this.getSystemHealth();

    return `
# HELP apexqueue_jobs_total Total jobs recorded by status
# TYPE apexqueue_jobs_total counter
apexqueue_jobs_total{status="queued"} ${health.jobs.queued}
apexqueue_jobs_total{status="running"} ${health.jobs.running}
apexqueue_jobs_total{status="completed"} ${health.jobs.completed}
apexqueue_jobs_total{status="failed"} ${health.jobs.failed}

# HELP apexqueue_workers_active Number of active workers
# TYPE apexqueue_workers_active gauge
apexqueue_workers_active ${health.workers.active}

# HELP apexqueue_dlq_size Current count of dead letter queue entries
# TYPE apexqueue_dlq_size gauge
apexqueue_dlq_size ${health.dlq.pendingCount}
    `.trim();
  }
}
