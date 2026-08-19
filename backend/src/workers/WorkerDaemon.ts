import { WorkerService } from '../services/WorkerService';
import { JobService } from '../services/JobService';
import { DagOrchestrator } from '../services/DagOrchestrator';
import { TelemetryServer } from '../websocket/telemetryServer';
import { QueueCircuitBreakerRegistry } from '../patterns/circuitBreaker/CircuitBreaker';

export class WorkerDaemon {
  private workerId: string | null = null;
  private isRunning: boolean = false;
  private activeJobsCount: number = 0;
  private maxConcurrency: number = 5;
  private pollIntervalMs: number = 200;
  private heartbeatIntervalMs: number = 3000;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(maxConcurrency: number = 5) {
    this.maxConcurrency = maxConcurrency;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Register worker node
    const worker = WorkerService.registerWorker(undefined, this.maxConcurrency);
    this.workerId = worker.id;

    // Start Heartbeat Loop
    this.heartbeatTimer = setInterval(() => {
      if (this.workerId) {
        WorkerService.sendHeartbeat(this.workerId, this.activeJobsCount);
      }
    }, this.heartbeatIntervalMs);

    // Start Polling Loop
    this.scheduleNextPoll();
  }

  stop() {
    this.isRunning = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pollTimer) clearTimeout(this.pollTimer);

    if (this.workerId) {
      WorkerService.setWorkerStatus(this.workerId, 'DRAINING');
    }
  }

  private scheduleNextPoll() {
    if (!this.isRunning) return;

    this.pollTimer = setTimeout(async () => {
      await this.pollAndExecute();
      this.scheduleNextPoll();
    }, this.pollIntervalMs);
  }

  private async pollAndExecute() {
    if (!this.workerId || this.activeJobsCount >= this.maxConcurrency) return;

    const availableCapacity = this.maxConcurrency - this.activeJobsCount;
    const claimedJobs = JobService.claimJobsAtomic(this.workerId, availableCapacity);

    for (const job of claimedJobs) {
      this.activeJobsCount++;
      // Execute asynchronously
      this.executeJob(job).finally(() => {
        this.activeJobsCount--;
      });
    }
  }

  private async executeJob(job: any) {
    if (!this.workerId) return;
    const breaker = QueueCircuitBreakerRegistry.getBreaker(job.queue_id);

    if (!breaker.canExecute()) {
      TelemetryServer.broadcastLog(job.id, `[Circuit Breaker OPEN] Queue '${job.queue_id}' circuit is TRIPPED. Pausing execution to protect downstream services.`, 'WARN');
      return;
    }

    const startTime = Date.now();
    const executionId = JobService.markJobRunning(job.id, this.workerId);

    // Broadcast live telemetry
    TelemetryServer.broadcastJobStateChange(job.id, 'RUNNING', this.workerId);
    TelemetryServer.broadcastLog(job.id, `[Worker ${this.workerId}] Starting execution of job '${job.id}' (Attempt ${job.attempt_count})`);

    try {
      // Simulate/Execute job based on payload structure
      const result = await this.runJobPayload(job, executionId);

      const executionTimeMs = Date.now() - startTime;
      JobService.completeJob(job.id, executionId, result, executionTimeMs);
      breaker.recordSuccess();

      // Trigger DAG orchestrator step resolution
      DagOrchestrator.onJobCompleted(job.id);

      TelemetryServer.broadcastJobStateChange(job.id, 'COMPLETED', this.workerId);
      TelemetryServer.broadcastLog(job.id, `[Worker ${this.workerId}] Job '${job.id}' completed successfully in ${executionTimeMs}ms.`);
    } catch (err: any) {
      const executionTimeMs = Date.now() - startTime;
      JobService.failJob(job.id, executionId, err, executionTimeMs);
      breaker.recordFailure();

      TelemetryServer.broadcastJobStateChange(job.id, 'FAILED', this.workerId);
      TelemetryServer.broadcastLog(job.id, `[Worker ${this.workerId}] Execution failed: ${err.message}`, 'ERROR');
    }
  }

  private async runJobPayload(job: any, executionId: string): Promise<any> {
    const payload = job.payload || {};

    // 1. Simulate Poison Pill / Failure if explicitly requested in payload
    if (payload.shouldFail || payload.simulateError) {
      const errorMsg = payload.errorMessage || 'Simulated job failure (poison pill payload)';
      throw new Error(errorMsg);
    }

    // 2. Simulated Delay / Workload
    const workDuration = payload.durationMs || payload.delayMs || 300;
    await new Promise((resolve) => setTimeout(resolve, Math.min(workDuration, 5000)));

    // 3. Output payload data
    return {
      status: 'SUCCESS',
      processedAt: new Date().toISOString(),
      itemsProcessed: payload.batchSize || 10,
      output: `Executed job task '${job.type}' with payload keys [${Object.keys(payload).join(', ')}]`
    };
  }
}
