import { reservoirs, reservoirInRegion, type Measurement, type ProviderState, type Region, type Reservoir, type ReservoirTelemetry } from "@hnd/shared";
import { AsyncCache, type CacheResult } from "./cache.js";
import { iso, number, plainText, record, string } from "./parsers.js";
import type { WaterStore } from "./storage.js";
import type { FetchJson } from "./upstream.js";

export const RESERVOIR_URLS = {
  tsb: "https://www.talsperrenbetrieb.de/tsb/data/internet/layers/1300/index.json",
  hww: "https://www.harzwasserwerke.de/wp-content/themes/Avada-Child-Theme/barrageData/barrageDataCall.php",
  tsbPublic: "https://www.talsperrenbetrieb.de/#Talsperren",
  hwwPublic: "https://www.harzwasserwerke.de/infoservice/aktuelle-talsperrendaten/",
};

// Official TSB station numbers, verified against the operator's station catalogue.
const TSB_IDS: Record<string, string> = {
  "579430": "rappbode", "579005": "wendefurth", "579000": "koenigshuette",
  "579530": "hassel", "579420": "rappbode-vorsperre", "579320": "mandelholz",
  "578400": "wippra", "575404": "kelbra", "579756": "zillierbach",
  "5796021": "kiliansteich", "5796041": "teufelsteich",
};
export const HWW_FILES: Record<string, string> = {
  ecker: "ECK", grane: "GRA", innerste: "INN", oder: "ODE", oker: "OKE", soese: "SOE",
};

function reservoirFreshness(values: Array<Measurement | undefined>, maxAgeMs: number, now = Date.now()): ReservoirTelemetry["freshness"] {
  const measured = values.filter((v): v is Measurement => !!v);
  if (!measured.length) return "unavailable";
  return measured.some(v => now - Date.parse(v.timestamp) > maxAgeMs || Date.parse(v.timestamp) > now + 5 * 60_000) ? "stale" : "current";
}

/** Every parameter carries its own source timestamp; a fresh flow does not rejuvenate an old storage value. */
export function parseTsbReservoirs(payload: unknown, now = Date.now()): Record<string, ReservoirTelemetry> {
  if (!Array.isArray(payload)) throw new Error("Unexpected TSB reservoir format");
  const result: Record<string, ReservoirTelemetry> = {};
  for (const raw of payload) {
    const item = record(raw);
    const id = TSB_IDS[string(item.metadata_station_no)];
    if (!id) continue;
    const read = (prefix: string, label: string, unit: string, sourceUnit: string): Measurement | undefined => {
      if (item[`${prefix}_label`] !== label) return undefined;
      if (item[`${prefix}_ts_unitsymbol`] !== sourceUnit) return undefined;
      const timestamp = iso(item[`${prefix}_timestamp`]);
      const value = number(item[`${prefix}_ts_value`]);
      return timestamp && value !== null && value >= 0 ? { timestamp, value, unit } : undefined;
    };
    // TSB's public table specifies mNHN for L2; hm³ equals one million m³.
    const storage = read("L1", "Beckeninhalt", "Mio. m³", "hm³");
    const level = read("L2", "Beckenpegel", "m NHN", "m");
    const inflow = read("L4", "Zuflussmenge", "m³/s", "m³/s");
    const outflow = read("L6", "Abflussmenge", "m³/s", "m³/s");
    const note = plainText(item.metadata_web_wichtigerhinweis);
    result[id] = {
      storage, level, inflow, outflow,
      freshness: reservoirFreshness([storage, level, inflow, outflow], 36 * 60 * 60_000, now),
      sourceUrl: `https://www.talsperrenbetrieb.de/#${string(item.metadata_station_no)}`,
      sourceName: "Talsperrenbetrieb Sachsen-Anhalt",
      note: ["Ungeprüfte Betreiberwerte; üblicherweise täglich aktualisiert. Füllgrad nicht berechnet: saisonales Stauziel und Gesamtstauraum sind nicht gleichzusetzen.", !storage ? "Der Betreiber veröffentlicht hier derzeit keinen Beckeninhalt." : "", note].filter(Boolean).join(" "),
    };
  }
  if (!Object.keys(result).length) throw new Error("No matching TSB reservoirs");
  return result;
}

/** TALIS explicitly uses MEZ (UTC+01) all year, including the summer months. */
export function parseHwwReservoir(payload: unknown, capacity?: number, now = Date.now()): ReservoirTelemetry {
  const item = record(payload);
  const match = string(item.datum).match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}:\d{2}:\d{2})$/);
  const timestamp = match && iso(`${match[3]}-${match[2]}-${match[1]}T${match[4]}+01:00`);
  if (!timestamp) throw new Error("Invalid HWW timestamp");
  const read = (key: string, unit: string): Measurement | undefined => {
    const value = number(item[key]);
    return value !== null && value >= 0 ? { timestamp, value, unit } : undefined;
  };
  const storage = read("stauinhalt", "Mio. m³");
  const inflow = read("zufluss", "m³/s");
  const outflow = read("abgabe", "m³/s");
  if (!storage && !inflow && !outflow) throw new Error("No HWW measurements");
  return {
    storage, inflow, outflow,
    ...(storage && capacity && capacity > 0 ? { fillPercent: { timestamp, value: storage.value / capacity * 100, unit: "%" } } : {}),
    freshness: reservoirFreshness([storage, inflow, outflow], 2 * 60 * 60_000, now),
    sourceUrl: RESERVOIR_URLS.hwwPublic,
    sourceName: "Harzwasserwerke · TALIS",
    note: "Ungeprüfte Betreiberwerte. Zeitangabe aus TALIS (ganzjährig MEZ) in UTC umgerechnet. Füllgrad aus Stauinhalt und belegtem Gesamtstauraum berechnet; keine Hochwassereinstufung.",
  };
}

export function createReservoirService(fetchJson: FetchJson, ttlMs: number, store?: WaterStore) {
  const tsbCache = store?.cache<Record<string, ReservoirTelemetry>>("reservoirs:tsb:v1", ttlMs, 48 * 60 * 60_000) ?? new AsyncCache<Record<string, ReservoirTelemetry>>(ttlMs, 48 * 60 * 60_000);
  const hwwCaches = new Map(Object.keys(HWW_FILES).map(id => [id,
    store?.cache<ReservoirTelemetry>(`reservoirs:hww:${id}:v1`, ttlMs, 24 * 60 * 60_000) ?? new AsyncCache<ReservoirTelemetry>(ttlMs, 24 * 60 * 60_000)]));
  return async (region: Region) => {
    const [tsb, hww] = await Promise.all([
      tsbCache.get(async () => parseTsbReservoirs(await fetchJson(RESERVOIR_URLS.tsb))),
      Promise.all(Object.entries(HWW_FILES).map(async ([id, code]) => {
        const source = `https://www.harzwasserwerke.de/talis/${code}_tab_direct.txt`;
        const result = await hwwCaches.get(id)!.get(async () => parseHwwReservoir(await fetchJson(`${RESERVOIR_URLS.hww}?m=getReducedAndSplittedTextData&url=${encodeURIComponent(source)}`), reservoirs.find(r => r.id === id)?.capacityMillionM3));
        return [id, result] as const;
      })),
    ]);
    const hwwMap = new Map(hww);
    const list: Reservoir[] = reservoirs.map(reservoir => {
      const result = hwwMap.get(reservoir.id);
      const telemetry = result ? result.data : tsb.data?.[reservoir.id];
      const stale = result ? result.stale : tsb.stale;
      return { ...reservoir, telemetry: telemetry ? {
        ...telemetry,
        freshness: stale ? "stale" : reservoirFreshness([telemetry.storage, telemetry.level, telemetry.inflow, telemetry.outflow], result ? 2 * 60 * 60_000 : 36 * 60 * 60_000),
        ...(stale ? { note: `${telemetry.note || ""} Aktualisierung fehlgeschlagen; gespeicherter letzter Stand.`.trim() } : {}),
      } : {
        freshness: "unavailable",
        sourceName: reservoir.operator,
        sourceUrl: reservoir.id === "oderteich" || result ? RESERVOIR_URLS.hwwPublic : RESERVOIR_URLS.tsbPublic,
        note: reservoir.id === "oderteich" ? "Für den Oderteich ist in den öffentlich angebundenen Betreiberfeeds keine Messreihe verfügbar." : "Messdaten konnten aktuell nicht vom Betreiber geladen werden. Kein Rückschluss auf Füllstand oder Gefahr möglich.",
      } };
    });
    store?.saveReservoirs(list);
    const provider = (id: string, name: string, url: string, results: CacheResult<unknown>[], interval: string): ProviderState => {
      const available = results.filter(r => r.data && !r.stale).length;
      return { id, name, url, state: available === results.length ? (results.some(r => r.state === "live") ? "live" : "cached") : "unavailable", fetchedAt: results.map(r => r.fetchedAt).filter((d): d is string => !!d).sort().at(-1) || null,
        stale: results.some(r => r.stale), message: `${available} von ${results.length} Abrufen aktuell verfügbar. ${interval} Ungeprüfte Rohdaten; einzelne Parameter können fehlen oder älter sein.` };
    };
    return { generatedAt: new Date().toISOString(), reservoirs: list.filter(r => reservoirInRegion(r, region)), providers: [
      provider("tsb", "Talsperrenbetrieb Sachsen-Anhalt", RESERVOIR_URLS.tsbPublic, [tsb], "Betreiber aktualisiert üblicherweise täglich."),
      provider("hww", "Harzwasserwerke · TALIS", RESERVOIR_URLS.hwwPublic, hww.map(([, r]) => r), "Messwerte der sechs Harztalsperren."),
    ] };
  };
}
