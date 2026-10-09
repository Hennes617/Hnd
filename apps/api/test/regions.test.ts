import { describe, expect, it } from 'vitest';
import {
  isHarzDistrict, isSaxonyAnhalt, pointInGeometry, pointInRegion,
  REGION_BOUNDARIES, REGIONS, type RegionGeometry,
  riverInRegion, reservoirInRegion,
} from '../../../packages/shared/src/regions.js';

describe('administrative region membership', () => {
  it.each([
    ['Halberstadt', 51.895, 11.053], ['Wernigerode', 51.835, 10.787],
    ['Quedlinburg', 51.79, 11.141], ['Thale', 51.748, 11.041],
  ])('includes %s in Landkreis Harz and Sachsen-Anhalt', (_name, lat, lon) => {
    expect(isHarzDistrict(Number(lat), Number(lon))).toBe(true);
    expect(isSaxonyAnhalt(Number(lat), Number(lon))).toBe(true);
  });

  it.each([
    ['Goslar', 51.905, 10.428], ['Osterode', 51.727, 10.25],
    ['Nordhausen', 51.502, 10.791], ['Sangerhausen', 51.472, 11.296],
    ['Magdeburg', 52.12, 11.627],
  ])('does not confuse %s with Landkreis Harz', (_name, lat, lon) => {
    expect(isHarzDistrict(Number(lat), Number(lon))).toBe(false);
  });

  it.each([
    ['Sangerhausen', 51.472, 11.296], ['Magdeburg', 52.12, 11.627],
    ['Halle', 51.483, 11.97], ['Dessau-Roßlau', 51.838, 12.245],
    ['Stendal', 52.606, 11.858],
  ])('includes %s in Sachsen-Anhalt', (_name, lat, lon) => {
    expect(isSaxonyAnhalt(Number(lat), Number(lon))).toBe(true);
    expect(pointInRegion(Number(lat), Number(lon), 'sachsen-anhalt')).toBe(true);
  });

  it.each([[51.05, 13.74], [52.52, 13.4], [51.502, 10.791], [51.905, 10.428]])(
    'excludes neighbouring states at %s, %s', (lat, lon) => {
      expect(isSaxonyAnhalt(lat, lon)).toBe(false);
    },
  );

  it('retains national provider boundary stations but rejects invalid coordinates', () => {
    expect(pointInRegion(50.02, 6.11, 'germany')).toBe(true);
    for (const [lat, lon] of [[NaN, 11], [51, Infinity], [91, 11], [51, -181]]) {
      expect(pointInRegion(lat, lon, 'germany')).toBe(false);
      expect(isHarzDistrict(lat, lon)).toBe(false);
    }
  });

  it('ships distinct attributed features rather than rectangles for the two administrative levels', () => {
    expect(REGION_BOUNDARIES.features.map((f) => f.properties.ags).sort()).toEqual(['15', '15085']);
    for (const feature of REGION_BOUNDARIES.features) {
      expect(feature.properties.attribution).toContain('BKG');
      expect(JSON.stringify(feature.geometry).length).toBeGreaterThan(1000);
    }
    expect(REGIONS.harz.label).toBe('Landkreis Harz');
    expect(REGIONS['sachsen-anhalt'].bounds).toHaveLength(4);
  });

  it('includes a river crossing a region even when its sparse route has no internal waypoint', () => {
    const river = { source: { name: 'West', lat: 51.9, lon: 9.5 },
      mouth: { name: 'Ost', lat: 51.9, lon: 13.5 }, route: [] };
    expect(riverInRegion(river, 'harz')).toBe(true);
    expect(riverInRegion(river, 'sachsen-anhalt')).toBe(true);
    const elsewhere = { source: { name: 'Goslar', lat: 51.905, lon: 10.428 },
      mouth: { name: 'Braunschweig', lat: 52.269, lon: 10.526 }, route: [] };
    expect(riverInRegion(elsewhere, 'harz')).toBe(false);
    expect(riverInRegion(elsewhere, 'sachsen-anhalt')).toBe(false);
    expect(riverInRegion(elsewhere, 'germany')).toBe(true);
  });

  it('assigns reservoirs by location, not a historical Harz-mountain catalog label', () => {
    expect(reservoirInRegion({ lat: 51.742, lon: 10.893 }, 'harz')).toBe(true);
    expect(reservoirInRegion({ lat: 51.85, lon: 10.459 }, 'harz')).toBe(false);
    expect(reservoirInRegion({ lat: 51.44, lon: 11.026 }, 'sachsen-anhalt')).toBe(true);
  });
});

describe('polygon topology', () => {
  const geometry: RegionGeometry = { type: 'Polygon', coordinates: [
    [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]],
  ] };

  it('handles holes and includes their boundary, without treating a closing vertex as a full plane', () => {
    expect(pointInGeometry(1, 1, geometry)).toBe(true);
    expect(pointInGeometry(5, 5, geometry)).toBe(false);
    expect(pointInGeometry(5, 3, geometry)).toBe(true);
    expect(pointInGeometry(0, 0, geometry)).toBe(true);
    expect(pointInGeometry(0, 5, geometry)).toBe(true);
    expect(pointInGeometry(11, 5, geometry)).toBe(false);
    expect(pointInGeometry(-1, -1, geometry)).toBe(false);
  });

  it('evaluates every multipolygon component independently', () => {
    const multi: RegionGeometry = { type: 'MultiPolygon', coordinates: [geometry.coordinates,
      [[[20, 20], [21, 20], [21, 21], [20, 21], [20, 20]]],
    ] };
    expect(pointInGeometry(20.5, 20.5, multi)).toBe(true);
    expect(pointInGeometry(15, 15, multi)).toBe(false);
    expect(pointInGeometry(5, 5, multi)).toBe(false);
  });
});
