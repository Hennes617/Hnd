import type { Measurement, Station } from "@hnd/shared";
import { freshness, iso, number, record, regionForPoint, string } from "./parsers.js";

// This is the common public access key published by NLWKN in its Webservice Benutzerhandbuch,
// not a private application credential. Required attribution: www.pegelonline.nlwkn.niedersachsen.de.
export const NLWKN_PUBLIC_KEY = "9dc05f4e3b4a43a9988d747825b39f43";
export const NLWKN_URL = `https://bis.azure-api.net/PegelonlinePublic/REST/stammdaten/stationen/All?key=${NLWKN_PUBLIC_KEY}`;
export const NLWKN_SOURCE = "https://www.pegelonline.nlwkn.niedersachsen.de/";
export const nlwknHistoryUrl = (id: string) => `https://bis.azure-api.net/PegelonlinePublic/REST/station/${encodeURIComponent(id)}/datenspuren/parameter/1/tage/-7?key=${NLWKN_PUBLIC_KEY}`;
export interface NlwknStation { station: Station; measurements: Measurement[] }

function timestamp(value: unknown): string | null {
  const match = string(value).match(/^\/Date\((-?\d+)\)\/$/);
  if (!match) return iso(value);
  const amount = Number(match[1]);
  return Number.isFinite(amount) && Math.abs(amount) <= 8.64e15 ? new Date(amount).toISOString() : null;
}
function waterSeries(item: Record<string, unknown>): Record<string, unknown> | undefined {
  const parameters = Array.isArray(item.Parameter) ? item.Parameter.map(record) : [];
  const water = parameters.find(p => number(p.PAT_ID) === 1);
  const traces = Array.isArray(water?.Datenspuren) ? water.Datenspuren.map(record) : [];
  // Select observed gauge water level, excluding storage volumes and forecasts, even when listed first.
  return traces.find(t => t.IstWasserstand === true && t.IstVorhersage === false && t.IstSpeicherV !== true);
}
function measurements(trace: Record<string, unknown>): Measurement[] {
  const unit = string(trace.ParameterEinheit);
  if (unit !== "cm" && unit !== "m") return [];
  const points = [...(Array.isArray(trace.Pegelstaende) ? trace.Pegelstaende : []), trace.AktuellerPegelstand];
  const valid = points.flatMap(raw => {
    const item = record(raw);
    // Datum uses an inconsistent offset in this service; DatumUTC is the authoritative UTC field.
    const date = timestamp(item.DatumUTC);
    const value = number(item.Wert);
    return date && value !== null && value !== -888 ? [{ timestamp: date, value, unit }] : [];
  });
  return [...new Map(valid.map(m => [m.timestamp, m])).values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
export function parseNlwknHistory(payload: unknown): Measurement[] {
  const station = record(record(payload).getPegelDatenspurenResult);
  const trace = waterSeries(station);
  if (!trace) throw new Error("No observed NLWKN water-level series");
  return measurements(trace);
}
export function parseNlwknStations(payload: unknown, now = Date.now()): NlwknStation[] {
  const items = record(payload).getStammdatenResult;
  if (!Array.isArray(items)) throw new Error("Unexpected NLWKN stations format");
  const parsed = items.flatMap(raw => {
    const item = record(raw);
    const stationNo = string(item.STA_Nummer);
    const internalId = number(item.STA_ID);
    const name = string(item.Name);
    const trace = waterSeries(item);
    const x = number(item.Latitude), y = number(item.Longitude);
    if (!/^\d{1,12}$/.test(stationNo) || internalId === null || !Number.isInteger(internalId) || internalId < 1 || !name || x === null || y === null || !trace) return [];
    // NLWKN's live payload (verified 2026-10-09) transposes its field names. Also accept corrected axes.
    const latitude = x >= 45 && x <= 56 ? x : y;
    const longitude = x >= 45 && x <= 56 ? y : x;
    if (latitude < 45 || latitude > 56 || longitude < 5 || longitude > 16) return [];
    const history = measurements(trace);
    const measurement = history.at(-1) || null;
    return [{ station: {
      id: `NI_${stationNo}`, name, water: string(item.GewaesserName), latitude, longitude,
      agency: string(item.Betreiber) || "NLWKN Niedersachsen",
      sourceUrl: `${NLWKN_SOURCE}Pegel/Karte/${item.IstTide ? "Tideaußenpegel" : "Binnenpegel"}/ID/${internalId}`,
      sourceStationNumber: stationNo, measurementSourceId: `nlwkn-${internalId}`, historyAvailable: true,
      region: regionForPoint(latitude, longitude), measurement, discharge: null, freshness: freshness(measurement, now),
      note: "NLWKN · ungeprüfte Rohdaten. Landesmeldestufen werden nicht in bundesweite LHP-Warnklassen umgerechnet.",
    }, measurements: history }];
  });
  if (items.length && !parsed.length) throw new Error("No valid NLWKN stations");
  return parsed;
}
