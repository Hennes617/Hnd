import {
  rivers,
  sources,
  pointInRegion,
  riverInRegion,
} from "@hnd/shared";
import type {
  FloodWarning,
  Measurement,
  ProviderState,
  Region,
  Snapshot,
  Station,
  StationHistory,
} from "@hnd/shared";
import { AsyncCache, type CacheResult } from "./cache.js";
import type { Config } from "./config.js";
import {
  freshness,
  regionForPoint,
  iso,
  number,
  plainText,
  parseKistersHistory,
  parseLhpStations,
  parsePegelHistory,
  parsePegelStations,
  parseWarning,
  parseWarningReferences,
  record,
  string,
} from "./parsers.js";
import { beforeDeadline, mapConcurrent, type FetchJson } from "./upstream.js";
import type { WaterStore } from "./storage.js";
import { createReservoirService } from "./reservoirs.js";
import { NLWKN_SOURCE, NLWKN_URL, nlwknHistoryUrl, parseNlwknHistory, parseNlwknStations, type NlwknStation } from "./nlwkn.js";
import referenceCatalog from "./data/lhp-stations-reference.json" with { type: "json" };
const referenceStations = referenceCatalog.stations as Station[];

export const URLS = {
  pegel: "https://www.pegelonline.wsv.de/webservices/rest-api/v2",
  lhp: "https://api.hochwasserzentralen.de/public/v1/data/stations?format=json",
  lhw: "https://hvz.lsaurl.de/fileadmin/Bibliothek/Politik_und_Verwaltung/MLU/HVZ/KISTERS/data/internet/stations",
  nina: "https://warnung.bund.de/api31",
};
interface LhwIndex {
  stationNo: string;
  siteNo: string;
  station: Station;
}
interface WarningData {
  warnings: FloodWarning[];
  failed: number;
  total: number;
}
interface LhwData {
  stations: Station[];
  failed: number;
  total: number;
  excludedIds: string[];
}
export interface DataService {
  overview(region: Region): Promise<Snapshot>;
  station(id: string): Promise<Station | null>;
  history(id: string): Promise<StationHistory | null>;
  reservoirs: ReturnType<typeof createReservoirService>;
}
function provider<T>(
  id: string,
  name: string,
  url: string,
  result: CacheResult<T>,
  message: string,
): ProviderState {
  return {
    id,
    name,
    url,
    state: result.state,
    fetchedAt: result.fetchedAt,
    stale: result.stale,
    message:
      result.state === "unavailable"
        ? "Quelle nicht erreichbar oder Antwort ungültig. Datenlage unbekannt."
        : result.stale
          ? "Aktualisierung fehlgeschlagen. Älterer Cache; keine verlässliche aktuelle Aussage."
          : message,
  };
}
function staleStations(result: CacheResult<Station[]>): Station[] {
  return (result.data || []).map((station) => ({
    ...station,
    freshness:
      result.stale && station.measurement
        ? "stale"
        : freshness(station.measurement),
    // Never serve a stale official no-flood classification as an up-to-date status.
    ...(result.stale ||
    !station.warningTimestamp ||
    Date.now() - Date.parse(station.warningTimestamp) > 2 * 60 * 60_000
      ? {
          warningLevel: undefined,
          warningLabel: undefined,
          warningTimestamp: undefined,
        }
      : {}),
  }));
}
/** Join only a unique official number with a matching location. Never match by proximity alone. */
export function mergePegelStations(stateStations: Station[], federalStations: Station[], matchedIds = new Set<string>()): Station[] {
  const used = matchedIds;
  const normalizedName = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const enriched = stateStations.map(station => {
    const stationNo = station.sourceStationNumber || station.id.match(/^[A-Z]{2}_(\d+)$/)?.[1];
    if (!stationNo) return station;
    const matches = federalStations.filter(federal => federal.sourceStationNumber === stationNo &&
      Math.abs(federal.latitude - station.latitude) < 0.025 && Math.abs(federal.longitude - station.longitude) < 0.04 &&
      (normalizedName(station.name) === normalizedName(federal.name) || normalizedName(station.water) === normalizedName(federal.water)));
    if (matches.length !== 1) return station;
    const federal = matches[0];
    used.add(federal.id);
    // Prefer the newer valid observation, retaining its exact provider for history requests.
    const useFederal = !!federal.measurement && (!station.measurement || Date.parse(federal.measurement.timestamp) > Date.parse(station.measurement.timestamp));
    return {
      ...station,
      ...(!station.historyAvailable || useFederal ? { measurementSourceId: federal.id, historyAvailable: federal.historyAvailable } : {}),
      ...(useFederal ? { measurement: federal.measurement, freshness: federal.freshness, agency: `${station.agency} · WSV PEGELONLINE` } : {}),
      discharge: federal.discharge || station.discharge,
    };
  });
  // One marker per verified shared identity avoids a grey WSV marker covering an LHP warning marker.
  return [...enriched, ...federalStations.filter(station => !used.has(station.id))];
}
export function createDataService(
  fetchJson: FetchJson,
  config: Pick<Config, "cacheTtlMs">,
  store?: WaterStore,
): DataService {
  const cache = <T>(key: string, ttlMs: number, staleMs: number) => store?.cache<T>(key, ttlMs, staleMs) ?? new AsyncCache<T>(ttlMs, staleMs);
  const pegelCache = cache<Station[]>("pegel:stations:v2", config.cacheTtlMs, 60 * 60_000);
  const lhpCache = cache<{ stations: Station[]; updatedAt?: string }>("lhp:stations:v2", config.cacheTtlMs, 60 * 60_000);
  const warningCache = cache<WarningData>("nina:warnings:v1",
    config.cacheTtlMs,
    15 * 60_000,
  );
  const lhwIndexCache = cache<LhwIndex[]>("lhw:index:v2",
    24 * 60 * 60_000,
    7 * 24 * 60 * 60_000,
  );
  const lhwCache = cache<LhwData>("lhw:stations:v3", config.cacheTtlMs, 60 * 60_000);
  const nlwknCache = cache<NlwknStation[]>("nlwkn:stations:v1", config.cacheTtlMs, 60 * 60_000);
  const reservoirData = createReservoirService(fetchJson, config.cacheTtlMs, store);
  const nlwkn = () => nlwknCache.get(async () => {
    const data = parseNlwknStations(await fetchJson(NLWKN_URL));
    for (const entry of data) store?.saveHistory(entry.station.id, entry.measurements);
    return data;
  });
  const histories = new Map<string, AsyncCache<Measurement[]>>();
  const pegel = () =>
    pegelCache.get(async () =>
      parsePegelStations(
        await fetchJson(
          `${URLS.pegel}/stations.json?includeTimeseries=true&includeCurrentMeasurement=true`,
        ),
      ),
    );
  const lhp = () =>
    lhpCache.get(async () => {
      const payload = await fetchJson(URLS.lhp);
      const stations = parseLhpStations(payload);
      return { stations, updatedAt: iso(record(payload).updated) || undefined };
    });
  const lhwIndex = () =>
    lhwIndexCache.get(async () => {
      const payload = await fetchJson(`${URLS.lhw}/stations.json`);
      if (!Array.isArray(payload))
        throw new Error("Unexpected LHW station format");
      return payload.flatMap((raw) => {
        const item = record(raw);
        const stationNo = string(item.station_no);
        const siteNo = string(item.site_no);
        const latitude = number(item.station_latitude);
        const longitude = number(item.station_longitude);
        const name = string(item.station_name).trim();
        if (
          !/^\d{1,12}$/.test(stationNo) ||
          !/^[a-zA-Z0-9_-]{1,40}$/.test(siteNo) ||
          !name ||
          latitude === null ||
          longitude === null ||
          Math.abs(latitude) > 90 ||
          Math.abs(longitude) > 180
        )
          return [];
        const note = [
          item.web_anmerkung,
          item.web_wichtigerhinweis,
          item.web_station_top_hinweis,
          item.web_station_bottom_hinweis,
        ]
          .map(plainText)
          .filter(Boolean)
          .join(" ");
        return [
          {
            stationNo,
            siteNo,
            station: {
              id: `ST_${stationNo}`,
              sourceStationNumber: stationNo,
              measurementSourceId: `ST_${stationNo}`,
              historyAvailable: true,
              name,
              water: string(item.WTO_OBJECT).trim(),
              latitude,
              longitude,
              agency: "LHW Sachsen-Anhalt",
              sourceUrl: `https://hvz.lsaurl.de/#${stationNo}`,
              region: regionForPoint(latitude, longitude),
              measurement: null,
              discharge: null,
              freshness: "unavailable" as const,
              ...(note ? { note } : {}),
            },
          },
        ];
      });
    });
  const series = (
    key: string,
    url: string,
    parser: (payload: unknown) => Measurement[],
  ) => {
    if (!histories.has(key)) {
      if (histories.size >= 256)
        histories.delete(histories.keys().next().value!);
      histories.set(
        key,
        cache<Measurement[]>(`history:${key}:v1`, config.cacheTtlMs, 60 * 60_000),
      );
    }
    return histories.get(key)!.get(async () => {
      const measurements = parser(await fetchJson(url));
      if (key.endsWith(":W")) store?.saveHistory(key.slice(0, -2), measurements);
      return measurements;
    });
  };
  const lhw = () =>
    lhwCache.get(async () => {
      const deadline = Date.now() + 10_000;
      const index = await beforeDeadline(lhwIndex(), deadline);
      if (!index.data) throw new Error("LHW station index unavailable");
      const lookup = new Map(index.data.map((item) => [item.stationNo, item]));
      // This LHW catalogue also mirrors neighbouring states and WSV locations. Only enrich our
      // Sachsen-Anhalt scope here; national LHP/WSV feeds retain those external gauges under real IDs.
      const catalog = index.data.map((entry) => entry.station).filter(station => pointInRegion(station.latitude, station.longitude, "sachsen-anhalt"));
      const excludedIds = index.data.filter(entry => !pointInRegion(entry.station.latitude, entry.station.longitude, "sachsen-anhalt")).map(entry => entry.station.id);
      const matching = catalog
        .filter((s) => pointInRegion(s.latitude, s.longitude, "sachsen-anhalt"))
        .sort(
          (a, b) =>
            Number(b.region === "harz") - Number(a.region === "harz") ||
            Number(/elbe|saale/i.test(a.water)) -
              Number(/elbe|saale/i.test(b.water)),
        );
      if (!matching.length) return { stations: catalog, failed: 0, total: 0, excludedIds };
      let failed = 0;
      const stations = await mapConcurrent(matching, 8, async (station) => {
        const entry = lookup.get(station.id.slice(3))!;
        let history: CacheResult<Measurement[]>;
        try {
          if (Date.now() >= deadline) throw new Error("Budget exceeded");
          history = await beforeDeadline(
            series(
              `${station.id}:W`,
              `${URLS.lhw}/${entry.siteNo}/${entry.stationNo}/W/week.json`,
              parseKistersHistory,
            ),
            deadline,
          );
        } catch {
          failed++;
          return station;
        }
        if (!history.data || history.stale) failed++;
        const measurement = history.data?.at(-1) || null;
        return {
          ...station,
          agency: "LHW Sachsen-Anhalt · LHP",
          measurement,
          freshness:
            history.stale && measurement
              ? ("stale" as const)
              : freshness(measurement),
        };
      });
      const enriched = new Map(
        stations.map((station) => [station.id, station]),
      );
      return {
        stations: catalog.map((station) => enriched.get(station.id) || station),
        failed,
        total: matching.length,
        excludedIds,
      };
    });
  const warnings = () =>
    warningCache.get(async () => {
      const deadline = Date.now() + 12_000;
      const references = parseWarningReferences(
        await beforeDeadline(
          fetchJson(`${URLS.nina}/lhp/mapData.json`),
          deadline,
        ),
      );
      const selected = references.slice(0, 120);
      let failed = Math.max(0, references.length - selected.length);
      const details = await mapConcurrent(selected, 8, async (reference) => {
        try {
          if (Date.now() >= deadline) throw new Error("Budget exceeded");
          return parseWarning(
            await beforeDeadline(
              fetchJson(
                `${URLS.nina}/warnings/${encodeURIComponent(reference.id)}.json`,
              ),
              deadline,
            ),
            reference,
          );
        } catch {
          failed++;
          return null;
        }
      });
      if (references.length && failed === references.length)
        throw new Error("Warning details unavailable");
      return {
        warnings: details.filter((item): item is FloodWarning => item !== null),
        failed,
        total: references.length,
      };
    });
  async function stationData() {
    // Parallel warm-up against the historical station catalogue bounds first-request latency.
    const [pegelResult, lhpResult, lhwResult, nlwknResult] = await Promise.all([
      pegel(),
      lhp(),
      lhw(),
      nlwkn(),
    ]);
    const lhpDisplay = lhpResult.data
      ? staleStations({ ...lhpResult, data: lhpResult.data.stations })
      : referenceStations;
    const nlwknStations = staleStations({ ...nlwknResult, data: nlwknResult.data?.map(entry => entry.station) || null });
    const updatedLhw = new Map(
      [...(lhwResult?.data?.stations || []), ...nlwknStations].map((s) => [s.id, s]),
    );
    const mergedLhp = lhpDisplay.map((s) => {
      const enriched = updatedLhw.get(s.id);
      return enriched
        ? {
            ...s,
            latitude: enriched.latitude,
            longitude: enriched.longitude,
            note: enriched.note,
            agency: enriched.agency,
            sourceStationNumber: enriched.sourceStationNumber,
            measurementSourceId: enriched.measurementSourceId,
            historyAvailable: enriched.historyAvailable,
            measurement: enriched.measurement,
            freshness:
              (enriched.freshness === "stale" || (enriched.id.startsWith("NI_") ? nlwknResult.stale : lhwResult.stale)) && enriched.measurement
                ? ("stale" as const)
                : freshness(enriched.measurement),
          }
        : s;
    });
    const providers = [
      {
        ...provider(
          "lhp",
          "Länderübergreifendes Hochwasserportal",
          URLS.lhp,
          lhpResult,
          "Amtliche Standorte und Hochwasserklassen. Enthält selbst keine Wasserstandsmesswerte.",
        ),
        dataUpdatedAt: lhpResult.data?.updatedAt,
      },
      provider(
        "pegelonline",
        "PEGELONLINE · WSV",
        `${URLS.pegel}/stations.json`,
        pegelResult,
        "Wasserstände und Abflüsse an Bundeswasserstraßen; ungeprüfte Rohdaten.",
      ),
      provider("nlwkn", "NLWKN · Niedersachsen", NLWKN_SOURCE, nlwknResult, "Wasserstände und beobachtete Zeitreihen aus dem öffentlichen Pegelonline-Webservice. Quelle: www.pegelonline.nlwkn.niedersachsen.de; ungeprüfte Rohdaten."),
    ];
    if (!lhpResult.data)
      providers.push({
        id: "lhp-reference",
        name: "LHP · Historischer Standortkatalog",
        state: "reference",
        fetchedAt: referenceCatalog.recordedAt,
        url: referenceCatalog.sourceUrl,
        message: `Nur Standortmetadaten, Stand ${referenceCatalog.recordedAt.slice(0, 10)}. Keine aktuellen Hochwasserklassen oder Messwerte. Quelle: LHP, CC BY 4.0.`,
      });
    if (lhwResult) {
      const state = provider(
        "lhw",
        "LHW Sachsen-Anhalt",
        "https://hvz.lsaurl.de/",
        lhwResult,
        `Wasserstände an ${lhwResult.data?.total || 0} LHW-Standorten in Sachsen-Anhalt; Landkreis Harz wird zuerst aktualisiert.`,
      );
      if (lhwResult.data?.failed && !lhwResult.stale) {
        state.message += ` ${lhwResult.data.failed} Zeitreihen nicht aktuell verfügbar; Abdeckung unvollständig.`;
        state.state = "unavailable";
      }
      providers.push(state);
    } else
      providers.push({
        id: "lhw",
        name: "LHW Sachsen-Anhalt",
        url: "https://hvz.lsaurl.de/",
        state: "unavailable",
        fetchedAt: null,
        message:
          "Für den Standortabgleich werden aktuelle LHP-Metadaten benötigt.",
      });
    // Keep provider identifiers intact: nearby state/WSV gauges are not necessarily the same station.
    const lhpIds = new Set(mergedLhp.map((s) => s.id));
    const extraLhw = [...(lhwResult.data?.stations || []), ...nlwknStations]
      .filter((s) => !lhpIds.has(s.id))
      .map((s) => ({
        ...s,
        freshness:
          (s.freshness === "stale" || (s.id.startsWith("NI_") ? nlwknResult.stale : lhwResult.stale)) && s.measurement
            ? ("stale" as const)
            : freshness(s.measurement),
      }));
    const mergedFederalIds = new Set<string>();
    const active = mergePegelStations([...mergedLhp, ...extraLhw], staleStations(pegelResult), mergedFederalIds).map(
        (station) => ({
          ...station,
          region: regionForPoint(station.latitude, station.longitude),
        }),
      );
    const saved = new Map((store?.stations() || []).map(station => [station.id, station]));
    // Also recognize a saved federal identity during a WSV outage, even when newer NLWKN data won.
    mergePegelStations(active, [...saved.values()].filter(s => !/^[A-Z]{2}_/.test(s.id)), mergedFederalIds);
    const stations: Station[] = active.map(station => {
      const previous = saved.get(station.id);
      if (station.measurement || !previous?.measurement) return station;
      return { ...station, measurement: previous.measurement, discharge: station.discharge || previous.discharge,
        freshness: "stale" as const, measurementSourceId: station.measurementSourceId || previous.measurementSourceId,
        historyAvailable: station.historyAvailable || previous.historyAvailable,
        note: `${station.note || ""} Letzter lokal gespeicherter Messwert; aktuell kein Wasserstand vom Anbieter verfügbar.`.trim() };
    });
    const visible = new Set(stations.map(s => s.id));
    const aliases = new Set(stations.map(s => s.measurementSourceId));
    const excludedLhwIds = new Set(lhwResult.data?.excludedIds || []);
    const historical = [...saved.values()].filter(s => !visible.has(s.id) && !aliases.has(s.id) && !mergedFederalIds.has(s.id) && !excludedLhwIds.has(s.id)).map(station => ({
      ...station, freshness: station.measurement ? "stale" as const : "unavailable" as const,
      warningLevel: undefined, warningLabel: undefined, warningTimestamp: undefined,
      note: "Zuletzt lokal gespeicherter Standort und Messwert; Quelle aktuell nicht verfügbar. Keine aktuelle Warnklassifikation.",
    }));
    stations.push(...historical);
    if (historical.length) providers.push({ id: "local-catalog", name: "Lokaler Standortkatalog", state: "reference", fetchedAt: null,
      url: "https://www.hochwasserzentralen.de/", message: `${historical.length} früher empfangene Standorte bleiben bei Quellenausfällen sichtbar. Messwerte sind als älter gekennzeichnet, Warnklassen werden nicht übernommen.` });
    store?.saveStations(stations);
    return {
      stations,
      providers,
    };
  }
  return {
    reservoirs: reservoirData,
    async overview(region) {
      const [data, warningResult, reservoirResult] = await Promise.all([
        stationData(),
        warnings(),
        reservoirData(region),
      ]);
      const warningProvider = provider(
        "nina-lhp",
        "NINA · Hochwasserwarnungen",
        `${URLS.nina}/lhp/mapData.json`,
        warningResult,
        "Hochwassermeldungen des LHP über NINA; keine vollständige Abdeckung aller lokalen Gefahren.",
      );
      if (warningResult.data?.failed) {
        warningProvider.state = "unavailable";
        warningProvider.message = `${warningResult.data.failed} von ${warningResult.data.total} Meldungen nicht vollständig abrufbar. Warnlage unvollständig.`;
      }
      return {
        generatedAt: new Date().toISOString(),
        region,
        stations: data.stations.filter((s) =>
          pointInRegion(s.latitude, s.longitude, region),
        ),
        rivers: rivers.filter((river) => riverInRegion(river, region)),
        reservoirs: reservoirResult.reservoirs,
        warnings: (warningResult.data?.warnings || []).filter(
          (w) =>
            (region === "germany" ||
              w.region === "harz" ||
              (region === "sachsen-anhalt" && w.region === "sachsen-anhalt")) &&
            (!w.expiresAt || Date.parse(w.expiresAt) > Date.now()),
        ),
        sources,
        providers: [
          ...data.providers,
          warningProvider,
          ...reservoirResult.providers,
          {
            id: "catalog",
            name: "Gewässeratlas Harz",
            state: "reference",
            fetchedAt: null,
            message:
              "Redaktionelle Orientierung; vereinfachte Verläufe und Standorte. Talsperren-Messwerte stammen gesondert von TSB und Harzwasserwerken.",
            url: "https://www.hochwasserzentralen.de/",
          },
        ],
        coverage: {
          complete: false,
          stations:
            "LHP liefert bundesweite Standorte und Warnklassen, keine Wasserstandswerte. PEGELONLINE-Messwerte werden über amtliche Stationsnummern mit Lage- und Namens-/Gewässerprüfung zugeordnet; bestätigte gleiche Identitäten erscheinen nur einmal. LHW ergänzt Sachsen-Anhalt, NLWKN Niedersachsen. Weitere Landesmesswerte sind nicht flächendeckend angebunden. Fehlende Warnklassen sind keine Entwarnung.",
          warnings:
            "LHP-Hochwasserfeed über NINA. Zuordnung anhand amtlicher CAP-Gebietscodes und Gebietsbezeichnungen. Landesweite Warnungen für Sachsen-Anhalt gelten auch im Landkreis Harz. Unklare Gebietszuordnungen können fehlen; fehlende Meldungen sind keine Entwarnung.",
          geography:
            "Sachsen-Anhalt und Landkreis Harz nach amtlichen BKG-Verwaltungsgrenzen. Harz bezeichnet ausschließlich den Landkreis Harz, nicht das Harzgebirge in Niedersachsen oder Thüringen. Gewässer werden bei einem Verlaufspunkt oder einer Verlaufskreuzung im Gebiet aufgenommen und mit vollständigem schematischem Verlauf angezeigt. Die Auswahl ist nicht vollständig.",
        },
      };
    },
    async station(id) {
      const data = await stationData();
      // Federal UUIDs remain addressable after their map marker was joined with an LHP identity.
      const found = data.stations.find((s) => s.id === id) || staleStations(await pegel()).find(s => s.id === id);
      if (!found) return null;
      if (id.startsWith("ST_") && (!found.measurementSourceId || found.measurementSourceId === id)) {
        const index = await lhwIndex();
        const entry = index.data?.find((s) => s.stationNo === id.slice(3));
        if (entry) {
          const [w, q] = await Promise.all([
            series(
              `${id}:W`,
              `${URLS.lhw}/${entry.siteNo}/${entry.stationNo}/W/week.json`,
              parseKistersHistory,
            ),
            series(
              `${id}:Q`,
              `${URLS.lhw}/${entry.siteNo}/${entry.stationNo}/Q/week.json`,
              (payload) => parseKistersHistory(payload, "m³/s"),
            ),
          ]);
          const latest = w.data?.at(-1) || null;
          const useLatest = latest && (!found.measurement || Date.parse(latest.timestamp) >= Date.parse(found.measurement.timestamp));
          const measurement = useLatest ? latest : found.measurement;
          return {
            ...found,
            measurement,
            freshness:
              useLatest ? (w.stale ? "stale" : freshness(measurement)) : found.freshness,
            discharge: q.data?.at(-1) || found.discharge,
          };
        }
      }
      return found;
    },
    async history(id) {
      const data = await stationData();
      const stations = await pegel();
      const station = data.stations.find(s => s.id === id) || stations.data?.find(s => s.id === id) || store?.station(id);
      if (!station) return null;
      const sourceId = station.measurementSourceId || id;
      let result: CacheResult<Measurement[]> = { data: null, state: "unavailable", fetchedAt: null, stale: false };
      let sourceName = "Lokale Beobachtungen";
      let sourceUrl = station.sourceUrl;
      let providerId = "local-history";
      if (/^nlwkn-\d+$/.test(sourceId)) {
        result = await series(`${id}:W`, nlwknHistoryUrl(sourceId.slice(6)), parseNlwknHistory);
        // The station feed already contains real recent observations, useful if the week export fails.
        if (!result.data?.length) {
          const entry = (await nlwkn()).data?.find(item => item.station.id === id);
          if (entry?.measurements.length) result = { ...result, data: entry.measurements, state: "cached", stale: true };
        }
        sourceName = "NLWKN · Niedersachsen";
        sourceUrl = NLWKN_SOURCE;
        providerId = "nlwkn";
      } else if (sourceId.startsWith("ST_")) {
        const index = await lhwIndex();
        const entry = index.data?.find((s) => s.stationNo === sourceId.slice(3));
        if (entry) result = await series(
          `${sourceId}:W`,
          `${URLS.lhw}/${entry.siteNo}/${entry.stationNo}/W/week.json`,
          parseKistersHistory,
        );
        sourceName = "LHW Sachsen-Anhalt";
        sourceUrl = "https://hvz.lsaurl.de/";
        providerId = "lhw";
      } else {
        const federal = stations.data?.find((s) => s.id === sourceId);
        if (federal) {
          result = await series(
          `${sourceId}:W`,
          `${URLS.pegel}/stations/${encodeURIComponent(sourceId)}/W/measurements.json?start=P7D`,
          (payload) =>
            parsePegelHistory(payload, federal.measurement?.unit || "cm"),
        );
          sourceName = "PEGELONLINE · WSV";
          sourceUrl = URLS.pegel;
          providerId = "pegelonline";
        }
      }
      if (result.data?.length) store?.saveHistory(id, result.data);
      const local = store?.history(id) || [];
      const all = [...local, ...(result.data || []), ...(station.measurement ? [station.measurement] : [])];
      const cutoff = Date.now() - 7 * 86_400_000;
      const measurements = [...new Map(all.filter(m => Date.parse(m.timestamp) >= cutoff && Date.parse(m.timestamp) <= Date.now() + 5 * 60_000).map(m => [`${Date.parse(m.timestamp)}:${m.unit}`, { ...m, timestamp: new Date(m.timestamp).toISOString() }])).values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const state = provider(providerId, sourceName, sourceUrl, result, "Letzte verfügbare sieben Tage; ungeprüfte Rohdaten. Echte lokal gespeicherte Beobachtungen ergänzen den Verlauf; Lücken werden nicht aufgefüllt.");
      if (!result.data?.length) {
        state.id = "local-history";
        state.name = "Lokal gespeicherte Beobachtungen";
        state.state = measurements.length ? "cached" : "unavailable";
        state.stale = true;
        state.fetchedAt = null;
        state.message = measurements.length ? "Nur tatsächlich gespeicherte Beobachtungen; die Quellzeitreihe ist nicht verfügbar. Die Zeitpunkte können unregelmäßig sein, Datenlücken bleiben bestehen." : "Für diesen Standort ist keine Wasserstandszeitreihe angebunden oder abrufbar. Die amtliche Warnklasse allein enthält keine Messwerte.";
      }
      return {
        stationId: id,
        parameter: "W",
        measurements,
        provider: state,
      };
    },
  };
}
