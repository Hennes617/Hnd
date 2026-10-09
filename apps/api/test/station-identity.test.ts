import { describe, expect, it, vi } from "vitest";
import type { Station } from "@hnd/shared";
import { createDataService, mergePegelStations, URLS } from "../src/service.js";
import { WaterStore } from "../src/storage.js";
import { NLWKN_URL } from "../src/nlwkn.js";

const station: Station = { id: "BB_12345", name: "Testpegel", water: "Elbe", latitude: 52, longitude: 12, sourceStationNumber: "12345", agency: "LHP", sourceUrl: "https://www.hochwasserzentralen.de/", region: "germany", measurement: null, discharge: null, freshness: "unavailable", warningLevel: 0, historyAvailable: false };
const federal: Station = { ...station, id: "federal-uuid", agency: "WSV", name: "TESTPEGEL", historyAvailable: true, measurementSourceId: "federal-uuid", warningLevel: undefined, freshness: "current", measurement: { timestamp: "2026-10-09T12:00:00Z", value: 123, unit: "cm" } };
describe("verified station identity and history routing", () => {
  it("joins a shared official station number without hiding the original warning classification", () => {
    const result = mergePegelStations([station], [federal]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "BB_12345", measurementSourceId: "federal-uuid", historyAvailable: true, warningLevel: 0, measurement: federal.measurement });
  });
  it("never joins nearby gauges with different numbers, distant identities, or an ambiguous number", () => {
    expect(mergePegelStations([station], [{ ...federal, sourceStationNumber: "54321" }])).toHaveLength(2);
    expect(mergePegelStations([station], [{ ...federal, latitude: 50 }])).toHaveLength(2);
    expect(mergePegelStations([station], [federal, { ...federal, id: "second-uuid" }])).toHaveLength(3);
  });
  it("routes the LHP identifier to the matching WSV history and keeps direct UUIDs addressable", async () => {
    const now = new Date().toISOString();
    const calls: string[] = [];
    const service = createDataService(async url => {
      calls.push(url);
      if (url === URLS.lhp) return { type: "FeatureCollection", status: "success", updated: now, features: [{ id: "BB_12345", geometry: { type: "Point", coordinates: [12, 52] }, properties: { name: "Testpegel", water: "Elbe", timestamp: now, lhpClass: 0, stateId: "DE-BB" } }] };
      if (url.includes("stations.json?")) return [{ uuid: "federal-uuid", number: "12345", longname: "TESTPEGEL", latitude: 52, longitude: 12, water: { longname: "ELBE" }, timeseries: [{ shortname: "W", unit: "cm", currentMeasurement: { timestamp: now, value: 123 } }] }];
      if (url.includes("/federal-uuid/W/measurements.json")) return [{ timestamp: now, value: 123 }, { timestamp: new Date(Date.now() - 60_000).toISOString(), value: 122 }];
      throw new Error("Unrelated fixture provider offline");
    }, { cacheTtlMs: 300_000 });
    const history = await service.history("BB_12345");
    expect(history?.measurements.map(m => m.value)).toEqual([122, 123]);
    expect(history?.provider.id).toBe("pegelonline");
    expect(calls.some(url => url.includes("/BB_12345/W/"))).toBe(false);
    expect((await service.station("federal-uuid"))?.id).toBe("federal-uuid");
  });
  it("retains a saved federal location after provider caches expire and returns to live values on recovery", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-10-09T10:00:00Z");
    const store = new WaterStore(":memory:");
    let value = 123;
    const fetcher = async (url: string) => {
      if (url.includes("stations.json?")) return [{ uuid: "federal-uuid", number: "12345", longname: "TESTPEGEL", latitude: 52, longitude: 12, water: { longname: "ELBE" }, timeseries: [{ shortname: "W", unit: "cm", currentMeasurement: { timestamp: new Date().toISOString(), value } }] }];
      throw new Error("Unrelated provider offline");
    };
    try {
      const initial = await createDataService(fetcher, { cacheTtlMs: 300_000 }, store).overview("germany");
      const saved = initial.stations.find(s => s.id === "federal-uuid")!;
      // A previously persisted warning must never survive a complete feed outage.
      store.saveStations([{ ...saved, warningLevel: 0, warningLabel: "Kein Hochwasser", warningTimestamp: new Date().toISOString() }]);
      vi.setSystemTime("2026-10-09T12:30:00Z");
      const offline = createDataService(async () => { throw new Error("Offline"); }, { cacheTtlMs: 300_000 }, store);
      const fallback = (await offline.overview("germany")).stations.find(s => s.id === "federal-uuid")!;
      expect(fallback.measurement?.value).toBe(123);
      expect(fallback.freshness).toBe("stale");
      expect(fallback.warningLevel).toBeUndefined();
      expect(fallback.warningTimestamp).toBeUndefined();
      expect((await offline.history("federal-uuid"))?.measurements).toHaveLength(1);
      value = 139;
      const recovered = (await createDataService(fetcher, { cacheTtlMs: 300_000 }, store).overview("germany")).stations.find(s => s.id === "federal-uuid")!;
      expect(recovered.measurement?.value).toBe(139);
      expect(recovered.freshness).toBe("current");
      expect(recovered.warningLevel).toBeUndefined();
    } finally {
      store.close();
      vi.useRealTimers();
    }
  });
  it("preserves partial-series staleness in LHW overview and detail, including an expired history cache", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-10-09T10:00:00Z");
    const observedAt = new Date().toISOString();
    const store = new WaterStore(":memory:");
    let offline = false;
    const service = createDataService(async url => {
      if (url === URLS.lhp) return { type: "FeatureCollection", status: "success", updated: new Date().toISOString(), features: [{ id: "ST_579020", geometry: { type: "Point", coordinates: [11.047, 51.749] }, properties: { name: "Thale fixture", water: "Bode", timestamp: new Date().toISOString(), lhpClass: 0 } }] };
      if (url === `${URLS.lhw}/stations.json`) return [{ station_no: "579020", site_no: "LHW", station_name: "Thale fixture", WTO_OBJECT: "Bode", station_latitude: 51.749, station_longitude: 11.047 }];
      if (url.endsWith("/W/week.json") && !offline) return [{ ts_unitsymbol: "cm", data: [[observedAt, 110]] }];
      throw new Error("Fixture provider offline");
    }, { cacheTtlMs: 300_000 }, store);
    try {
      expect((await service.overview("harz")).stations.find(s => s.id === "ST_579020")?.freshness).toBe("current");
      offline = true;
      vi.setSystemTime("2026-10-09T10:06:00Z");
      expect((await service.overview("harz")).stations.find(s => s.id === "ST_579020")?.freshness).toBe("stale");
      vi.setSystemTime("2026-10-09T11:10:00Z");
      const detail = await service.station("ST_579020");
      expect(detail?.measurement?.value).toBe(110);
      expect(detail?.freshness).toBe("stale");
    } finally { store.close(); vi.useRealTimers(); }
  });
  it("does not resurrect an old WSV marker when newer NLWKN data wins, including during a WSV outage", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-10-09T12:00:00Z");
    const store = new WaterStore(":memory:");
    store.saveStations([{ ...federal, latitude: 52.13, longitude: 9.76, water: "Leine" }]);
    let offline = false;
    const fetcher = async (url: string) => {
      const now = new Date().toISOString();
      if (url === URLS.lhp) return { type: "FeatureCollection", status: "success", updated: now, features: [{ id: "NI_12345", geometry: { type: "Point", coordinates: [9.76, 52.13] }, properties: { name: "Testpegel", water: "Leine", timestamp: now, lhpClass: 0 } }] };
      if (url === NLWKN_URL) return { getStammdatenResult: [{ STA_Nummer: "12345", STA_ID: 486, Name: "Testpegel", GewaesserName: "Leine", Latitude: 9.76, Longitude: 52.13, Parameter: [{ PAT_ID: 1, Datenspuren: [{ IstWasserstand: true, IstVorhersage: false, ParameterEinheit: "cm", AktuellerPegelstand: { DatumUTC: now, Wert: 125 } }] }] }] };
      if (url.includes("stations.json?") && !offline) return [{ uuid: "federal-uuid", number: "12345", longname: "TESTPEGEL", latitude: 52.13, longitude: 9.76, water: { longname: "LEINE" }, timeseries: [{ shortname: "W", unit: "cm", currentMeasurement: { timestamp: new Date(Date.now() - 600_000).toISOString(), value: 123 } }] }];
      throw new Error("Fixture provider offline");
    };
    try {
      const snapshot = await createDataService(fetcher, { cacheTtlMs: 300_000 }, store).overview("germany");
      expect(snapshot.stations.filter(s => s.sourceStationNumber === "12345")).toHaveLength(1);
      expect(snapshot.stations.find(s => s.id === "NI_12345")?.measurementSourceId).toBe("nlwkn-486");
      offline = true;
      vi.setSystemTime("2026-10-09T14:00:00Z");
      const duringOutage = await createDataService(fetcher, { cacheTtlMs: 300_000 }, store).overview("germany");
      expect(duringOutage.stations.filter(s => s.sourceStationNumber === "12345")).toHaveLength(1);
      expect(duringOutage.stations.find(s => s.id === "NI_12345")?.freshness).toBe("current");
    } finally { store.close(); vi.useRealTimers(); }
  });
  it("keeps genuine external LHP gauges without importing or restoring mirrored LHW locations under false ST identifiers", async () => {
    const store = new WaterStore(":memory:");
    store.saveStations([{ ...federal, id: "ST_22222", latitude: 51.05, longitude: 13.74, sourceStationNumber: "22222", measurementSourceId: "ST_22222" }]);
    const service = createDataService(async url => {
      if (url === URLS.lhp) return { type: "FeatureCollection", status: "success", features: [
        { id: "SN_22222", geometry: { type: "Point", coordinates: [13.74, 51.05] }, properties: { name: "Sachsen fixture", water: "Elbe", timestamp: new Date().toISOString(), lhpClass: 0 } },
        { id: "TH_33333", geometry: { type: "Point", coordinates: [10.79, 51.50] }, properties: { name: "Thüringen fixture", water: "Zorge", timestamp: new Date().toISOString(), lhpClass: 0 } },
      ] };
      if (url === `${URLS.lhw}/stations.json`) return [
        { station_no: "22222", site_no: "SN", station_name: "Sachsen fixture", station_latitude: 51.05, station_longitude: 13.74 },
        { station_no: "33333", site_no: "TH", station_name: "Thüringen fixture", station_latitude: 51.50, station_longitude: 10.79 },
      ];
      throw new Error("Unrelated fixture provider offline");
    }, { cacheTtlMs: 300_000 }, store);
    try {
      const snapshot = await service.overview("germany");
      expect(snapshot.stations.map(s => s.id).sort()).toEqual(["SN_22222", "TH_33333"]);
      expect(snapshot.stations.every(s => s.warningLevel === 0)).toBe(true);
    } finally { store.close(); }
  });
});
