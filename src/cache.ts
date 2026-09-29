interface Entry {
  value: string;
  expires: number;
}

/** Store used by {@link AvidWikiClient} to skip repeat GET-equivalent POSTs. */
export interface AvidCache {
  get(key: string): string | undefined | Promise<string | undefined>;
  set(key: string, value: string, ttlMs: number): void | Promise<void>;
}

/** In-memory response cache. Keys are the full API parameter set. */
export class MemoryCache implements AvidCache {
  private readonly store = new Map<string, Entry>();

  constructor(private readonly defaultTtlMs = 5 * 60 * 1000) {}

  get(key: string): string | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: string, ttlMs: number = this.defaultTtlMs): void {
    this.store.set(key, { value, expires: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
