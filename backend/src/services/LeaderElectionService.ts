import { db } from '../database/db';
import os from 'os';

export class LeaderElectionService {
  private static instanceId: string = `leader_node_${os.hostname()}_${process.pid}`;
  private static isLeader: boolean = false;
  private static lockKey: string = 'APEX_SCHEDULER_LEADER_LOCK';
  private static leaseDurationMs: number = 10000;

  static tryAcquireOrRenewLeader(): boolean {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.leaseDurationMs).toISOString();

    db.exec(`BEGIN TRANSACTION;`);
    try {
      const lock = db.prepare(`SELECT * FROM system_locks WHERE lock_key = ?`).get(this.lockKey) as any;

      if (!lock) {
        // No leader exists, claim leadership!
        db.prepare(`
          INSERT INTO system_locks (lock_key, holder_id, expires_at)
          VALUES (?, ?, ?)
        `).run(this.lockKey, this.instanceId, expiresAt);
        this.isLeader = true;
      } else if (lock.holder_id === this.instanceId || new Date(lock.expires_at) < now) {
        // Renew lease or claim expired lease from dead leader
        db.prepare(`
          UPDATE system_locks
          SET holder_id = ?, expires_at = ?
          WHERE lock_key = ?
        `).run(this.instanceId, expiresAt, this.lockKey);
        this.isLeader = true;
      } else {
        // Another active node holds the leader lock
        this.isLeader = false;
      }
      db.exec(`COMMIT;`);
    } catch {
      db.exec(`ROLLBACK;`);
      this.isLeader = false;
    }

    return this.isLeader;
  }

  static getIsLeader(): boolean {
    return this.isLeader;
  }

  static getInstanceId(): string {
    return this.instanceId;
  }
}
