/**
 * CIRCUIT BREAKER PATTERN: Prevents cascading system failures under high error rates
 */
export enum CircuitState {
  CLOSED = 'CLOSED',       // Normal operation
  OPEN = 'OPEN',           // Tripped: fails fast to protect downstream dependencies
  HALF_OPEN = 'HALF_OPEN'  // Trial period testing if downstream service recovered
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureThresholdPct: number = 50; // 50% failure rate trips breaker
  private resetTimeoutMs: number = 10000;    // 10s cooldown
  private consecutiveFailures: number = 0;
  private totalRequests: number = 0;
  private lastStateChangeTimestamp: number = Date.now();

  constructor(failureThresholdPct: number = 50, resetTimeoutMs: number = 10000) {
    this.failureThresholdPct = failureThresholdPct;
    this.resetTimeoutMs = resetTimeoutMs;
  }

  canExecute(): boolean {
    const now = Date.now();

    if (this.state === CircuitState.OPEN) {
      if (now - this.lastStateChangeTimestamp >= this.resetTimeoutMs) {
        this.transitionTo(CircuitState.HALF_OPEN);
        return true;
      }
      return false;
    }

    return true;
  }

  recordSuccess() {
    this.consecutiveFailures = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.CLOSED);
    }
  }

  recordFailure() {
    this.consecutiveFailures++;
    this.totalRequests++;

    if (this.state === CircuitState.CLOSED && this.consecutiveFailures >= 3) {
      this.transitionTo(CircuitState.OPEN);
    } else if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  private transitionTo(newState: CircuitState) {
    this.state = newState;
    this.lastStateChangeTimestamp = Date.now();
    if (newState === CircuitState.CLOSED) {
      this.consecutiveFailures = 0;
    }
  }
}

export class QueueCircuitBreakerRegistry {
  private static breakers: Map<string, CircuitBreaker> = new Map();

  static getBreaker(queueId: string): CircuitBreaker {
    if (!this.breakers.has(queueId)) {
      this.breakers.set(queueId, new CircuitBreaker());
    }
    return this.breakers.get(queueId)!;
  }
}
