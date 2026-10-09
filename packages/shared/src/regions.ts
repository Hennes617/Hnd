import boundaryData from './data/administrative-boundaries.json' with { type: 'json' };
import type { Region } from './index.js';
import type { River, Reservoir } from './catalog.js';

export type Position = [longitude: number, latitude: number];
export type RegionGeometry =
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] };

export interface RegionBoundary {
  type: 'Feature';
  id: 'harz' | 'sachsen-anhalt';
  properties: {
    id: 'harz' | 'sachsen-anhalt'; name: string; ags: string;
    source: string; dataYear: string; simplificationMeters: number;
    attribution: string; license: string; licenseUrl: string;
  };
  geometry: RegionGeometry;
}

/** Published BKG administrative geometry, not hand-drawn extents. See docs/regions.md. */
export const REGION_BOUNDARIES = boundaryData as unknown as {
  type: 'FeatureCollection'; features: RegionBoundary[];
};

export interface RegionDefinition {
  id: Region; label: string; shortLabel: string;
  center: Position; bounds: [west: number, south: number, east: number, north: number];
  zoom: number;
}

/** Bounds control the camera only. Geographic membership uses the polygons below. */
export const REGIONS: Record<Region, RegionDefinition> = {
  'sachsen-anhalt': {
    id: 'sachsen-anhalt', label: 'Sachsen-Anhalt', shortLabel: 'Sachsen-Anhalt',
    center: [11.67, 51.97], bounds: [10.56, 50.93, 13.19, 53.05], zoom: 7.3,
  },
  harz: {
    id: 'harz', label: 'Landkreis Harz', shortLabel: 'Landkreis Harz',
    center: [10.985, 51.812], bounds: [10.56, 51.56, 11.41, 52.06], zoom: 9,
  },
  germany: {
    id: 'germany', label: 'Deutschland', shortLabel: 'Deutschland',
    center: [10.45, 51.15], bounds: [5.86, 47.27, 15.04, 55.1], zoom: 5.5,
  },
};

const boundaries = Object.fromEntries(REGION_BOUNDARIES.features.map((f) => [f.id, f.geometry]));

function validCoordinate(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

/** -1 outside, 0 on an edge, 1 inside. The closing duplicate vertex is harmless. */
function ringLocation(longitude: number, latitude: number, ring: Position[]): -1 | 0 | 1 {
  if (ring.length < 4) return -1;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const dx = xj - xi;
    const dy = yj - yi;
    const epsilon = 1e-10;
    const cross = (longitude - xi) * dy - (latitude - yi) * dx;
    if (Math.abs(cross) <= epsilon * Math.max(1, Math.abs(dx) + Math.abs(dy))
      && longitude >= Math.min(xi, xj) - epsilon && longitude <= Math.max(xi, xj) + epsilon
      && latitude >= Math.min(yi, yj) - epsilon && latitude <= Math.max(yi, yj) + epsilon) return 0;
    if ((yi > latitude) !== (yj > latitude)
      && longitude < dx * (latitude - yi) / dy + xi) inside = !inside;
  }
  return inside ? 1 : -1;
}

function inPolygon(latitude: number, longitude: number, rings: Position[][]): boolean {
  if (!rings.length) return false;
  const outer = ringLocation(longitude, latitude, rings[0]);
  if (outer === -1) return false;
  if (outer === 0) return true;
  for (const hole of rings.slice(1)) {
    const location = ringLocation(longitude, latitude, hole);
    if (location === 0) return true;
    if (location === 1) return false;
  }
  return true;
}

/** Polygon/MultiPolygon containment, including boundary edges and respecting holes. */
export function pointInGeometry(latitude: number, longitude: number, geometry: RegionGeometry): boolean {
  if (!validCoordinate(latitude, longitude)) return false;
  return geometry.type === 'Polygon'
    ? inPolygon(latitude, longitude, geometry.coordinates)
    : geometry.coordinates.some((rings) => inPolygon(latitude, longitude, rings));
}

export function isHarzDistrict(latitude: number, longitude: number): boolean {
  return pointInGeometry(latitude, longitude, boundaries.harz);
}

export function isSaxonyAnhalt(latitude: number, longitude: number): boolean {
  return pointInGeometry(latitude, longitude, boundaries['sachsen-anhalt']);
}

/** Germany deliberately keeps the complete national provider catalog, including boundary gauges. */
export function pointInRegion(latitude: number, longitude: number, region: Region): boolean {
  if (!validCoordinate(latitude, longitude)) return false;
  if (region === 'germany') return true;
  if (region === 'harz') return isHarzDistrict(latitude, longitude);
  if (region === 'sachsen-anhalt') return isSaxonyAnhalt(latitude, longitude);
  return false;
}

function segmentsIntersect(a: Position, b: Position, c: Position, d: Position): boolean {
  const epsilon = 1e-10;
  if (Math.max(a[0], b[0]) < Math.min(c[0], d[0]) - epsilon
    || Math.max(c[0], d[0]) < Math.min(a[0], b[0]) - epsilon
    || Math.max(a[1], b[1]) < Math.min(c[1], d[1]) - epsilon
    || Math.max(c[1], d[1]) < Math.min(a[1], b[1]) - epsilon) return false;
  const side = (p: Position, q: Position, r: Position): number => {
    const cross = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    return Math.abs(cross) < epsilon ? 0 : Math.sign(cross);
  };
  return side(a, b, c) * side(a, b, d) <= 0 && side(c, d, a) * side(c, d, b) <= 0;
}

/** A catalog river belongs if a documented route point or connecting segment intersects the region.
 * Route lines are approximate catalog geometry, not a surveyed river course or catchment.
 */
export function riverInRegion(river: Pick<River, 'source' | 'mouth' | 'route'>, region: Region): boolean {
  if (region === 'germany') return true;
  if (region !== 'harz' && region !== 'sachsen-anhalt') return false;
  const points = [river.source, ...river.route, river.mouth];
  if (points.some((p) => pointInRegion(p.lat, p.lon, region))) return true;
  const geometry = boundaries[region];
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    if (!validCoordinate(from.lat, from.lon) || !validCoordinate(to.lat, to.lon)) continue;
    const a: Position = [from.lon, from.lat];
    const b: Position = [to.lon, to.lat];
    for (const polygon of polygons) for (const ring of polygon) {
      for (let j = 1; j < ring.length; j++) {
        if (segmentsIntersect(a, b, ring[j - 1], ring[j])) return true;
      }
    }
  }
  return false;
}

export function reservoirInRegion(reservoir: Pick<Reservoir, 'lat' | 'lon'>, region: Region): boolean {
  return region === 'germany' || pointInRegion(reservoir.lat, reservoir.lon, region);
}
