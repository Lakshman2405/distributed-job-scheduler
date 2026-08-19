# ApexQueue REST API & WebSocket Interface Reference

Base URL: `http://localhost:4000/api/v1`

---

## 1. Authentication Endpoints

### `POST /auth/login`
Authenticates a user and returns a JWT Bearer token.
- **Request Body**: `{ "email": "admin@apex.local", "password": "password123" }`
- **Response**: `{ "token": "...", "user": { ... } }`

### `POST /auth/register`
Registers a new user account and organization.

---

## 2. Queue Endpoints

### `GET /queues`
Retrieves all queues for a project with real-time backlog metrics.

### `POST /queues`
Creates a new execution queue partition.
- **Request Body**: `{ "name": "email-queue", "priority": 8, "concurrencyLimit": 5 }`

### `PUT /queues/:id/status`
Updates queue execution status (`ACTIVE`, `PAUSED`, `DRAINING`).

---

## 3. Job Endpoints

### `GET /jobs`
Lists jobs with pagination and status filtering (`QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `DLQ`).

### `POST /jobs`
Enqueues a new background job.
- **Request Body**:
```json
{
  "queueId": "queue_123",
  "payload": { "task": "generate_report", "reportId": 42 },
  "priority": 9,
  "delayMs": 5000,
  "idempotencyKey": "idem_report_42"
}
```

### `GET /jobs/:id`
Retrieves job execution details, streaming logs, and attempt history.

---

## 4. Workflow (DAG) Endpoints

### `GET /workflows`
Lists all DAG pipeline definitions.

### `POST /workflows/:id/execute`
Triggers topological execution of a multi-step DAG pipeline.

---

## 5. Dead Letter Queue & AI Diagnostics

### `GET /dlq`
Lists permanent failure entries in the Dead Letter Queue.

### `POST /dlq/:id/ai-analyze`
Generates an AI root-cause diagnostic report for a failed job.

### `POST /dlq/:id/replay`
Replays a DLQ job with optional patched payload.

---

## 6. Chaos & Resilience Testing

### `POST /chaos/trigger`
Triggers live chaos fault injection.
- **Request Body**: `{ "type": "WORKER_CRASH" | "POISON_PILL" | "QUEUE_BACKLOG" }`

---

## 7. Prometheus Metrics & Telemetry

- **Prometheus Metrics**: `GET http://localhost:4000/metrics`
- **WebSocket Live Stream**: `ws://localhost:4000/ws/telemetry`
