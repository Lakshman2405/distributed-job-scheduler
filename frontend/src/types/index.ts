export interface Queue {
  id: string;
  project_id: string;
  worker_pool_id?: string;
  name: string;
  priority: number;
  concurrency_limit: number;
  rate_limit_per_sec: number;
  retry_policy_id?: string;
  retry_policy_name?: string;
  status: 'ACTIVE' | 'PAUSED' | 'DRAINING';
  created_at: string;
  metrics?: {
    queued: number;
    active: number;
    completed: number;
    failed: number;
    concurrencyUtilizationPct: number;
  };
}

export interface Job {
  id: string;
  queue_id: string;
  queue_name?: string;
  project_id: string;
  workflow_execution_id?: string;
  workflow_node_id?: string;
  type: 'IMMEDIATE' | 'DELAYED' | 'SCHEDULED' | 'CRON' | 'DAG_STEP';
  payload: Record<string, any>;
  result?: Record<string, any>;
  status: 'QUEUED' | 'SCHEDULED' | 'CLAIMED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING' | 'CANCELLED' | 'DLQ';
  priority: number;
  run_at: string;
  timeout_ms: number;
  attempt_count: number;
  max_attempts: number;
  worker_id?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkerNode {
  id: string;
  worker_pool_id?: string;
  hostname: string;
  pid: number;
  capabilities: string[];
  status: 'ACTIVE' | 'DRAINING' | 'DEAD';
  current_concurrency: number;
  max_concurrency: number;
  registered_at: string;
  last_heartbeat_at: string;
}

export interface WorkflowNode {
  id: string;
  workflow_id: string;
  name: string;
  queue_id: string;
  payload_template: Record<string, any>;
  parent_node_ids: string[];
  join_condition: 'ALL_SUCCESS' | 'ANY_SUCCESS';
}

export interface Workflow {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  trigger_type: string;
  nodes: WorkflowNode[];
  created_at: string;
}

export interface DlqEntry {
  id: string;
  job_id: string;
  queue_id: string;
  queue_name?: string;
  failed_reason: string;
  total_attempts: number;
  original_payload: Record<string, any>;
  ai_summary?: string;
  ai_recommended_fix?: string;
  failed_at: string;
}

export interface SystemHealth {
  status: string;
  timestamp: string;
  jobs: {
    total: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
  };
  workers: {
    total: number;
    active: number;
    dead: number;
  };
  queues: {
    activeCount: number;
  };
  dlq: {
    pendingCount: number;
  };
}
