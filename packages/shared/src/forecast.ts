import type { ProviderState, Region } from './index.js';
export interface ForecastLocation { id: string; name: string; latitude: number; longitude: number; district: string; }
export interface ForecastHour { timestamp: string; precipitationMm: number | null; rainMm: number | null; probabilityPercent: number | null; }
export interface RainfallForecast {
  location: ForecastLocation; hourly: ForecastHour[];
  totals: { next24hMm: number | null; next72hMm: number | null; max1hMm: number | null; max6hMm: number | null };
  rainfallClass: 'low' | 'elevated' | 'high' | 'unknown';
  completeness: 'complete' | 'partial' | 'unavailable';
  explanation: string;
}
export interface RiverForecast {
  id: string; name: string; water: string; latitude: number; longitude: number;
  model: string; daily: { timestamp: string; dischargeM3s: number | null }[];
  note: string;
}
export interface ForecastSnapshot {
  generatedAt: string; region: Region; horizonHours: 72;
  locations: RainfallForecast[]; riverForecasts: RiverForecast[];
  provider: ProviderState; riverProvider: ProviderState;
  methodology: { version: string; description: string; thresholds: string; limitations: string[]; sources: { name: string; url: string }[] };
}
