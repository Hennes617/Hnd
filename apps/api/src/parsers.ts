import { isHarzDistrict, isSaxonyAnhalt } from "@hnd/shared";
import type { FloodWarning, Measurement, Region, Station } from "@hnd/shared";
export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export const string = (value: unknown): string =>
  typeof value === "string" ? value : "";
export function number(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  )
    return null;
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(",", "."))
        : NaN;
  return Number.isFinite(n) ? n : null;
}
export function iso(value: unknown): string | null {
  const valueString = string(value);
  if (!valueString || !Number.isFinite(Date.parse(valueString))) return null;
  return new Date(valueString).toISOString();
}
export function plainText(value: unknown): string {
  return string(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
/** Region identifiers follow administrative boundaries, never the wider mountain range. */
export function regionForPoint(latitude: number, longitude: number): Region {
  return isHarzDistrict(latitude, longitude)
    ? "harz"
    : isSaxonyAnhalt(latitude, longitude)
      ? "sachsen-anhalt"
      : "germany";
}
/** Applied only to official CAP area descriptions, not headlines or explanatory prose. */
export const isHarzText = (text: string): boolean =>
  /(?:^|\b)(?:(?:Landkreis|Kreis)\s+Harz|Halberstadt|Quedlinburg|Wernigerode|Thale|Ilsenburg|Osterwieck|Harzgerode|Ballenstedt|Nordharz|Oberharz am Brocken|Falkenstein[ /]Harz|Ditfurt|Hedersleben|Selke[- ]?Aue|Wegeleben|Schwanebeck|Groß Quenstedt|Huy)(?:\b|$)/i.test(
    text,
  ) || /^(?:Harz|Blankenburg \(Harz\))$/i.test(text.trim());
const isSaxonyAnhaltArea = (text: string): boolean =>
  /(?:^|[\s,;(])(?:Sachsen[- ]Anhalt|Magdeburg|Halle\s*\(?Saale\)?|Dessau[- ]Roßlau|Dessau[- ]Rosslau|Altmarkkreis Salzwedel|Anhalt[- ]Bitterfeld|Börde|Burgenlandkreis|Jerichower Land|Mansfeld[- ]Südharz|Mansfeld[- ]Suedharz|Saalekreis|Salzlandkreis|Stendal|Wittenberg)(?:$|[\s,;()])/i.test(
    text,
  );
const isEntireSaxonyAnhaltArea = (text: string): boolean =>
  /^(?:(?:Land|Bundesland) )?Sachsen[- ]Anhalt(?: \(gesamt\)| landesweit)?$/i.test(
    text.trim(),
  );
export function freshness(
  measurement: Measurement | null,
  now = Date.now(),
): Station["freshness"] {
  return !measurement
    ? "unavailable"
    : now - Date.parse(measurement.timestamp) > 2 * 60 * 60 * 1000 ||
        Date.parse(measurement.timestamp) > now + 5 * 60_000
      ? "stale"
      : "current";
}
function parseMeasurement(value: unknown, unit: string): Measurement | null {
  const item = record(value);
  const timestamp = iso(item.timestamp);
  const amount = number(item.value);
  return timestamp && amount !== null
    ? { timestamp, value: amount, unit }
    : null;
}
export function parsePegelStations(
  payload: unknown,
  now = Date.now(),
): Station[] {
  if (!Array.isArray(payload))
    throw new Error("Unexpected PEGELONLINE station format");
  const result: Station[] = [];
  for (const raw of payload) {
    const item = record(raw);
    const lat = number(item.latitude);
    const lon = number(item.longitude);
    const id = string(item.uuid);
    const name = string(item.longname) || string(item.shortname);
    if (
      !/^[a-zA-Z0-9-]{1,80}$/.test(id) ||
      !name ||
      lat === null ||
      lon === null ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    )
      continue;
    const timeseries = Array.isArray(item.timeseries)
      ? item.timeseries.map(record)
      : [];
    const w = timeseries.find((t) => t.shortname === "W");
    const q = timeseries.find((t) => t.shortname === "Q");
    const measurement = w
      ? parseMeasurement(w.currentMeasurement, string(w.unit) || "cm")
      : null;
    const discharge = q
      ? parseMeasurement(q.currentMeasurement, string(q.unit) || "m³/s")
      : null;
    result.push({
      id,
      name,
      water:
        string(record(item.water).longname) ||
        string(record(item.water).shortname),
      latitude: lat,
      longitude: lon,
      agency: "WSV · PEGELONLINE",
      sourceUrl: `https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations/${encodeURIComponent(id)}.json`,
      region: regionForPoint(lat, lon),
      measurement,
      discharge,
      freshness: freshness(measurement, now),
    });
  }
  if (payload.length > 0 && result.length === 0)
    throw new Error("No valid PEGELONLINE stations in response");
  return result;
}
export function parsePegelHistory(
  payload: unknown,
  unit = "cm",
): Measurement[] {
  if (!Array.isArray(payload)) throw new Error("Unexpected measurement format");
  return payload
    .map((value) => parseMeasurement(value, unit))
    .filter((item): item is Measurement => item !== null)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
export function parseKistersHistory(
  payload: unknown,
  defaultUnit = "cm",
): Measurement[] {
  if (!Array.isArray(payload))
    throw new Error("Unexpected LHW measurement format");
  const series = payload.map(record).find((item) => Array.isArray(item.data));
  if (!series) throw new Error("No LHW time series");
  const unit =
    string(series.ts_unitsymbol) ||
    string(series.unitsymbol) ||
    string(series.unit) ||
    defaultUnit;
  return (series.data as unknown[])
    .flatMap((raw) => {
      if (!Array.isArray(raw)) return [];
      const timestamp = iso(raw[0]);
      const value = number(raw[1]);
      return timestamp && value !== null ? [{ timestamp, value, unit }] : [];
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
export interface WarningReference {
  id: string;
  title: string;
  severity: string;
  sentAt: string | null;
}
export function parseWarningReferences(payload: unknown): WarningReference[] {
  if (!Array.isArray(payload))
    throw new Error("Unexpected NINA warning format");
  return payload.flatMap((raw) => {
    const item = record(raw);
    const id = string(item.id);
    if (/cancel|test/i.test(string(item.type))) return [];
    if (!/^[a-zA-Z0-9._-]{1,180}$/.test(id))
      throw new Error("Invalid warning reference");
    return [
      {
        id,
        title: plainText(record(item.i18nTitle).de),
        severity: string(item.severity),
        sentAt: iso(item.startDate),
      },
    ];
  });
}
export function parseWarning(
  payload: unknown,
  reference: WarningReference,
  now = Date.now(),
): FloodWarning | null {
  const item = record(payload);
  if (
    /cancel/i.test(string(item.msgType)) ||
    (item.status && item.status !== "Actual")
  )
    return null;
  const infos = Array.isArray(item.info) ? item.info.map(record) : [];
  const info =
    infos.find((i) => string(i.language).startsWith("de")) || infos[0];
  if (!info) throw new Error("Missing warning details");
  const sentAt = iso(item.sent) || reference.sentAt;
  if (!sentAt) throw new Error("Missing warning timestamp");
  const expiresAt = iso(info.expires);
  if (expiresAt && Date.parse(expiresAt) <= now) return null;
  const effective = iso(info.effective);
  if (effective && Date.parse(effective) > now) return null;
  const title = plainText(info.headline) || reference.title;
  const description = plainText(info.description);
  const areas = Array.isArray(info.area) ? info.area.map(record) : [];
  const area =
    areas
      .map((a) => plainText(a.areaDesc))
      .filter(Boolean)
      .join(", ") || "Gebiet laut amtlicher Meldung";
  const severity = (string(info.severity) || reference.severity).toLowerCase();
  const areaNames = areas.map((a) => plainText(a.areaDesc));
  const codes = areas.flatMap((a) =>
    Array.isArray(a.geocode)
      ? a.geocode
          .map((g) => string(record(g).value))
          .filter((code) => /^\d{2,12}$/.test(code))
      : [],
  );
  const districtHarz = codes.some((code) => /^15085(?:\d*)$/.test(code));
  const entireSaxonyAnhalt =
    codes.some((code) => /^15(?:0*)$/.test(code)) ||
    areaNames.some(isEntireSaxonyAnhaltArea);
  const saxonyAnhalt =
    codes.some((code) => /^15\d*$/.test(code)) ||
    areaNames.some(isSaxonyAnhaltArea);
  // 'harz' means this alert applies inside Landkreis Harz, including an explicitly statewide alert.
  const region: Region =
    districtHarz || entireSaxonyAnhalt || areaNames.some(isHarzText)
      ? "harz"
      : saxonyAnhalt
        ? "sachsen-anhalt"
        : "germany";
  return {
    id: reference.id,
    title,
    description,
    sentAt,
    expiresAt,
    area,
    severity: ["extreme", "severe", "moderate", "minor"].includes(severity)
      ? (severity as FloodWarning["severity"])
      : "unknown",
    source:
      plainText(info.senderName) ||
      "Länderübergreifendes Hochwasserportal via NINA",
    sourceUrl: `https://warnung.bund.de/meldungen/${encodeURIComponent(reference.id)}`,
    region,
    instruction: plainText(info.instruction) || undefined,
  };
}
/** LHP local timestamps are Europe/Berlin. Ambiguous/invalid DST times stay unknown. */
export function berlinTimestamp(value: unknown): string | undefined {
  const text = string(value);
  if (/Z$|[+-]\d\d:\d\d$/.test(text)) return iso(text) || undefined;
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(text)) return undefined;
  const canonical = text.replace(" ", "T");
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const candidates = ["+01:00", "+02:00"]
    .map((offset) => new Date(`${canonical}${offset}`))
    .filter(
      (date) =>
        Number.isFinite(date.getTime()) &&
        formatter.format(date).replace(" ", "T") === canonical,
    );
  return candidates.length === 1 ? candidates[0].toISOString() : undefined;
}
export function parseLhpStations(
  payload: unknown,
  now = Date.now(),
): Station[] {
  const collection = record(payload);
  if (
    collection.type !== "FeatureCollection" ||
    collection.status !== "success" ||
    !Array.isArray(collection.features)
  )
    throw new Error("Unexpected LHP station format");
  const labels = [
    "Kein Hochwasser",
    "Kleines Hochwasser",
    "Mittleres Hochwasser",
    "Großes Hochwasser",
    "Sehr großes Hochwasser",
  ];
  const stations = collection.features.flatMap((raw) => {
    const feature = record(raw);
    const props = record(feature.properties);
    const geometry = record(feature.geometry);
    const coords = Array.isArray(geometry.coordinates)
      ? geometry.coordinates
      : [];
    const lon = number(coords[0]);
    const lat = number(coords[1]);
    const id = string(feature.id);
    const name = string(props.name);
    if (
      geometry.type !== "Point" ||
      !/^[a-zA-Z0-9_.-]{1,80}$/.test(id) ||
      !name ||
      lon === null ||
      lat === null ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    )
      return [];
    const warningLevel = number(props.lhpClass);
    const warningTimestamp = berlinTimestamp(props.timestamp);
    const statusCurrent =
      warningTimestamp &&
      now - Date.parse(warningTimestamp) <= 2 * 60 * 60_000 &&
      Date.parse(warningTimestamp) <= now + 5 * 60_000;
    const validLevel =
      statusCurrent &&
      warningLevel !== null &&
      Number.isInteger(warningLevel) &&
      warningLevel >= -1 &&
      warningLevel <= 4;
    const url = string(props.stationLink);
    return [
      {
        id,
        name,
        water: string(props.water),
        latitude: lat,
        longitude: lon,
        agency: `LHP · ${string(props.stateId).replace("DE-", "")}`,
        sourceUrl: /^https?:\/\//.test(url)
          ? url
          : "https://www.hochwasserzentralen.de/",
        region: regionForPoint(lat, lon),
        measurement: null,
        discharge: null,
        freshness: "unavailable" as const,
        ...(validLevel
          ? {
              warningLevel,
              warningLabel:
                warningLevel === -1
                  ? "Derzeit keine Daten"
                  : labels[warningLevel],
              warningSource: "Länderübergreifendes Hochwasserportal",
              warningTimestamp,
            }
          : {}),
      },
    ];
  });
  if (collection.features.length > 0 && stations.length === 0)
    throw new Error("No valid LHP stations in response");
  return stations;
}
