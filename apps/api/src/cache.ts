export interface CacheResult<T> {
  data: T | null;
  fetchedAt: string | null;
  state: "live" | "cached" | "unavailable";
  stale: boolean;
  error?: string;
}
interface Entry<T> {
  result: CacheResult<T>;
  nextAttempt: number;
}
export interface CacheStorage<T> {
  read(): { data: T; fetchedAt: string } | null;
  write(data: T, fetchedAt: string): void;
}
/** Coalesces callers, bounds stale data, and backs off failing providers. */
export class AsyncCache<T> {
  private entry?: Entry<T>;
  private pending?: Promise<CacheResult<T>>;
  constructor(
    private readonly ttlMs: number,
    private readonly staleMs: number,
    private readonly now: () => number = Date.now,
    private readonly retryMs = 30_000,
    private readonly storage?: CacheStorage<T>,
  ) {
    const saved = storage?.read();
    const age = saved ? this.now() - Date.parse(saved.fetchedAt) : Infinity;
    if (saved && Number.isFinite(age) && age >= 0 && age <= staleMs) {
      this.entry = {
        result: { ...saved, state: "cached", stale: age >= ttlMs },
        nextAttempt: Date.parse(saved.fetchedAt) + ttlMs,
      };
    }
  }
  async get(loader: () => Promise<T>): Promise<CacheResult<T>> {
    if (this.entry && this.now() < this.entry.nextAttempt) {
      if (
        this.entry.result.stale &&
        this.entry.result.fetchedAt &&
        this.now() - Date.parse(this.entry.result.fetchedAt) > this.staleMs
      ) {
        this.entry.result = {
          ...this.entry.result,
          data: null,
          fetchedAt: null,
          state: "unavailable",
          stale: false,
        };
      }
      return {
        ...this.entry.result,
        state: this.entry.result.data === null ? "unavailable" : "cached",
      };
    }
    if (this.pending) return this.pending;
    this.pending = this.load(loader);
    try {
      return await this.pending;
    } finally {
      this.pending = undefined;
    }
  }
  private async load(loader: () => Promise<T>): Promise<CacheResult<T>> {
    try {
      const data = await loader();
      const result: CacheResult<T> = {
        data,
        fetchedAt: new Date(this.now()).toISOString(),
        state: "live",
        stale: false,
      };
      this.storage?.write(data, result.fetchedAt!);
      this.entry = { result, nextAttempt: this.now() + this.ttlMs };
      return result;
    } catch (error) {
      const previous = this.entry?.result;
      const usable =
        previous?.data !== null &&
        previous?.fetchedAt &&
        this.now() - Date.parse(previous.fetchedAt) <= this.staleMs;
      const result: CacheResult<T> = {
        data: usable ? previous!.data : null,
        fetchedAt: usable ? previous!.fetchedAt : null,
        state: usable ? "cached" : "unavailable",
        stale: Boolean(usable),
        error: error instanceof Error ? error.message : "Upstream unavailable",
      };
      this.entry = { result, nextAttempt: this.now() + this.retryMs };
      return result;
    }
  }
}
