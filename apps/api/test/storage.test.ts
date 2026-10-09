import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { reservoirs, type Station } from "@hnd/shared";
import { WaterStore } from "../src/storage.js";

const directories: string[] = [];
const stores: WaterStore[] = [];
afterEach(() => {
  stores.splice(0).forEach((store) => store.close());
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});
function path() {
  const directory = mkdtempSync(join(tmpdir(), "hnd-storage-"));
  directories.push(directory);
  return join(directory, "nested", "hnd.sqlite");
}
function open(file: string, now: () => number, retention = 90) {
  const store = new WaterStore(file, retention, now);
  stores.push(store);
  return store;
}
describe("durable local observations", () => {
  it("migrates a new database and keeps real measurements, revisions and metadata after restart", () => {
    const now = Date.parse("2026-10-09T12:00:00Z");
    const file = path();
    const store = open(file, () => now);
    const station: Station = {
      id: "ST_1", name: "Fixture", agency: "Test", water: "Bode", region: "harz",
      latitude: 51.8, longitude: 10.9, sourceUrl: "https://example.org/station",
      freshness: "current", discharge: null,
      measurement: { value: 25, unit: "cm", timestamp: new Date(now).toISOString() },
    };
    store.saveStations([station]);
    store.saveHistory(station.id, [
      { value: 24, unit: "cm", timestamp: new Date(now - 900_000).toISOString() },
      { value: 26, unit: "cm", timestamp: new Date(now).toISOString() },
      { value: NaN, unit: "cm", timestamp: new Date(now - 1000).toISOString() },
      { value: 99, unit: "cm", timestamp: new Date(now + 86_400_000).toISOString() },
    ]);
    store.close();
    const restarted = open(file, () => now);
    expect(restarted.station(station.id)?.name).toBe("Fixture");
    expect(restarted.history(station.id).map((m) => m.value)).toEqual([24, 26]);
    expect(restarted.history("missing")).toEqual([]);
    expect(restarted.status()).toMatchObject({ schemaVersion: 1, observations: 2 });
  });

  it("restores cache timestamps without relabeling an old response as fresh", async () => {
    let now = Date.parse("2026-10-09T12:00:00Z");
    const file = path();
    const initial = open(file, () => now);
    const first = await initial.cache<number[]>("provider", 1000, 5000).get(async () => [1]);
    initial.close();
    now += 500;
    const warm = open(file, () => now);
    const failure = vi.fn(async (): Promise<number[]> => { throw new Error("offline"); });
    expect(await warm.cache<number[]>("provider", 1000, 5000).get(failure))
      .toMatchObject({ data: [1], state: "cached", stale: false, fetchedAt: first.fetchedAt });
    expect(failure).not.toHaveBeenCalled();
    warm.close();
    now += 1000;
    const stale = open(file, () => now);
    expect(await stale.cache<number[]>("provider", 1000, 5000).get(failure))
      .toMatchObject({ data: [1], state: "cached", stale: true, fetchedAt: first.fetchedAt });
    stale.close();
    now += 5000;
    const expired = open(file, () => now);
    expect(await expired.cache<number[]>("provider", 1000, 5000).get(failure))
      .toMatchObject({ data: null, state: "unavailable" });
  });

  it("enforces retention on initialization without making up missing days", () => {
    let now = Date.parse("2026-10-09T12:00:00Z");
    const file = path();
    const store = open(file, () => now, 7);
    store.saveHistory("a", [{ value: 12, unit: "cm", timestamp: new Date(now).toISOString() }]);
    store.close();
    now += 8 * 86_400_000;
    const restarted = open(file, () => now, 7);
    expect(restarted.status().observations).toBe(0);
    expect(restarted.history("a")).toEqual([]);
  });

  it("stores reservoir observations with separate parameter timestamps, excluding computed percentages", () => {
    const now = Date.parse("2026-10-09T12:00:00Z");
    const store = open(path(), () => now);
    const value = { timestamp: new Date(now).toISOString(), unit: "Mio. m³", value: 25 };
    const reservoir = { ...reservoirs[0], telemetry: {
      storage: value,
      inflow: { timestamp: new Date(now - 900_000).toISOString(), unit: "m³/s", value: 0 },
      fillPercent: { ...value, value: 50, unit: "%" },
      freshness: "current" as const, sourceName: "Fixture", sourceUrl: "https://example.org/",
    } };
    store.saveReservoirs([reservoir]);
    store.saveReservoirs([reservoir]);
    expect(store.status().observations).toBe(2);
    expect(store.history(reservoir.id)).toEqual([]);
  });
});
