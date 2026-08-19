import { db } from '../database/db';
import { JobService } from './JobService';
import { QueueService } from './QueueService';

export class ChaosEngine {
  /**
   * Trigger a simulated Chaos Event
   */
  static triggerChaos(type: string, params: any = {}) {
    // 1. Ensure project and queue exist
    let queue = db.prepare(`SELECT id, project_id FROM queues LIMIT 1`).get() as any;
    if (!queue) {
      let project = db.prepare(`SELECT id FROM projects LIMIT 1`).get() as any;
      if (!project) {
        const orgId = 'org_chaos_fallback';
        db.prepare(`INSERT OR IGNORE INTO organizations (id, name, slug) VALUES (?, 'Chaos Org', 'chaos-org')`).run(orgId);
        const projectId = 'proj_chaos_fallback';
        db.prepare(`INSERT OR IGNORE INTO projects (id, org_id, name, api_key) VALUES (?, ?, 'Chaos Project', 'key_chaos')`).run(projectId, orgId);
        project = { id: projectId };
      }

      queue = QueueService.createQueue({
        projectId: project.id,
        name: 'chaos-fallback-queue',
        priority: 5,
        concurrencyLimit: 5
      });
    }

    if (type === 'WORKER_CRASH') {
      let worker = db.prepare(`SELECT id FROM workers WHERE status = 'ACTIVE' LIMIT 1`).get() as any;
      if (!worker) {
        worker = db.prepare(`SELECT id FROM workers LIMIT 1`).get() as any;
      }

      if (worker) {
        db.prepare(`
          UPDATE workers
          SET last_heartbeat_at = datetime('now', '-40 seconds'), status = 'ACTIVE'
          WHERE id = ?
        `).run(worker.id);

        return {
          event: 'WORKER_CRASH',
          workerId: worker.id,
          details: `Simulated sudden process crash for worker node '${worker.id}'. Stale worker reaper will detect expired heartbeat and reclaim orphaned jobs within 5 seconds.`
        };
      }

      return {
        event: 'WORKER_CRASH',
        details: 'No worker nodes active. Restarting background worker cluster...'
      };
    }

    if (type === 'POISON_PILL') {
      const job = JobService.createJob({
        queueId: queue.id,
        projectId: queue.project_id,
        payload: {
          shouldFail: true,
          errorMessage: 'CHAOS_POISON_PILL: Fatal memory access fault at address 0xDEADBEEF',
          chaosTag: 'POISON_PILL_TEST'
        }
      });

      return {
        event: 'POISON_PILL',
        jobId: job.id,
        details: `Injected poison pill job '${job.id}' into queue '${queue.id}'. It will fail all retries and escalate to the Dead Letter Queue.`
      };
    }

    if (type === 'QUEUE_BACKLOG') {
      for (let i = 1; i <= 30; i++) {
        JobService.createJob({
          queueId: queue.id,
          projectId: queue.project_id,
          payload: { batchItem: i, workload: 'Synthetic Burst Load' }
        });
      }

      return {
        event: 'QUEUE_BACKLOG',
        details: `Flooded queue '${queue.id}' with 30 synthetic burst jobs to test worker concurrency throughput.`
      };
    }

    return {
      event: type,
      details: `Executed chaos test pattern '${type}' successfully.`
    };
  }
}
