import {
  pointInRegion,
  type ForecastHour,
  type ForecastLocation,
  type ForecastSnapshot,
  type ProviderState,
  type RainfallForecast,
  type Region,
  type RiverForecast,
} from '@hnd/shared';
import { AsyncCache, type CacheResult } from './cache.js';
import { FORECAST_LOCATIONS, RIVER_FORECAST_LOCATIONS } from './forecast-locations.js';
import { beforeDeadline, type FetchJson } from './upstream.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const FORECAST_URLS = {
  weather: 'https://api.open-meteo.com/v1/forecast',
  river: 'https://flood-api.open-meteo.com/v1/flood',
};
interface Series<T> { points: Map<number, T>; latitude: number; longitude: number; }
interface RainValues { precipitationMm: number | null; rainMm: number | null; probabilityPercent: number | null; }
interface Batch<T> { series: Map<string, Series<T>>; rejected: number; }
export interface ForecastConfig {
  cacheTtlMs?: number;
  staleMs?: number;
  providerTimeoutMs?: number;
  now?: () => number;
}

const methodology: ForecastSnapshot['methodology'] = {
  version: 'rainfall-context-1',
  description: '72 Stunden modellierter Niederschlag an 14 ausgewählten Orten in Sachsen-Anhalt, davon 5 im Landkreis Harz. Die Deutschlandansicht erweitert diese Prognoseabdeckung nicht. Summen und Klassen basieren auf Niederschlag einschließlich Regen und Schneewasseräquivalent; Regen wird zusätzlich separat ausgewiesen. Zeitstempel sind UTC; ausgegeben werden die nächsten 72 stündlichen Niederschlagsintervalle mit zukünftigem Endzeitpunkt. Das erste Intervall kann beim Abruf bereits teilweise verstrichen sein; Summen sind keine sekundengenauen Integrale ab dem Abrufzeitpunkt. Open-Meteo kombiniert Wettermodelle (best_match). GloFAS liefert separat 7 tägliche Ensemble-Mittel des modellierten Abflusses an Rasterpunkten im Raum Magdeburg und Halle. Die Zuordnung dieser Rasterpunkte zu konkreten Flüssen ist nicht fachlich validiert.',
  thresholds: 'Eigene, nicht kalibrierte Orientierungsklassen der Niederschlagsbelastung: hoch bei ≥30 mm/24 h, ≥60 mm/72 h, ≥15 mm/1 h oder ≥25 mm/6 h; erhöht bei ≥15 mm/24 h, ≥30 mm/72 h, ≥8 mm/1 h oder ≥15 mm/6 h; sonst niedrig. Stunden- und 6-Stunden-Maxima werden über 72 h ermittelt. Klassen und Maxima erfordern 72 vollständige Niederschlagswerte; jede Summe erfordert alle Stunden ihres Zeitfensters. Fehlende Werte ergeben null beziehungsweise unbekannt, niemals 0.',
  limitations: [
    'Dies ist keine Hochwasserwahrscheinlichkeit, keine Pegelvorhersage und keine amtliche Warnung. Eine niedrige Regenklasse bedeutet keine Hochwasserentwarnung.',
    'Niederschlagswahrscheinlichkeit beschreibt Regen am Modellpunkt, nicht die Wahrscheinlichkeit eines Hochwassers.',
    'Einzelne Orte ersetzen keine flächige Einzugsgebietsanalyse. Bodenfeuchte, Vorregen, Schneeschmelze, aktuelle Pegel und Talsperrensteuerung gehen nicht in die Regenklasse ein.',
    'Starkregen und Gebirgseffekte können räumlich oder zeitlich vom Wettermodell abweichen; Unsicherheit nimmt mit dem Vorhersagehorizont zu.',
    'GloFAS v4 hat ein Raster von etwa 5 km. Die Abflussreihen sind Modellwerte am jeweiligen Rasterpunkt, keine Messpegel. Die Rasterpunkte sind nicht als Elbe- oder Saale-Prognosen validiert; kleine Harzbäche und lokale Überflutungen werden nicht verlässlich abgebildet. Das Ensemble-Mittel zeigt nicht die gesamte Modellunsicherheit.',
    'Der Abrufzeitpunkt ist kein Modelllaufzeitpunkt. Bei Quellenausfall bleiben höchstens 6 Stunden alte Abrufe mit ausdrücklicher Veraltet-Kennzeichnung verfügbar; fehlende Zukunftsstunden bleiben offen.',
    'Maßgeblich für Schutzmaßnahmen sind amtliche Hochwasserwarnungen und Anweisungen der Behörden.',
  ],
  sources: [
    { name: 'Open-Meteo Wetter-API und Dokumentation', url: 'https://open-meteo.com/en/docs' },
    { name: 'Open-Meteo Flood API / GloFAS', url: 'https://open-meteo.com/en/docs/flood-api' },
    { name: 'Copernicus Emergency Management Service – GloFAS', url: 'https://global-flood.emergency.copernicus.eu/' },
    { name: 'Open-Meteo Nutzungsbedingungen: freie API für nichtkommerzielle Nutzung', url: 'https://open-meteo.com/en/terms' },
    { name: 'Datenlizenz CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  ],
};

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function bounded(value: unknown, maximum: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum ? value : null;
}
function timestamp(value: unknown): number | null {
  // Open-Meteo is explicitly requested to return UTC epoch seconds.
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 946_684_800 && value <= 7_258_118_400
    ? value * 1000 : null;
}
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function rounded(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }

function parseRainSeries(value: unknown): Series<RainValues> {
  const item = object(value);
  const hourly = object(item?.hourly);
  const units = object(item?.hourly_units);
  if (!item || item.utc_offset_seconds !== 0 || !hourly || units?.time !== 'unixtime' || units.precipitation !== 'mm') {
    throw new Error('Unexpected weather units or time zone');
  }
  const times = list(hourly.time);
  if (!times.length || times.length > 200) throw new Error('Missing weather time axis');
  const precipitation = list(hourly.precipitation);
  const rain = list(hourly.rain);
  const probability = list(hourly.precipitation_probability);
  const points = new Map<number, RainValues>();
  for (let i = 0; i < times.length; i++) {
    const time = timestamp(times[i]);
    if (time === null || time % HOUR !== 0 || points.has(time)) throw new Error('Invalid weather time axis');
    points.set(time, {
      precipitationMm: bounded(precipitation[i], 500),
      rainMm: units.rain === 'mm' ? bounded(rain[i], 500) : null,
      probabilityPercent: units.precipitation_probability === '%' ? bounded(probability[i], 100) : null,
    });
  }
  return { points, latitude: item.latitude as number, longitude: item.longitude as number };
}
function parseRiverSeries(value: unknown): Series<number | null> {
  const item = object(value);
  const daily = object(item?.daily);
  const units = object(item?.daily_units);
  if (!item || item.utc_offset_seconds !== 0 || !daily || units?.time !== 'unixtime' || units.river_discharge_mean !== 'm³/s') {
    throw new Error('Unexpected discharge units or time zone');
  }
  const times = list(daily.time);
  if (!times.length || times.length > 31) throw new Error('Missing discharge time axis');
  const values = list(daily.river_discharge_mean);
  const points = new Map<number, number | null>();
  for (let i = 0; i < times.length; i++) {
    const time = timestamp(times[i]);
    if (time === null || time % DAY !== 0 || points.has(time)) throw new Error('Invalid discharge time axis');
    points.set(time, bounded(values[i], 1_000_000));
  }
  return { points, latitude: item.latitude as number, longitude: item.longitude as number };
}

type Coordinates = { id: string; latitude: number; longitude: number };
/** IDs are explicit and 1-based: Open-Meteo omits the JSON field for ID zero. */
function parseBatch<T>(value: unknown, locations: Coordinates[], parser: (item: unknown) => Series<T>): Batch<T> {
  const rows = Array.isArray(value) ? value : [value];
  const series = new Map<string, Series<T>>();
  const seen = new Set<number>();
  let rejected = 0;
  for (const row of rows) {
    const item = object(row);
    const locationId = item?.location_id;
    if (typeof locationId !== 'number' || !Number.isInteger(locationId) || locationId < 1 || locationId > locations.length) {
      rejected++;
      continue;
    }
    const location = locations[locationId - 1];
    if (seen.has(locationId)) {
      series.delete(location.id); // A duplicated mapping is ambiguous; do not pick an arbitrary row.
      rejected++;
      continue;
    }
    seen.add(locationId);
    const latitude = item?.latitude;
    const longitude = item?.longitude;
    // Model grid cells need not equal the requested coordinates, but cannot be a different region.
    if (typeof latitude !== 'number' || !Number.isFinite(latitude) || typeof longitude !== 'number' || !Number.isFinite(longitude)
      || Math.abs(latitude - location.latitude) > 0.3 || Math.abs(longitude - location.longitude) > 0.5) {
      rejected++;
      continue;
    }
    try { series.set(location.id, parser(item)); }
    catch { rejected++; }
  }
  if (!series.size) throw new Error('No valid forecast locations returned');
  return { series, rejected };
}

function coordinates(url: URL, locations: Coordinates[]): void {
  url.searchParams.set('latitude', locations.map((s) => s.latitude).join(','));
  url.searchParams.set('longitude', locations.map((s) => s.longitude).join(','));
  url.searchParams.set('location_id', locations.map((_, i) => i + 1).join(','));
  url.searchParams.set('timezone', 'GMT');
  url.searchParams.set('timeformat', 'unixtime');
}
function weatherUrl(): string {
  const url = new URL(FORECAST_URLS.weather);
  coordinates(url, FORECAST_LOCATIONS);
  url.searchParams.set('hourly', 'precipitation,rain,precipitation_probability');
  // The API includes the current hour; the extra hour covers a cache crossing an hour boundary.
  url.searchParams.set('forecast_hours', '74');
  url.searchParams.set('models', 'best_match');
  url.searchParams.set('precipitation_unit', 'mm');
  return url.toString();
}
function riverUrl(): string {
  const url = new URL(FORECAST_URLS.river);
  coordinates(url, RIVER_FORECAST_LOCATIONS);
  url.searchParams.set('models', 'forecast_v4');
  url.searchParams.set('daily', 'river_discharge_mean');
  url.searchParams.set('forecast_days', '7');
  // This makes geometric cell selection reproducible, but does not validate river-network membership.
  url.searchParams.set('cell_selection', 'nearest');
  return url.toString();
}
function completeSum(values: (number | null)[], expected: number): number | null {
  if (values.length !== expected || values.some((value) => value === null)) return null;
  return rounded((values as number[]).reduce((sum, value) => sum + value, 0));
}
function rainfall(location: ForecastLocation, series: Series<RainValues> | undefined, now: number): RainfallForecast {
  // Precipitation timestamps mark the end of the preceding hour; never expose past endpoints.
  const firstHour = (Math.floor(now / HOUR) + 1) * HOUR;
  const hourly: ForecastHour[] = Array.from({ length: 72 }, (_, i) => {
    const time = firstHour + i * HOUR;
    const values = series?.points.get(time);
    return {
      timestamp: new Date(time).toISOString(),
      precipitationMm: values?.precipitationMm ?? null,
      rainMm: values?.rainMm ?? null,
      probabilityPercent: values?.probabilityPercent ?? null,
    };
  });
  const values = hourly.map((h) => h.precipitationMm);
  const next24hMm = completeSum(values.slice(0, 24), 24);
  const next72hMm = completeSum(values, 72);
  const complete = next72hMm !== null;
  const max1hMm = complete ? rounded(Math.max(...values as number[])) : null;
  const max6hMm = complete ? rounded(Math.max(...Array.from({ length: 67 }, (_, i) => completeSum(values.slice(i, i + 6), 6)!))) : null;
  let rainfallClass: RainfallForecast['rainfallClass'] = 'unknown';
  if (complete && next24hMm !== null && max1hMm !== null && max6hMm !== null) {
    rainfallClass = next24hMm >= 30 || next72hMm >= 60 || max1hMm >= 15 || max6hMm >= 25 ? 'high'
      : next24hMm >= 15 || next72hMm >= 30 || max1hMm >= 8 || max6hMm >= 15 ? 'elevated' : 'low';
  }
  const valid = values.filter((value) => value !== null).length;
  return {
    location, hourly,
    totals: { next24hMm, next72hMm, max1hMm, max6hMm },
    rainfallClass,
    completeness: complete ? 'complete' : valid ? 'partial' : 'unavailable',
    explanation: complete
      ? 'Eigene Orientierungsklasse aus vollständig vorliegenden Niederschlagswerten; keine Hochwasserwahrscheinlichkeit und keine amtliche Warnstufe.'
      : `${valid} von 72 Niederschlagsstunden verfügbar. Fehlende Werte bleiben offen; eine belastbare Niederschlagsklasse ist nicht verfügbar.`,
  };
}
function riverForecast(location: typeof RIVER_FORECAST_LOCATIONS[number], series: Series<number | null> | undefined, now: number): RiverForecast {
  const firstDay = Math.floor(now / DAY) * DAY;
  return {
    ...location,
    latitude: series?.latitude ?? location.latitude,
    longitude: series?.longitude ?? location.longitude,
    model: 'GloFAS v4 · Ensemble-Mittel',
    daily: Array.from({ length: 7 }, (_, i) => {
      const time = firstDay + i * DAY;
      return { timestamp: new Date(time).toISOString(), dischargeM3s: series?.points.get(time) ?? null };
    }),
    note: `Die Gewässerzuordnung dieses Rasterpunkts ist nicht fachlich validiert; die Reihe darf nicht als belegte Elbe- oder Saale-Vorhersage interpretiert werden. ${series ? 'Die Koordinaten bezeichnen die von Open-Meteo zurückgegebene Rasterzelle.' : 'Mangels Quelldaten sind nur die angefragten Zielkoordinaten angegeben; die Rasterzelle ist unbekannt.'} Modellierter täglicher Abfluss in m³/s (Raster ca. 5 km), einschließlich des heutigen UTC-Kalendertags. Keine Pegelvorhersage und keine lokale Überflutungsprognose; für kleine Harzbäche ungeeignet.`,
  };
}
function provider<T>(result: CacheResult<Batch<T>>, kind: 'weather' | 'river', count: number): ProviderState {
  const weather = kind === 'weather';
  const valid = result.data?.series.size ?? 0;
  return {
    id: weather ? 'open-meteo-weather' : 'open-meteo-glofas',
    name: weather ? 'Open-Meteo · Wettermodelle' : 'Open-Meteo · GloFAS / Copernicus',
    state: result.state, fetchedAt: result.fetchedAt, stale: result.stale,
    url: weather ? 'https://open-meteo.com/en/docs' : 'https://open-meteo.com/en/docs/flood-api',
    message: !result.data
      ? 'Quelle derzeit nicht verfügbar. Es werden keine Ersatzwerte oder Entwarnungen erzeugt.'
      : `${valid} von ${count} Modellpunkten abrufbar. ${result.stale ? 'Veralteter Abruf nach Quellenausfall; fehlende Zukunftswerte bleiben offen.' : 'Modellprognose; Abrufzeitpunkt ist kein Modelllaufzeitpunkt.'}${result.data.rejected ? ' Ungültige oder mehrdeutige Datensätze wurden verworfen.' : ''}${weather ? '' : ' Die Gewässerzuordnung der Rasterpunkte ist nicht fachlich validiert.'}`,
  };
}

export function createForecastService(fetchJson: FetchJson, config: ForecastConfig = {}) {
  const now = config.now ?? Date.now;
  const ttl = config.cacheTtlMs ?? 30 * 60_000;
  const stale = Math.min(config.staleMs ?? 6 * HOUR, 6 * HOUR);
  const budget = Math.min(config.providerTimeoutMs ?? 8_000, 8_000);
  const weatherCache = new AsyncCache<Batch<RainValues>>(ttl, stale, now);
  const riverCache = new AsyncCache<Batch<number | null>>(ttl, stale, now);
  const loadWeather = () => weatherCache.get(async () => parseBatch(
    await beforeDeadline(fetchJson(weatherUrl()), Date.now() + budget), FORECAST_LOCATIONS, parseRainSeries,
  ));
  const loadRiver = () => riverCache.get(async () => parseBatch(
    await beforeDeadline(fetchJson(riverUrl()), Date.now() + budget), RIVER_FORECAST_LOCATIONS, parseRiverSeries,
  ));
  return {
    async forecast(region: Region = 'sachsen-anhalt'): Promise<ForecastSnapshot> {
      const [weather, river] = await Promise.all([loadWeather(), region === 'harz' ? Promise.resolve(null) : loadRiver()]);
      const generated = now();
      const selected = FORECAST_LOCATIONS.filter((location) => pointInRegion(location.latitude, location.longitude, region));
      const riverProvider: ProviderState = river ? provider(river, 'river', RIVER_FORECAST_LOCATIONS.length) : {
        id: 'open-meteo-glofas', name: 'Open-Meteo · GloFAS / Copernicus', state: 'reference', fetchedAt: null,
        url: 'https://open-meteo.com/en/docs/flood-api',
        message: 'Für den Landkreis Harz wird keine GloFAS-Abflussreihe angeboten: Das globale Raster ist für kleine Harzbäche nicht verlässlich. Regionale GloFAS-Rasterpunkte sind in der Sachsen-Anhalt-Ansicht verfügbar; ihre Gewässerzuordnung ist ungeprüft.',
      };
      return {
        generatedAt: new Date(generated).toISOString(), region, horizonHours: 72,
        locations: selected.map((location) => rainfall(location, weather.data?.series.get(location.id), generated)),
        riverForecasts: river ? RIVER_FORECAST_LOCATIONS.map((location) => riverForecast(location, river.data?.series.get(location.id), generated)) : [],
        provider: provider(weather, 'weather', FORECAST_LOCATIONS.length), riverProvider, methodology,
      };
    },
  };
}
