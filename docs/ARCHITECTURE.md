# ApexQueue System Architecture Documentation

## 1. High-Level Component Topology

ApexQueue separates concerns into a **Control Plane** (REST API Gateway, Leader Election Coordinator, Hashed Timing Wheel Scheduler, WebSocket Telemetry Hub) and a **Worker Execution Cluster** (Stateless Worker Daemons, Atomic Job Claiming Engine, Sandbox Executors, Stale Worker Reapers).

```mermaid
sequenceDiagram
    participant API as REST API / SDK
    participant DB as Relational Store (Postgres / SQLite WAL)
    participant Worker as Worker Daemon
    participant WS as WebSocket Hub
    participant Dashboard as React Dashboard

    API->>DB: 1. Enqueue Job (Status: QUEUED, priority, run_at)
    Worker->>DB: 2. Atomic Claim (BEGIN IMMEDIATE / SKIP LOCKED)
    DB-->>Worker: 3. Candidate Job Reserved (Status: CLAIMED)
    Worker->>DB: 4. Execution Start (Status: RUNNING)
    Worker->>WS: 5. Stream Real-Time Logs & State Transition
    WS-->>Dashboard: 6. Broadcast Telemetry Pulse
    Worker->>DB: 7. Execution Complete (Status: COMPLETED / FAILED)
```

---

## 2. Job Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> QUEUED : Enqueued / Triggered
    [*] --> SCHEDULED : Future Delay / Cron
    SCHEDULED --> QUEUED : Run Timestamp Reached
    QUEUED --> CLAIMED : Atomic Worker Claim
    CLAIMED --> RUNNING : Worker Execution Start
    RUNNING --> COMPLETED : Execution Success
    RUNNING --> RETRYING : Attempt Fail & Retries Remaining
    RETRYING --> QUEUED : Exponential Backoff Delay
    RUNNING --> DLQ : Max Retries Exceeded / Poison Pill
    DLQ --> QUEUED : AI Patch & 1-Click Replay
    RUNNING --> CANCELLED : Cancel Triggered
```
