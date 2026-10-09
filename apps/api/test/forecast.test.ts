import { describe, expect, it, vi } from 'vitest';
import { createForecastService, FORECAST_URLS } from '../src/forecast.js';
import { FORECAST_LOCATIONS, RIVER_FORECAST_LOCATIONS } from '../src/forecast-locations.js';
import type { FetchJson } from '../src/upstream.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.parse('2026-10-09T09:23:00Z');
const START_HOUR = Math.floor(NOW / HOUR) * HOUR;
const START_DAY = Math.floor(NOW / DAY) * DAY;
function weatherRows(value: number | null = 0.2) {
  return FORECAST_LOCATIONS.map((location, index) => ({
    latitude: location.latitude, longitude: location.longitude, location_id: index + 1,
    utc_offset_seconds: 0,
    hourly_units: { time: 'unixtime', precipitation: 'mm', rain: 'mm', precipitation_probability: '%' },
    hourly: {
      time: Array.from({ length: 74 }, (_, i) => (START_HOUR + i * HOUR) / 1000),
      precipitation: Array.from({ length: 74 }, () => value),
      rain: Array.from({ length: 74 }, () => value),
      precipitation_probability: Array.from({ length: 74 }, () => 35),
    },
  }));
}
function riverRows(value: number | null = 120) {
  return RIVER_FORECAST_LOCATIONS.map((location, index) => ({
    latitude: location.latitude, longitude: location.longitude, location_id: index + 1,
    utc_offset_seconds: 0,
    daily_units: { time: 'unixtime', river_discharge_mean: 'm³/s' },
    daily: {
      time: Array.from({ length: 7 }, (_, i) => (START_DAY + i * DAY) / 1000),
      river_discharge_mean: Array.from({ length: 7 }, () => value),
    },
  }));
}
function fixtures(weather: unknown = weatherRows(), river: unknown = riverRows()): FetchJson {
  return async (url) => new URL(url).hostname === new URL(FORECAST_URLS.weather).hostname ? weather : river;
}
const config = { now: () => NOW };

describe('Open-Meteo forecast orchestration', () => {
  it('requests only two batched providers with explicit one-based location IDs and verified model variables', async () => {
    const fetcher = vi.fn(fixtures());
    const result = await createForecastService(fetcher, config).forecast('sachsen-anhalt');
    expect(fetcher).toHaveBeenCalledTimes(2);
    const weather = new URL(fetcher.mock.calls[0][0]);
    const river = new URL(fetcher.mock.calls[1][0]);
    expect(weather.searchParams.get('forecast_hours')).toBe('74');
    expect(weather.searchParams.get('location_id')).toBe(FORECAST_LOCATIONS.map((_, i) => i + 1).join(','));
    expect(weather.searchParams.get('timeformat')).toBe('unixtime');
    expect(weather.searchParams.get('timezone')).toBe('GMT');
    expect(river.searchParams.get('daily')).toBe('river_discharge_mean');
    expect(river.searchParams.get('models')).toBe('forecast_v4');
    expect(river.searchParams.get('forecast_days')).toBe('7');
    expect(river.searchParams.get('cell_selection')).toBe('nearest');
    expect(result.locations).toHaveLength(14);
    expect(result.locations[0]).toMatchObject({
      completeness: 'complete', rainfallClass: 'low',
      totals: { next24hMm: 4.8, next72hMm: 14.4, max1hMm: 0.2, max6hMm: 1.2 },
    });
    expect(result.riverForecasts[0].daily).toHaveLength(7);
    expect(result.riverForecasts[0].daily[0].dischargeM3s).toBe(120);
    expect(result.provider).toMatchObject({ state: 'live', stale: false, fetchedAt: new Date(NOW).toISOString() });
  });

  it('uses actual Landkreis Harz membership and offers GloFAS only outside the small-stream Harz view', async () => {
    const fetcher = vi.fn(fixtures());
    const service = createForecastService(fetcher, config);
    const harz = await service.forecast('harz');
    expect(harz.locations.map((f) => f.location.id)).toEqual(['wernigerode', 'quedlinburg', 'halberstadt', 'harzgerode', 'benneckenstein']);
    expect(harz.riverForecasts).toEqual([]);
    expect(harz.riverProvider.state).toBe('reference');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const germany = await service.forecast('germany');
    expect(germany.locations).toHaveLength(14);
    expect(germany.methodology.description).toContain('Deutschlandansicht erweitert diese Prognoseabdeckung nicht');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps zero as measured model output and applies transparent rainfall classes independently of probabilities', async () => {
    const dry = await createForecastService(fixtures(weatherRows(0), riverRows(0)), config).forecast('sachsen-anhalt');
    expect(dry.locations[0]).toMatchObject({ rainfallClass: 'low', totals: { next24hMm: 0, next72hMm: 0 } });
    expect(dry.riverForecasts[0].daily[0].dischargeM3s).toBe(0);
    const elevated = await createForecastService(fixtures(weatherRows(0.5)), config).forecast('harz');
    expect(elevated.locations[0].rainfallClass).toBe('elevated');
    const high = await createForecastService(fixtures(weatherRows(2)), config).forecast('harz');
    expect(high.locations[0].rainfallClass).toBe('high');
    expect(high.methodology.limitations.join(' ')).toContain('keine Hochwasserwahrscheinlichkeit');
  });

  it('uses hourly and rolling six-hour thresholds, not just a 24-hour sum', async () => {
    const rows = weatherRows(0);
    rows[0].hourly.precipitation[71] = 16; // Outside the first 24 hours.
    const result = await createForecastService(fixtures(rows), config).forecast('harz');
    expect(result.locations[0]).toMatchObject({ rainfallClass: 'high', totals: { next24hMm: 0, next72hMm: 16, max1hMm: 16, max6hMm: 16 } });
  });

  it('publishes actual model-grid coordinates without inventing an Elbe or Saale river assignment', async () => {
    const rows = riverRows();
    rows[0].latitude = 52.125;
    rows[0].longitude = 11.625015;
    rows[1].latitude = 51.475006;
    rows[1].longitude = 11.975006;
    const result = await createForecastService(fixtures(weatherRows(), rows), config).forecast('sachsen-anhalt');
    expect(result.riverForecasts[0]).toMatchObject({ name: 'GloFAS-Modellpunkt Raum Magdeburg', water: 'GloFAS-Raster', latitude: 52.125, longitude: 11.625015 });
    expect(result.riverForecasts[1]).toMatchObject({ name: 'GloFAS-Modellpunkt Raum Halle', water: 'GloFAS-Raster', latitude: 51.475006, longitude: 11.975006 });
    expect(result.riverForecasts.every((river) => river.note.includes('nicht fachlich validiert') && river.note.includes('zurückgegebene Rasterzelle'))).toBe(true);
    expect(result.riverProvider.message).toContain('nicht fachlich validiert');
  });

  it('never turns a missing, negative, non-finite or implausible precipitation value into zero', async () => {
    const rows = weatherRows(1);
    rows[0].hourly.precipitation[1] = null;
    rows[1].hourly.precipitation[1] = -1;
    rows[2].hourly.precipitation[1] = Number.NaN;
    rows[3].hourly.precipitation[1] = 501;
    rows[4].hourly.precipitation[1] = Number.POSITIVE_INFINITY;
    const result = await createForecastService(fixtures(rows), config).forecast('harz');
    for (const location of result.locations) {
      expect(location.hourly[0].precipitationMm).toBeNull();
      expect(location.rainfallClass).toBe('unknown');
      expect(location.completeness).toBe('partial');
      expect(location.totals).toEqual({ next24hMm: null, next72hMm: null, max1hMm: null, max6hMm: null });
    }
  });

  it('computes each sum only when its entire time window is present', async () => {
    const rows = weatherRows(1);
    rows[0].hourly.precipitation[40] = null;
    rows[1].hourly.time.splice(10, 1);
    rows[1].hourly.precipitation.splice(10, 1);
    rows[1].hourly.rain.splice(10, 1);
    rows[1].hourly.precipitation_probability.splice(10, 1);
    const result = await createForecastService(fixtures(rows), config).forecast('harz');
    expect(result.locations[0].totals).toMatchObject({ next24hMm: 24, next72hMm: null });
    expect(result.locations[1].totals).toMatchObject({ next24hMm: null, next72hMm: null });
    expect(result.locations[1].hourly[9].precipitationMm).toBeNull();
  });

  it('retains null probabilities and rain separately without confusing rain chance with flood risk', async () => {
    const rows = weatherRows(0);
    rows[0].hourly.precipitation_probability[1] = 101;
    rows[0].hourly.rain[1] = -2;
    const result = await createForecastService(fixtures(rows), config).forecast('harz');
    expect(result.locations[0].hourly[0]).toMatchObject({ precipitationMm: 0, rainMm: null, probabilityPercent: null });
    expect(result.locations[0].rainfallClass).toBe('low');
  });

  it('treats every all-null forecast as unavailable at the point even when the source responded successfully', async () => {
    const result = await createForecastService(fixtures(weatherRows(null), riverRows(null)), config).forecast('sachsen-anhalt');
    expect(result.provider.state).toBe('live');
    expect(result.locations.every((f) => f.completeness === 'unavailable' && f.rainfallClass === 'unknown')).toBe(true);
    expect(result.locations.every((f) => f.totals.next72hMm === null)).toBe(true);
    expect(result.riverForecasts.every((f) => f.daily.every((d) => d.dischargeM3s === null))).toBe(true);
  });

  it('maps shuffled responses by explicit ID and rejects ambiguous duplicates or wrongly located rows', async () => {
    const rows = weatherRows(0);
    rows[0].hourly.precipitation = Array.from({ length: 74 }, () => 2);
    rows[1].latitude = 48; // Wrong model location for Quedlinburg.
    const shuffled = [...rows.slice().reverse(), rows[2]];
    const result = await createForecastService(fixtures(shuffled), config).forecast('harz');
    expect(result.locations[0].totals.next72hMm).toBe(144);
    expect(result.locations[1].completeness).toBe('unavailable');
    expect(result.locations[2].completeness).toBe('unavailable');
    expect(result.locations[3].completeness).toBe('complete');
    expect(result.provider.message).toContain('mehrdeutige');
  });

  it('does not assign responses with absent or zero-based IDs to unrelated locations', async () => {
    const rows = weatherRows(1);
    rows[0].location_id = 0;
    const result = await createForecastService(fixtures(rows), config).forecast('harz');
    expect(result.locations[0].completeness).toBe('unavailable');
    expect(result.locations[1].totals.next72hMm).toBe(72);
  });

  it('validates response units, timezone and duplicate time axes', async () => {
    const rows = weatherRows(1);
    rows[0].hourly_units.precipitation = 'inch';
    rows[1].utc_offset_seconds = 3600;
    rows[2].hourly.time[5] = rows[2].hourly.time[4];
    const rivers = riverRows();
    rivers[0].daily_units.river_discharge_mean = 'ft³/s';
    const result = await createForecastService(fixtures(rows, rivers), config).forecast('sachsen-anhalt');
    expect(result.locations.slice(0, 3).every((f) => f.completeness === 'unavailable')).toBe(true);
    expect(result.locations[3].completeness).toBe('complete');
    expect(result.riverForecasts[0].daily.every((p) => p.dischargeM3s === null)).toBe(true);
    expect(result.riverForecasts[1].daily[0].dischargeM3s).toBe(120);
  });

  it('produces exactly 72 future UTC endpoints, including across a cached hour boundary', async () => {
    let now = NOW;
    const fetcher = vi.fn(fixtures());
    const service = createForecastService(fetcher, { now: () => now, cacheTtlMs: HOUR });
    const result = await service.forecast('harz');
    expect(result.locations[0].hourly).toHaveLength(72);
    expect(result.locations[0].hourly[0].timestamp).toBe('2026-10-09T10:00:00.000Z');
    now = Date.parse('2026-10-09T10:00:00Z');
    const cached = await service.forecast('harz');
    expect(cached.locations[0].hourly[0].timestamp).toBe('2026-10-09T11:00:00.000Z');
    expect(cached.locations[0].hourly.every((h) => Date.parse(h.timestamp) > now)).toBe(true);
    expect(cached.locations[0].totals.next72hMm).toBe(14.4);
    expect(cached.provider.state).toBe('cached');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('coalesces simultaneous callers and preserves the source fetch time during caching', async () => {
    const fetcher = vi.fn(fixtures());
    const service = createForecastService(fetcher, config);
    const [a, b] = await Promise.all([service.forecast('harz'), service.forecast('sachsen-anhalt')]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(a.provider.fetchedAt).toEqual(b.provider.fetchedAt);
    const again = await service.forecast('sachsen-anhalt');
    expect(again.provider.state).toBe('cached');
    expect(again.riverProvider.state).toBe('cached');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('marks stale data after an outage and expires it; missing future hours stay unknown', async () => {
    let now = NOW;
    let failed = false;
    const fetcher: FetchJson = async (url) => {
      if (failed) throw new Error('HTTP 503');
      return fixtures()(url);
    };
    const service = createForecastService(fetcher, { now: () => now, cacheTtlMs: 1000 });
    const first = await service.forecast('sachsen-anhalt');
    failed = true;
    now += 2 * HOUR;
    const stale = await service.forecast('sachsen-anhalt');
    expect(stale.provider).toMatchObject({ state: 'cached', stale: true, fetchedAt: first.provider.fetchedAt });
    expect(stale.locations[0]).toMatchObject({ rainfallClass: 'unknown', completeness: 'partial', totals: { next24hMm: 4.8, next72hMm: null } });
    now += 5 * HOUR;
    const expired = await service.forecast('sachsen-anhalt');
    expect(expired.provider.state).toBe('unavailable');
    expect(expired.locations[0].totals.next24hMm).toBeNull();
    expect(expired.riverProvider.state).toBe('unavailable');
  });

  it('isolates weather outages from valid river results and backs off failed sources', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.startsWith(FORECAST_URLS.weather)) throw new Error('HTTP 503');
      return riverRows();
    });
    const service = createForecastService(fetcher, config);
    const result = await service.forecast('sachsen-anhalt');
    expect(result.provider.state).toBe('unavailable');
    expect(result.locations.every((f) => f.rainfallClass === 'unknown')).toBe(true);
    expect(result.riverProvider.state).toBe('live');
    expect(result.riverForecasts[0].daily[0].dischargeM3s).toBe(120);
    await service.forecast('sachsen-anhalt');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('bounds both provider requests to eight seconds even if the fetcher hangs', async () => {
    vi.useFakeTimers();
    try {
      const service = createForecastService(async () => new Promise(() => undefined), config);
      const pending = service.forecast('sachsen-anhalt');
      await vi.advanceTimersByTimeAsync(8001);
      const result = await pending;
      expect(result.provider.state).toBe('unavailable');
      expect(result.riverProvider.state).toBe('unavailable');
      expect(result.locations.every((f) => f.hourly.every((h) => h.precipitationMm === null))).toBe(true);
    } finally { vi.useRealTimers(); }
  });
});
