import {
  rivers,
  reservoirs,
  sources,
  pointInRegion,
  riverInRegion,
  reservoirInRegion,
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
}
export interface DataService {
  overview(region: Region): Promise<Snapshot>;
  station(id: string): Promise<Station | null>;
  history(id: string): Promise<StationHistory | null>;
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
export function createDataService(
  fetchJson: FetchJson,
  config: Pick<Config, "cacheTtlMs">,
): DataService {
  const pegelCache = new AsyncCache<Station[]>(config.cacheTtlMs, 60 * 60_000);
  const lhpCache = new AsyncCache<Station[]>(config.cacheTtlMs, 60 * 60_000);
  const warningCache = new AsyncCache<WarningData>(
    config.cacheTtlMs,
    15 * 60_000,
  );
  const lhwIndexCache = new AsyncCache<LhwIndex[]>(
    24 * 60 * 60_000,
    7 * 24 * 60 * 60_000,
  );
  const lhwCache = new AsyncCache<LhwData>(config.cacheTtlMs, 60 * 60_000);
  const histories = new Map<string, AsyncCache<Measurement[]>>();
  let lhpDataUpdatedAt: string | undefined;
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
      lhpDataUpdatedAt = iso(record(payload).updated) || undefined;
      return stations;
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
        new AsyncCache<Measurement[]>(config.cacheTtlMs, 60 * 60_000),
      );
    }
    return histories.get(key)!.get(async () => parser(await fetchJson(url)));
  };
  const lhw = () =>
    lhwCache.get(async () => {
      const deadline = Date.now() + 10_000;
      const index = await beforeDeadline(lhwIndex(), deadline);
      if (!index.data) throw new Error("LHW station index unavailable");
      const lookup = new Map(index.data.map((item) => [item.stationNo, item]));
      // Keep every catalogue location; prioritise Landkreis Harz, then other Sachsen-Anhalt gauges.
      const catalog = index.data.map((entry) => entry.station);
      const matching = catalog
        .filter((s) => pointInRegion(s.latitude, s.longitude, "sachsen-anhalt"))
        .sort(
          (a, b) =>
            Number(b.region === "harz") - Number(a.region === "harz") ||
            Number(/elbe|saale/i.test(a.water)) -
              Number(/elbe|saale/i.test(b.water)),
        );
      if (!matching.length) return { stations: catalog, failed: 0, total: 0 };
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
    const [pegelResult, lhpResult, lhwResult] = await Promise.all([
      pegel(),
      lhp(),
      lhw(),
    ]);
    const lhpDisplay = lhpResult.data
      ? staleStations(lhpResult)
      : referenceStations;
    const updatedLhw = new Map(
      (lhwResult?.data?.stations || []).map((s) => [s.id, s]),
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
            measurement: enriched.measurement,
            freshness:
              lhwResult?.stale && enriched.measurement
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
        dataUpdatedAt: lhpDataUpdatedAt,
      },
      provider(
        "pegelonline",
        "PEGELONLINE · WSV",
        `${URLS.pegel}/stations.json`,
        pegelResult,
        "Wasserstände und Abflüsse an Bundeswasserstraßen; ungeprüfte Rohdaten.",
      ),
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
    const extraLhw = (lhwResult.data?.stations || [])
      .filter((s) => !lhpIds.has(s.id))
      .map((s) => ({
        ...s,
        freshness:
          lhwResult.stale && s.measurement
            ? ("stale" as const)
            : freshness(s.measurement),
      }));
    return {
      stations: [...mergedLhp, ...extraLhw, ...staleStations(pegelResult)].map(
        (station) => ({
          ...station,
          region: regionForPoint(station.latitude, station.longitude),
        }),
      ),
      providers,
    };
  }
  return {
    async overview(region) {
      const [data, warningResult] = await Promise.all([
        stationData(),
        warnings(),
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
        reservoirs: reservoirs.filter((reservoir) =>
          reservoirInRegion(reservoir, region),
        ),
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
          {
            id: "catalog",
            name: "Gewässeratlas Harz",
            state: "reference",
            fetchedAt: null,
            message:
              "Redaktionelle Orientierung; vereinfachte Verläufe und Standorte. Keine Live-Stauinhalte.",
            url: "https://www.hochwasserzentralen.de/",
          },
        ],
        coverage: {
          complete: false,
          stations:
            "LHP-Standorte bundesweit, PEGELONLINE-Messwerte an Bundeswasserstraßen, LHW-Standortkatalog mit Wasserständen in Sachsen-Anhalt und Priorität für den Landkreis Harz. Landes- und Bundespegel können räumlich zusammenfallen; Identitäten bleiben getrennt.",
          warnings:
            "LHP-Hochwasserfeed über NINA. Zuordnung anhand amtlicher CAP-Gebietscodes und Gebietsbezeichnungen. Landesweite Warnungen für Sachsen-Anhalt gelten auch im Landkreis Harz. Unklare Gebietszuordnungen können fehlen; fehlende Meldungen sind keine Entwarnung.",
          geography:
            "Sachsen-Anhalt und Landkreis Harz nach amtlichen BKG-Verwaltungsgrenzen. Harz bezeichnet ausschließlich den Landkreis Harz, nicht das Harzgebirge in Niedersachsen oder Thüringen. Gewässer werden bei einem Verlaufspunkt oder einer Verlaufskreuzung im Gebiet aufgenommen und mit vollständigem schematischem Verlauf angezeigt. Die Auswahl ist nicht vollständig.",
        },
      };
    },
    async station(id) {
      const data = await stationData();
      const found = data.stations.find((s) => s.id === id);
      if (!found) return null;
      if (id.startsWith("ST_")) {
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
          const measurement = w.data?.at(-1) || null;
          return {
            ...found,
            measurement,
            freshness:
              w.stale && measurement ? "stale" : freshness(measurement),
            discharge: q.data?.at(-1) || null,
          };
        }
      }
      return found;
    },
    async history(id) {
      let result: CacheResult<Measurement[]>;
      if (id.startsWith("ST_")) {
        const index = await lhwIndex();
        const entry = index.data?.find((s) => s.stationNo === id.slice(3));
        if (!entry) return null;
        result = await series(
          `${id}:W`,
          `${URLS.lhw}/${entry.siteNo}/${entry.stationNo}/W/week.json`,
          parseKistersHistory,
        );
      } else {
        const stations = await pegel();
        const station = stations.data?.find((s) => s.id === id);
        if (!station) return null;
        result = await series(
          `${id}:W`,
          `${URLS.pegel}/stations/${encodeURIComponent(id)}/W/measurements.json?start=P7D`,
          (payload) =>
            parsePegelHistory(payload, station.measurement?.unit || "cm"),
        );
      }
      return {
        stationId: id,
        parameter: "W",
        measurements: result.data || [],
        provider: provider(
          id.startsWith("ST_") ? "lhw" : "pegelonline",
          id.startsWith("ST_") ? "LHW Sachsen-Anhalt" : "PEGELONLINE",
          id.startsWith("ST_") ? "https://hvz.lsaurl.de/" : URLS.pegel,
          result,
          "Letzte verfügbare sieben Tage; ungeprüfte Rohdaten.",
        ),
      };
    },
  };
}
