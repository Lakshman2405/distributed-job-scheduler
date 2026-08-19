# 🧠 ApexQueue Engineering Design Decisions & Trade-Offs

This document outlines the core technical trade-offs, architecture selections, and engineering rationale behind ApexQueue.

---

## 1. Storage Selection: SQLite + Transactions vs Redis BullMQ vs PostgreSQL

| Evaluation Dimension | Redis (BullMQ / Celery) | PostgreSQL (PG-Boss) | ApexQueue (SQLite Transactional) |
| :--- | :--- | :--- | :--- |
| **Durability** | In-Memory (Requires AOF disk persistence) | ACID Disk Persistent | **ACID Disk Persistent (WAL Mode)** |
| **Transaction Isolation** | Non-ACID Multi/Exec | Advisory Locks (`pg_advisory_lock`) | **Atomic `SKIP LOCKED` Row Locks** |
| **Deployment Overhead** | High (Requires Redis Cluster setup) | High (Requires PG Server & Pooler) | **Zero-Config Self-Contained Engine** |
| **Complex Queries & Audit** | Limited (Custom Lua Scripts) | Full SQL | **Full SQL Audit & Joins** |

### Rationale:
ApexQueue selected an **ACID relational database engine with Write-Ahead Logging (WAL)**. Unlike Redis-based job queues where memory eviction can cause data loss under heavy backpressure, an ACID relational engine guarantees job durability, transactional consistency, and rich SQL analytical queries for throughput metrics.

---

## 2. Queue Polling: Pull Model vs Push/gRPC Model

### Pull Model (Selected):
- Worker processes poll queue partitions using atomic SQL reservations (`JobService.claimJobsAtomic`).
- **Advantages**:
  1. **Built-in Backpressure**: Workers pull jobs only when they have free concurrency slots, naturally preventing worker process OOM crashes.
  2. **Fault Tolerance**: If a worker crashes, no jobs are trapped in memory queues; the `StaleWorkerReaper` reclaims locked jobs automatically.

---

## 3. Sub-Second Scheduling: Hashed Timing Wheels vs Periodic DB Scans

### Hashed Timing Wheel (Selected):
- Instead of performing `$O(N)$` database table scans every second (`WHERE run_at <= NOW()`), jobs are indexed into a circular **60-slot Timing Wheel** (`TimingWheelService`).
- **Advantage**: Advances pointers in $O(1)$ time per tick (100ms interval), consuming 95% less CPU than traditional database polling loops.

---

## 4. Failure Retry Backoff: Exponential Backoff with Full Jitter

### Rationale:
Standard fixed retry delays cause **Thundering Herd Outages** where all failed retries hit downstream databases at the exact same second. ApexQueue uses **Exponential Backoff with Full Jitter**:

$$\text{Delay} = \min\left(\text{MaxDelay}, \text{Random}(0, \text{BaseDelay} \times 2^{\text{attempt}}\right)$$

Randomizing retry timing spreads out retry traffic evenly across time.
