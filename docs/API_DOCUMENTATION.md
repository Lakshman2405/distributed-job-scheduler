# 📡 ApexQueue REST API & WebSocket Protocol Reference

ApexQueue exposes a clean RESTful API Gateway for client applications and worker SDKs, alongside a WebSocket telemetry server for real-time dashboard updates.

---

## 1. Authentication & Security

All REST requests accept standard HTTP Authentication headers:

- **JWT Token**: `Authorization: Bearer <token>`
- **Project API Key**: `x-api-key: apex_live_key_99887766`

---

## 2. REST API Endpoints Reference (`/api/v1`)

### A. Authentication & User Management

#### `POST /api/v1/auth/login`
Sign in with email and password.
- **Request Body**:
  ```json
  {
    "email": "admin@apex.local",
    "password": "password123"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_admin_01",
      "email": "admin@apex.local",
      "role": "SUPER_ADMIN",
      "orgId": "org_default"
    }
  }
  ```

#### `GET /api/v1/auth/me`
Retrieve active session details.

---

### B. Job Management

#### `POST /api/v1/jobs`
Enqueue a new background job.
- **Request Body**:
  ```json
  {
    "queueId": "queue_payments",
    "type": "IMMEDIATE",
    "payload": {
      "transactionId": "tx_998811",
      "amount": 250.00,
      "recipient": "Vendor LLC"
    },
    "priority": 8,
    "delayMs": 0,
    "idempotencyKey": "tx_idem_998811"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "job": {
      "id": "job_a1b2c3d4",
      "queue_id": "queue_payments",
      "status": "QUEUED",
      "priority": 8,
      "run_at": "2026-08-19T23:55:00.000Z",
      "attempt_count": 0,
      "max_attempts": 3
    }
  }
  ```

#### `GET /api/v1/jobs`
List background jobs with status and queue filtering.
- **Query Parameters**: `queueId`, `status`, `limit`, `offset`

#### `GET /api/v1/jobs/:id/logs`
Fetch execution logs and terminal output for a specific job.

---

### C. Queue Management

#### `GET /api/v1/queues`
Fetch partition queues with live metrics.
- **Response (200 OK)**:
  ```json
  {
    "queues": [
      {
        "id": "queue_payments",
        "name": "payments-realtime",
        "priority": 9,
        "concurrency_limit": 10,
        "rate_limit_per_sec": 100,
        "status": "ACTIVE",
        "metrics": {
          "queued": 2,
          "active": 3,
          "completed": 150,
          "failed": 0,
          "concurrencyUtilizationPct": 30
        }
      }
    ]
  }
  ```

#### `POST /api/v1/queues/:id/pause`
Pause a queue partition.

#### `POST /api/v1/queues/:id/resume`
Resume a paused queue partition.

---

### D. DAG Workflows

#### `GET /api/v1/workflows`
List multi-step DAG workflows.

#### `POST /api/v1/workflows/:id/execute`
Execute a DAG workflow pipeline.

---

### E. Dead Letter Queue & AI Diagnostics

#### `GET /api/v1/dlq`
Fetch poison-pill jobs escalated to the Dead Letter Queue.

#### `POST /api/v1/dlq/:id/ai-analyze`
Trigger LLM root cause failure analysis.
- **Response (200 OK)**:
  ```json
  {
    "report": {
      "category": "MEMORY_FAULT",
      "rootCause": "Fatal memory access fault during execution payload processing.",
      "recommendedFix": "Lower workload batch size from 5000 to 500 items.",
      "patchedPayload": {
        "batchSize": 500,
        "mode": "SAFE_RETRY"
      }
    }
  }
  ```

#### `POST /api/v1/dlq/:id/replay`
Replay a DLQ job with an optional patched payload.

---

### F. Chaos Engineering Resilience Lab

#### `POST /api/v1/chaos/trigger`
Inject simulated infrastructure failures.
- **Request Body**:
  ```json
  {
    "type": "WORKER_CRASH"
  }
  ```
  *(Options: `WORKER_CRASH`, `POISON_PILL`, `QUEUE_BACKLOG`)*

---

## 3. WebSocket Telemetry Protocol (`ws://localhost:4000/ws/telemetry`)

Clients subscribe to real-time execution events over WebSocket:

```json
{
  "type": "JOB_STATE_CHANGE",
  "jobId": "job_a1b2c3d4",
  "status": "RUNNING",
  "workerId": "worker_01",
  "timestamp": "2026-08-19T23:55:01.000Z"
}
```
