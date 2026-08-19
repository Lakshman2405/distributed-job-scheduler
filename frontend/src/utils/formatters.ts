/**
 * Converts raw JSON payload objects into clean, human-readable text descriptions
 */
export function formatPayloadToText(payload: any): string {
  if (!payload || typeof payload !== 'object') {
    return String(payload || 'Standard Execution Task');
  }

  // 1. Transaction Payloads
  if (payload.transactionId) {
    return `Transaction ${payload.transactionId} — ${payload.currency || '$'}${payload.amount || 0}`;
  }

  // 2. Email Payloads
  if (payload.recipient) {
    return `Email to ${payload.recipient} (${payload.subject || 'Notification'})`;
  }

  // 3. ETL / Batch Payloads
  if (payload.source) {
    return `Ingest Data from ${payload.source} (${payload.batchSize || 0} items)`;
  }

  // 4. ML / AI Payloads
  if (payload.modelArchitecture) {
    return `Train ${payload.modelArchitecture} Model (${payload.epochs || 1} Epochs)`;
  }

  // 5. Chaos / Poison Pill Payloads
  if (payload.shouldFail || payload.chaosTag) {
    return `Synthetic Chaos Fault: ${payload.errorMessage || 'Poison Pill Payload'}`;
  }

  // 6. Generic Key-Value formatting without raw JSON syntax
  const keys = Object.keys(payload);
  if (keys.length === 0) return 'Standard Background Task';

  const parts = keys.map((key) => {
    const val = payload[key];
    const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
    if (typeof val === 'object') return `${formattedKey}: [Object]`;
    return `${formattedKey}: ${val}`;
  });

  return parts.join(' | ');
}
