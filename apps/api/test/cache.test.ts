import { describe, expect, it, vi } from "vitest";
import { AsyncCache } from "../src/cache.js";
describe("provider cache", () => {
  it("coalesces concurrent requests and preserves the successful fetch timestamp", async () => {
    let now = 1_000_000;
    const cache = new AsyncCache<number[]>(100, 1000, () => now);
    const loader = vi.fn(async () => [42]);
    const [a, b] = await Promise.all([cache.get(loader), cache.get(loader)]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(a.state).toBe("live");
    now += 50;
    expect(await cache.get(loader)).toMatchObject({
      state: "cached",
      stale: false,
      fetchedAt: a.fetchedAt,
    });
    expect(loader).toHaveBeenCalledTimes(1);
  });
  it("marks cached values stale on failure, backs off, then expires old data", async () => {
    let now = 1_000_000;
    const cache = new AsyncCache<number[]>(100, 1000, () => now, 300);
    const initial = await cache.get(async () => [1]);
    now += 950;
    const failing = vi.fn(async () => {
      throw new Error("unavailable");
    });
    expect(await cache.get(failing)).toMatchObject({
      state: "cached",
      stale: true,
      data: [1],
      fetchedAt: initial.fetchedAt,
    });
    now += 60;
    // Stale limit is enforced even while the failed provider is backing off.
    expect(await cache.get(failing)).toMatchObject({
      state: "unavailable",
      data: null,
      fetchedAt: null,
    });
    expect(failing).toHaveBeenCalledTimes(1);
    now += 300;
    expect(await cache.get(async () => [2])).toMatchObject({
      state: "live",
      stale: false,
      data: [2],
    });
  });
  it("does not turn first-load failure into a successful empty dataset", async () => {
    const cache = new AsyncCache<number[]>(100, 1000);
    expect(
      await cache.get(async () => {
        throw new Error("HTTP 503");
      }),
    ).toMatchObject({ state: "unavailable", data: null, stale: false });
  });
});
