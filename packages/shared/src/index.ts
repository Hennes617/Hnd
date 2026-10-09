export * from './catalog.js';
import type { River, Reservoir, Source } from './catalog.js';
export type Region = 'harz' | 'sachsen-anhalt' | 'germany';
export interface Measurement { timestamp: string; value: number; unit: string; }
export interface Station {
  id: string; name: string; water: string; latitude: number; longitude: number;
  agency: string; sourceUrl: string; region: string;
  measurement: Measurement | null; discharge: Measurement | null;
  freshness: 'current' | 'stale' | 'unavailable';
  note?: string;
  /** Upstream identity used for water-level histories, never a geographic guess. */
  measurementSourceId?: string;
  sourceStationNumber?: string;
  historyAvailable?: boolean;
  warningLevel?: number; warningLabel?: string; warningSource?: string; warningTimestamp?: string;
}
export interface FloodWarning {
  id: string; title: string; description: string; severity: 'extreme' | 'severe' | 'moderate' | 'minor' | 'unknown';
  source: string; sourceUrl: string; sentAt: string; expiresAt: string | null;
  area: string; region: string; instruction?: string;
}
export interface ProviderState {
  id: string; name: string; state: 'live' | 'cached' | 'unavailable' | 'reference';
  fetchedAt: string | null; message: string; url: string; stale?: boolean; dataUpdatedAt?: string;
}
export interface Snapshot {
  generatedAt: string; region: Region; stations: Station[]; rivers: River[];
  reservoirs: Reservoir[]; warnings: FloodWarning[]; sources: Source[];
  providers: ProviderState[];
  coverage: { stations: string; warnings: string; geography: string; complete: false };
}
export interface StationHistory { stationId: string; parameter: 'W'; measurements: Measurement[]; provider: ProviderState; }
export interface ApiError { error: { code: string; message: string }; }

export * from './forecast.js';
export * from './regions.js';
