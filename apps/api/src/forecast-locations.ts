import type { ForecastLocation } from '@hnd/shared';

/** Representative places, not an area-wide rainfall or catchment grid. */
export const FORECAST_LOCATIONS: ForecastLocation[] = [
  { id: 'wernigerode', name: 'Wernigerode', latitude: 51.8368, longitude: 10.7856, district: 'Landkreis Harz' },
  { id: 'quedlinburg', name: 'Quedlinburg', latitude: 51.7903, longitude: 11.1463, district: 'Landkreis Harz' },
  { id: 'halberstadt', name: 'Halberstadt', latitude: 51.8950, longitude: 11.0469, district: 'Landkreis Harz' },
  { id: 'harzgerode', name: 'Harzgerode', latitude: 51.6415, longitude: 11.1410, district: 'Landkreis Harz' },
  { id: 'benneckenstein', name: 'Benneckenstein', latitude: 51.6688, longitude: 10.7156, district: 'Landkreis Harz' },
  { id: 'magdeburg', name: 'Magdeburg', latitude: 52.1205, longitude: 11.6276, district: 'Magdeburg' },
  { id: 'halle', name: 'Halle (Saale)', latitude: 51.4825, longitude: 11.9705, district: 'Halle (Saale)' },
  { id: 'dessau', name: 'Dessau-Roßlau', latitude: 51.8386, longitude: 12.2455, district: 'Dessau-Roßlau' },
  { id: 'stendal', name: 'Stendal', latitude: 52.6069, longitude: 11.8587, district: 'Landkreis Stendal' },
  { id: 'salzwedel', name: 'Salzwedel', latitude: 52.8525, longitude: 11.1518, district: 'Altmarkkreis Salzwedel' },
  { id: 'sangerhausen', name: 'Sangerhausen', latitude: 51.4733, longitude: 11.3002, district: 'Mansfeld-Südharz' },
  { id: 'naumburg', name: 'Naumburg (Saale)', latitude: 51.1519, longitude: 11.8097, district: 'Burgenlandkreis' },
  { id: 'wittenberg', name: 'Lutherstadt Wittenberg', latitude: 51.8669, longitude: 12.6467, district: 'Landkreis Wittenberg' },
  { id: 'bernburg', name: 'Bernburg (Saale)', latitude: 51.8008, longitude: 11.7380, district: 'Salzlandkreis' },
];

/** Regional model queries only. River-network membership has not been validated. */
export const RIVER_FORECAST_LOCATIONS = [
  { id: 'glofas-magdeburg', name: 'GloFAS-Modellpunkt Raum Magdeburg', water: 'GloFAS-Raster', latitude: 52.130, longitude: 11.645 },
  { id: 'glofas-halle', name: 'GloFAS-Modellpunkt Raum Halle', water: 'GloFAS-Raster', latitude: 51.485, longitude: 11.960 },
];
