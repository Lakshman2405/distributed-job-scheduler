# Software Engineering Principles & Architectural Patterns Matrix

ApexQueue is built adhering strictly to enterprise Software Engineering principles, SOLID design guidelines, and fault-tolerance patterns.

---

## 1. SOLID Principles Implementation

### A. Single Responsibility Principle (SRP)
- **Data Access Layer (`JobRepository.ts`, `QueueRepository.ts`)**: Handles only database queries and SQL isolation.
- **Service Domain Layer (`JobService.ts`, `QueueService.ts`)**: Handles core business logic, status transitions, and retry policies.
- **Presentation Gateway Layer (`apiRoutes.ts`)**: Handles HTTP REST request validation, response formatting, and status codes.

### B. Open/Closed Principle (OCP)
- **Pluggable Strategy Pattern for Retries (`RetryStrategy.ts`)**:
  - The `IRetryStrategy` interface allows new retry strategies (e.g. `FibonacciBackoff`, `ExponentialJitter`) to be added without modifying existing `JobService` execution code.

### C. Liskov Substitution Principle (LSP)
- All concrete retry implementations (`FixedRetryStrategy`, `LinearRetryStrategy`, `ExponentialJitterRetryStrategy`) can be substituted interchangeably through the `IRetryStrategy` interface without altering system behavior.

### D. Interface Segregation Principle (ISP)
- Small, focused interfaces: `IRetryStrategy`, `IJobRepository`, `IWorkerDaemon`, `ITelemetryPublisher`. Clients depend only on the specific methods they require.

### E. Dependency Inversion Principle (DIP)
- High-level orchestrators (`WorkerDaemon`) depend on storage and strategy abstractions rather than hardcoded query logic.

---

## 2. Design Patterns Applied

| Pattern Name | Location in Codebase | Purpose & Benefit |
| :--- | :--- | :--- |
| **Strategy Pattern** | `src/patterns/strategies/RetryStrategy.ts` | Pluggable backoff algorithms (Fixed, Linear, Exponential Jitter) for job failures. |
| **Circuit Breaker Pattern** | `src/patterns/circuitBreaker/CircuitBreaker.ts` | Trips queue execution to `OPEN` state during high error spikes, protecting downstream databases. |
| **Repository Pattern** | `src/patterns/repositories/JobRepository.ts` | Decouples SQL database queries away from domain services. |
| **Active-Passive Leader Election** | `src/services/LeaderElectionService.ts` | Lease-lock coordinator preventing split-brain cron execution during scale-out. |
| **Hashed Timing Wheel** | `src/services/TimingWheelService.ts` | O(1) time-slot index engine for high-precision sub-second job scheduling. |
| **Observer (Pub/Sub) Pattern** | `src/websocket/telemetryServer.ts` | Decouples worker execution daemons from real-time WebSocket dashboard broadcasts. |
| **Idempotency Key Pattern** | `src/services/JobService.ts` | Payload deduplication window preventing duplicate execution side-effects. |
| **Dead Worker Reaper (Daemon Pattern)** | `src/workers/StaleWorkerReaper.ts` | Heartbeat monitoring daemon auto-reclaiming claimed jobs from crashed workers. |

---

## 3. Resilience & Fault Isolation Patterns

1. **Bulkhead Worker Isolation**: Distinct worker pools (`pool_general` vs `pool_gpu`) isolate heavy background execution workloads so high-memory tasks never starve real-time queues.
2. **Exponential Backoff with Full Jitter**: Randomizes retry delays (`MIN(max_delay, random(0, base * 2^attempt))`), eliminating thundering herd traffic against failing services.
3. **Poison Pill Escaper (DLQ)**: Infinite loop detector moving non-recoverable job payloads to the Dead Letter Queue for AI root-cause diagnostic analysis.
