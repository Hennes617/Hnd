import { describe, expect, it, vi } from "vitest";
import { pointInRegion } from "@hnd/shared";
import { createDataService, URLS } from "../src/service.js";
import type { FetchJson } from "../src/upstream.js";
describe("live data orchestration", () => {
  it("returns historical metadata only and unknown warning state during complete upstream outage", async () => {
    const fetchJson = vi.fn(async () => {
      throw new Error("HTTP 503");
    });
    const service = createDataService(fetchJson, { cacheTtlMs: 300_000 });
    const snapshot = await service.overview("germany");
    expect(snapshot.stations.length).toBeGreaterThan(1000);
    expect(
      snapshot.stations.every(
        (s) =>
          s.measurement === null &&
          s.discharge === null &&
          s.warningLevel === undefined,
      ),
    ).toBe(true);
    expect(snapshot.warnings).toEqual([]);
    expect(snapshot.providers.find((p) => p.id === "nina-lhp")?.state).toBe(
      "unavailable",
    );
    expect(
      snapshot.providers.find((p) => p.id === "lhp-reference")?.state,
    ).toBe("reference");
    expect(snapshot.coverage.complete).toBe(false);
    await service.overview("harz");
    expect(fetchJson).toHaveBeenCalledTimes(4); // Cache/backoff prevents hammering failed sources.
  });
  it("filters historical fallback coordinates by actual administrative boundaries", async () => {
    const service = createDataService(
      async () => {
        throw new Error("Offline fixture");
      },
      { cacheTtlMs: 300_000 },
    );
    const harz = await service.overview("harz");
    const saxonyAnhalt = await service.overview("sachsen-anhalt");
    expect(harz.stations.length).toBeGreaterThan(5);
    expect(harz.stations.length).toBeLessThan(saxonyAnhalt.stations.length);
    expect(
      harz.stations.every((station) =>
        pointInRegion(station.latitude, station.longitude, "harz"),
      ),
    ).toBe(true);
    expect(
      harz.stations.some((station) => /Goslar|Nordhausen/.test(station.name)),
    ).toBe(false);
    expect(
      saxonyAnhalt.stations.every((station) =>
        pointInRegion(station.latitude, station.longitude, "sachsen-anhalt"),
      ),
    ).toBe(true);
    expect(
      saxonyAnhalt.stations.some((station) => /Halle/.test(station.name)),
    ).toBe(true);
    expect(
      harz.reservoirs.every((reservoir) =>
        pointInRegion(reservoir.lat, reservoir.lon, "harz"),
      ),
    ).toBe(true);
    const bode = harz.rivers.find((river) => river.id === "bode");
    expect(bode?.mouth.name).toBeTruthy();
    expect(
      bode?.route.some((point) => !pointInRegion(point.lat, point.lon, "harz")),
    ).toBe(true);
  });
  it("distinguishes malformed warning response from a healthy empty feed", async () => {
    const fetcher =
      (data: unknown): FetchJson =>
      async (url) => {
        if (url === `${URLS.nina}/lhp/mapData.json`) return data;
        throw new Error("Unavailable");
      };
    const malformed = await createDataService(fetcher([{}]), {
      cacheTtlMs: 300_000,
    }).overview("harz");
    const empty = await createDataService(fetcher([]), {
      cacheTtlMs: 300_000,
    }).overview("harz");
    expect(malformed.providers.find((p) => p.id === "nina-lhp")?.state).toBe(
      "unavailable",
    );
    expect(empty.providers.find((p) => p.id === "nina-lhp")?.state).toBe(
      "live",
    );
  });
  it("keeps incomplete warning details marked unavailable while retaining successful alerts", async () => {
    const timestamp = new Date().toISOString();
    const fetcher: FetchJson = async (url) => {
      if (url === `${URLS.nina}/lhp/mapData.json`)
        return [
          { id: "lhp.ok", startDate: timestamp },
          { id: "lhp.fail", startDate: timestamp },
        ];
      if (url.endsWith("/warnings/lhp.ok.json"))
        return {
          status: "Actual",
          sent: timestamp,
          info: [
            {
              headline: "Hochwasser im Harz",
              area: [{ areaDesc: "Landkreis Harz" }],
              severity: "Severe",
            },
          ],
        };
      throw new Error("Unavailable");
    };
    const snapshot = await createDataService(fetcher, {
      cacheTtlMs: 300_000,
    }).overview("harz");
    expect(snapshot.warnings).toHaveLength(1);
    expect(snapshot.providers.find((p) => p.id === "nina-lhp")).toMatchObject({
      state: "unavailable",
    });
  });
  it("bounds the total detail-fetch budget, rather than multiplying per-request timeouts", async () => {
    vi.useFakeTimers();
    try {
      const fetcher: FetchJson = async (url) => {
        if (url === `${URLS.nina}/lhp/mapData.json`)
          return Array.from({ length: 120 }, (_, i) => ({
            id: `lhp.fixture${i}`,
          }));
        if (url.includes("/warnings/")) return new Promise(() => undefined);
        throw new Error("Unavailable");
      };
      const pending = createDataService(fetcher, {
        cacheTtlMs: 300_000,
      }).overview("harz");
      await vi.advanceTimersByTimeAsync(12_001);
      const snapshot = await pending;
      expect(snapshot.providers.find((p) => p.id === "nina-lhp")?.state).toBe(
        "unavailable",
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
