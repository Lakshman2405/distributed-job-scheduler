import { db } from '../database/db';

export class AiDiagnosticsService {
  /**
   * Analyze DLQ entry and generate AI root cause report and patch recommendation
   */
  static analyzeDlqEntry(dlqId: string) {
    const dlq = db.prepare(`
      SELECT dlq.*, j.payload, j.type as job_type, q.name as queue_name
      FROM dead_letter_queue dlq
      JOIN jobs j ON dlq.job_id = j.id
      JOIN queues q ON dlq.queue_id = q.id
      WHERE dlq.id = ?
    `).get(dlqId) as any;

    if (!dlq) throw new Error(`DLQ entry '${dlqId}' not found`);

    const executions = db.prepare(`
      SELECT * FROM job_executions WHERE job_id = ? ORDER BY attempt_number ASC
    `).all(dlq.job_id) as any[];

    const originalPayload = typeof dlq.original_payload === 'string' ? JSON.parse(dlq.original_payload) : dlq.original_payload;
    const failedReason = dlq.failed_reason || 'Unknown execution failure';

    // Heuristic AI Diagnostic Engine
    let category = 'RUNTIME_EXCEPTION';
    let rootCause = `Job failed across all ${dlq.total_attempts} execution attempts due to unhandled runtime exception: "${failedReason}"`;
    let recommendedFix = 'Inspect worker execution logic and wrap payload processing in defensive try-catch block.';
    let patchedPayload = { ...originalPayload };

    if (failedReason.includes('CHAOS_POISON_PILL') || failedReason.includes('Fatal memory access')) {
      category = 'POISON_PILL_PAYLOAD';
      rootCause = 'Payload contains synthetic chaos flag "shouldFail: true" causing deterministic poison-pill crash on every retry.';
      recommendedFix = 'Remove "shouldFail: true" from payload parameters and adjust error handling threshold.';
      delete patchedPayload.shouldFail;
      delete patchedPayload.simulateError;
      patchedPayload.fixedByAi = true;
    } else if (failedReason.includes('TIMED_OUT') || failedReason.includes('timeout')) {
      category = 'EXECUTION_TIMEOUT';
      rootCause = `Job execution exceeded allocated timeout limit. Attempt runtime took longer than maximum threshold.`;
      recommendedFix = 'Increase queue timeout threshold or reduce job batch workload size.';
      patchedPayload.batchSize = Math.max(1, Math.floor((patchedPayload.batchSize || 10) / 2));
    } else if (failedReason.includes('ECONNREFUSED') || failedReason.includes('Network')) {
      category = 'INFRASTRUCTURE_OUTAGE';
      rootCause = 'Upstream dependency network socket connection refused during execution attempt.';
      recommendedFix = 'Verify database/upstream REST endpoint connectivity and adjust retry backoff policy to EXPONENTIAL_JITTER.';
    }

    const aiSummary = `[AI DIAGNOSTIC REPORT]\nCategory: ${category}\nRoot Cause: ${rootCause}\nRecommendation: ${recommendedFix}`;
    const aiRecommendedFix = JSON.stringify({
      category,
      rootCause,
      recommendedFix,
      patchedPayload
    });

    // Cache AI results in database
    db.prepare(`
      UPDATE dead_letter_queue
      SET ai_summary = ?, ai_recommended_fix = ?
      WHERE id = ?
    `).run(aiSummary, aiRecommendedFix, dlqId);

    return {
      dlqId,
      jobId: dlq.job_id,
      category,
      rootCause,
      recommendedFix,
      patchedPayload,
      executionHistory: executions
    };
  }

  /**
   * Replay DLQ job with optional patched payload
   */
  static replayDlqJob(dlqId: string, patchedPayload?: any) {
    const dlq = db.prepare(`SELECT * FROM dead_letter_queue WHERE id = ?`).get(dlqId) as any;
    if (!dlq) throw new Error(`DLQ entry '${dlqId}' not found`);

    const finalPayload = patchedPayload || JSON.parse(dlq.original_payload || '{}');

    // Reset job status to QUEUED
    db.prepare(`
      UPDATE jobs
      SET status = 'QUEUED',
          payload = ?,
          attempt_count = 0,
          worker_id = NULL,
          run_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(finalPayload), dlq.job_id);

    // Remove from DLQ
    db.prepare(`DELETE FROM dead_letter_queue WHERE id = ?`).run(dlqId);

    return {
      success: true,
      jobId: dlq.job_id,
      message: 'Job re-queued successfully for execution.'
    };
  }
}
