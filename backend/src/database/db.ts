import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../../apexqueue.db');

// Ensure directory exists
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new Database(dbPath);

// Enable WAL mode for high concurrency write-ahead logging & pragmas
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    -- Organizations
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Users
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'DEVELOPER', -- SUPER_ADMIN, ORG_ADMIN, DEVELOPER, VIEWER
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Projects
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      api_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Worker Pools
    CREATE TABLE IF NOT EXISTS worker_pools (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]', -- JSON Array e.g. ["gpu", "general"]
      max_workers INTEGER NOT NULL DEFAULT 10,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Retry Policies
    CREATE TABLE IF NOT EXISTS retry_policies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      strategy TEXT NOT NULL DEFAULT 'EXPONENTIAL_JITTER', -- FIXED, LINEAR, EXPONENTIAL_JITTER
      max_retries INTEGER NOT NULL DEFAULT 3,
      base_delay_ms INTEGER NOT NULL DEFAULT 1000,
      max_delay_ms INTEGER NOT NULL DEFAULT 60000,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Queues
    CREATE TABLE IF NOT EXISTS queues (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      worker_pool_id TEXT REFERENCES worker_pools(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 5, -- 1 (lowest) to 10 (highest)
      concurrency_limit INTEGER NOT NULL DEFAULT 5,
      rate_limit_per_sec INTEGER NOT NULL DEFAULT 100,
      retry_policy_id TEXT REFERENCES retry_policies(id),
      status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, PAUSED, DRAINING
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Workflows (DAG definitions)
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      trigger_type TEXT NOT NULL DEFAULT 'MANUAL', -- MANUAL, SCHEDULED, WEBHOOK
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Workflow Nodes
    CREATE TABLE IF NOT EXISTS workflow_nodes (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      queue_id TEXT NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
      payload_template TEXT NOT NULL DEFAULT '{}',
      parent_node_ids TEXT NOT NULL DEFAULT '[]', -- JSON array of parent workflow_node.id
      join_condition TEXT NOT NULL DEFAULT 'ALL_SUCCESS', -- ALL_SUCCESS, ANY_SUCCESS
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Jobs Table (Central Entity)
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      queue_id TEXT NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      workflow_execution_id TEXT,
      workflow_node_id TEXT,
      type TEXT NOT NULL DEFAULT 'IMMEDIATE', -- IMMEDIATE, DELAYED, SCHEDULED, CRON, DAG_STEP
      payload TEXT NOT NULL DEFAULT '{}', -- JSON string
      result TEXT,
      status TEXT NOT NULL DEFAULT 'QUEUED', -- QUEUED, SCHEDULED, CLAIMED, RUNNING, COMPLETED, FAILED, RETRYING, CANCELLED, DLQ
      priority INTEGER NOT NULL DEFAULT 5,
      run_at TEXT NOT NULL DEFAULT (datetime('now')),
      timeout_ms INTEGER NOT NULL DEFAULT 30000,
      deduplication_hash TEXT,
      idempotency_key TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      worker_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Job Dependencies (Runtime DAG state)
    CREATE TABLE IF NOT EXISTS job_dependencies (
      id TEXT PRIMARY KEY,
      parent_job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      child_job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'WAITING', -- WAITING, SATISFIED, FAILED
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Workers
    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY,
      worker_pool_id TEXT REFERENCES worker_pools(id) ON DELETE SET NULL,
      hostname TEXT NOT NULL,
      pid INTEGER NOT NULL,
      capabilities TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, DRAINING, DEAD
      current_concurrency INTEGER NOT NULL DEFAULT 0,
      max_concurrency INTEGER NOT NULL DEFAULT 5,
      registered_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_heartbeat_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Worker Heartbeats
    CREATE TABLE IF NOT EXISTS worker_heartbeats (
      id TEXT PRIMARY KEY,
      worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      cpu_pct REAL NOT NULL DEFAULT 0.0,
      memory_mb REAL NOT NULL DEFAULT 0.0,
      active_jobs_count INTEGER NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Job Executions (Attempt Log)
    CREATE TABLE IF NOT EXISTS job_executions (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      worker_id TEXT REFERENCES workers(id) ON DELETE SET NULL,
      attempt_number INTEGER NOT NULL,
      status TEXT NOT NULL, -- RUNNING, COMPLETED, FAILED, TIMED_OUT
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT,
      error_message TEXT,
      stack_trace TEXT,
      execution_time_ms INTEGER
    );

    -- Job Logs (Streaming Output)
    CREATE TABLE IF NOT EXISTS job_logs (
      id TEXT PRIMARY KEY,
      execution_id TEXT REFERENCES job_executions(id) ON DELETE CASCADE,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      level TEXT NOT NULL DEFAULT 'INFO', -- DEBUG, INFO, WARN, ERROR
      message TEXT NOT NULL,
      metadata TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Scheduled Jobs (Cron definitions)
    CREATE TABLE IF NOT EXISTS scheduled_jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      queue_id TEXT NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      payload TEXT NOT NULL DEFAULT '{}',
      next_run_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, PAUSED
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Dead Letter Queue (DLQ)
    CREATE TABLE IF NOT EXISTS dead_letter_queue (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      queue_id TEXT NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
      failed_reason TEXT NOT NULL,
      total_attempts INTEGER NOT NULL,
      original_payload TEXT NOT NULL,
      ai_summary TEXT,
      ai_recommended_fix TEXT,
      failed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- System Locks / Leader Election table
    CREATE TABLE IF NOT EXISTS system_locks (
      lock_key TEXT PRIMARY KEY,
      holder_id TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    ---------------------------------------------------------
    -- INDEXES FOR HIGH-PERFORMANCE QUERYING & ATOMIC CLAIMS
    ---------------------------------------------------------
    CREATE INDEX IF NOT EXISTS idx_jobs_claim ON jobs(queue_id, status, priority DESC, run_at ASC);
    CREATE INDEX IF NOT EXISTS idx_jobs_status_runat ON jobs(status, run_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_dedup ON jobs(deduplication_hash);
    CREATE INDEX IF NOT EXISTS idx_workers_heartbeat ON workers(status, last_heartbeat_at);
    CREATE INDEX IF NOT EXISTS idx_job_logs_job ON job_logs(job_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_scheduled_nextrun ON scheduled_jobs(status, next_run_at);
  `);
}

export function closeDatabase() {
  db.close();
}
