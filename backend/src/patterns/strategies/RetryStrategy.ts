/**
 * STRATEGY PATTERN: Pluggable Retry Backoff Strategy Interface (SOLID - Open/Closed Principle)
 */
export interface IRetryStrategy {
  calculateDelayMs(attemptNumber: number, baseDelayMs: number, maxDelayMs: number): number;
}

export class FixedRetryStrategy implements IRetryStrategy {
  calculateDelayMs(_attemptNumber: number, baseDelayMs: number): number {
    return baseDelayMs;
  }
}

export class LinearRetryStrategy implements IRetryStrategy {
  calculateDelayMs(attemptNumber: number, baseDelayMs: number, maxDelayMs: number): number {
    return Math.min(maxDelayMs, baseDelayMs * attemptNumber);
  }
}

export class ExponentialJitterRetryStrategy implements IRetryStrategy {
  calculateDelayMs(attemptNumber: number, baseDelayMs: number, maxDelayMs: number): number {
    const exp = Math.pow(2, attemptNumber - 1);
    const rawDelay = baseDelayMs * exp;
    const jitter = Math.random() * baseDelayMs;
    return Math.min(maxDelayMs, Math.round(rawDelay + jitter));
  }
}

export class RetryStrategyFactory {
  static getStrategy(strategyType: string): IRetryStrategy {
    switch (strategyType) {
      case 'FIXED':
        return new FixedRetryStrategy();
      case 'LINEAR':
        return new LinearRetryStrategy();
      case 'EXPONENTIAL_JITTER':
      default:
        return new ExponentialJitterRetryStrategy();
    }
  }
}
