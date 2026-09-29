function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Caps how many requests run at once and how close together they start.
 * Cache hits should not go through this gate.
 */
export class RequestGate {
  private active = 0;
  private queue: Array<() => void> = [];
  private nextAllowed = 0;

  constructor(
    private readonly concurrency: number,
    private readonly minIntervalMs: number,
  ) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    return new Promise((resolve) => {
      const start = () => {
        this.active += 1;
        const now = Date.now();
        const delay = Math.max(0, this.nextAllowed - now);
        this.nextAllowed = Math.max(this.nextAllowed, now) + this.minIntervalMs;
        if (delay === 0) resolve();
        else setTimeout(resolve, delay);
      };
      if (this.active < Math.max(1, this.concurrency)) start();
      else this.queue.push(start);
    });
  }

  private release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) next();
  }
}

export { sleep };
