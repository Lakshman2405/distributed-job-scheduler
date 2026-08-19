import { db } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';

export class WorkerService {
  static registerWorker(workerPoolId?: string, maxConcurrency: number = 5): any {
    const workerId = `worker_${uuidv4().substring(0, 8)}`;
    const hostname = os.hostname();
    const pid = process.pid;

    db.prepare(`
      INSERT INTO workers (id, worker_pool_id, hostname, pid, capabilities, status, current_concurrency, max_concurrency, registered_at, last_heartbeat_at)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0, ?, datetime('now'), datetime('now'))
    `).run(workerId, workerPoolId || null, hostname, pid, JSON.stringify(['general', 'js-execution']), maxConcurrency);

    return this.getWorkerById(workerId);
  }

  static sendHeartbeat(workerId: string, activeJobsCount: number, cpuPct: number = 10, memoryMb: number = 120) {
    db.prepare(`
      UPDATE workers
      SET last_heartbeat_at = datetime('now'), current_concurrency = ?, status = 'ACTIVE'
      WHERE id = ?
    `).run(activeJobsCount, workerId);

    const hbId = `hb_${uuidv4().substring(0, 8)}`;
    db.prepare(`
      INSERT INTO worker_heartbeats (id, worker_id, cpu_pct, memory_mb, active_jobs_count, timestamp)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(hbId, workerId, cpuPct, memoryMb, activeJobsCount);
  }

  static setWorkerStatus(workerId: string, status: 'ACTIVE' | 'DRAINING' | 'DEAD') {
    db.prepare(`UPDATE workers SET status = ? WHERE id = ?`).run(status, workerId);
    return this.getWorkerById(workerId);
  }

  static listWorkers() {
    const workers = db.prepare(`SELECT * FROM workers ORDER BY registered_at DESC`).all() as any[];
    return workers.map((w) => ({
      ...w,
      capabilities: typeof w.capabilities === 'string' ? JSON.parse(w.capabilities) : w.capabilities
    }));
  }

  static getWorkerById(workerId: string): any {
    return db.prepare(`SELECT * FROM workers WHERE id = ?`).get(workerId) as any;
  }
}
