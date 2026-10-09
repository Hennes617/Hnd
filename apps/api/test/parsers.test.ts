import { describe, expect, it } from "vitest";
import {
  berlinTimestamp,
  freshness,
  isHarzText,
  regionForPoint,
  parseKistersHistory,
  parseLhpStations,
  parsePegelStations,
  parseWarning,
  parseWarningReferences,
} from "../src/parsers.js";
// All values below are synthetic parser fixtures, never production data.
const now = Date.parse("2026-10-09T10:00:00Z");
const lhp = (
  timestamp: unknown = "2026-10-09 12:00:00",
  level: unknown = 0,
) => ({
  type: "FeatureCollection",
  status: "success",
  features: [
    {
      id: "ST_579020",
      geometry: { type: "Point", coordinates: [11.047, 51.749] },
      properties: {
        name: "Fixture Thale",
        water: "Bode",
        timestamp,
        lhpClass: level,
        stateId: "DE-ST",
      },
    },
  ],
});
const ref = {
  id: "lhp.test-synthetic",
  title: "Hochwasserwarnung",
  severity: "Severe",
  sentAt: "2026-10-09T09:00:00Z",
};
const warning = (area = "Landkreis Harz") => ({
  status: "Actual",
  msgType: "Alert",
  sent: "2026-10-09T09:00:00Z",
  info: [
    {
      language: "de-DE",
      headline: "Hochwasserwarnung",
      severity: "Severe",
      expires: "2026-10-09T12:00:00Z",
      description: "<p>Bitte <b>vorsichtig</b> sein.</p>",
      area: [{ areaDesc: area }],
    },
  ],
});
describe("measurements and LHP classification", () => {
  it("retains numeric zero and never treats missing measurements as zero", () => {
    const fixture = [
      {
        uuid: "fixture-uuid",
        longname: "Fixture",
        latitude: 51.5,
        longitude: 11,
        water: { longname: "Bode" },
        timeseries: [
          {
            shortname: "W",
            unit: "cm",
            currentMeasurement: { timestamp: "2026-10-09T09:55:00Z", value: 0 },
          },
          {
            shortname: "Q",
            unit: "m³/s",
            currentMeasurement: {
              timestamp: "2026-10-09T09:55:00Z",
              value: null,
            },
          },
        ],
      },
    ];
    const [station] = parsePegelStations(fixture, now);
    expect(station.measurement?.value).toBe(0);
    expect(station.discharge).toBeNull();
    expect(station.freshness).toBe("current");
  });
  it("marks old or future measurements stale", () => {
    expect(
      freshness(
        { timestamp: "2026-10-09T06:00:00Z", unit: "cm", value: 1 },
        now,
      ),
    ).toBe("stale");
    expect(
      freshness(
        { timestamp: "2027-10-09T06:00:00Z", unit: "cm", value: 1 },
        now,
      ),
    ).toBe("stale");
    expect(freshness(null, now)).toBe("unavailable");
  });
  it("parses LHP coordinates without inventing numerical water levels", () => {
    const [station] = parseLhpStations(lhp(), now);
    expect(station).toMatchObject({
      id: "ST_579020",
      latitude: 51.749,
      longitude: 11.047,
      measurement: null,
      freshness: "unavailable",
      warningLevel: 0,
      warningTimestamp: "2026-10-09T10:00:00.000Z",
    });
  });
  it("preserves official station identifiers containing dots", () => {
    const fixture = lhp();
    fixture.features[0].id = "TH_42000.1";
    expect(parseLhpStations(fixture, now)[0].id).toBe("TH_42000.1");
  });
  it("removes unknown or stale official classifications, including old all-clear", () => {
    expect(
      parseLhpStations(lhp("2026-10-08 12:00:00"), now)[0].warningLevel,
    ).toBeUndefined();
    expect(
      parseLhpStations(lhp(undefined, null), now)[0].warningLevel,
    ).toBeUndefined();
    expect(
      parseLhpStations(lhp("invalid"), now)[0].warningLevel,
    ).toBeUndefined();
    expect(
      parseLhpStations(lhp("2026-10-09 12:00:00", 99), now)[0].warningLevel,
    ).toBeUndefined();
  });
  it("rejects malformed nonempty station collections", () => {
    expect(() =>
      parseLhpStations(
        { type: "FeatureCollection", status: "success", features: [{}] },
        now,
      ),
    ).toThrow();
    expect(() => parsePegelStations([{}], now)).toThrow();
  });
  it("converts Berlin timestamps with DST and leaves ambiguous/nonexistent times unknown", () => {
    expect(berlinTimestamp("2026-01-09 12:00:00")).toBe(
      "2026-01-09T11:00:00.000Z",
    );
    expect(berlinTimestamp("2026-10-25 02:30:00")).toBeUndefined();
    expect(berlinTimestamp("2026-03-29 02:30:00")).toBeUndefined();
  });
  it("reads KISTERS numeric strings and discards missing values", () => {
    expect(
      parseKistersHistory([
        {
          ts_unitsymbol: "cm",
          data: [
            ["2026-10-09T09:00:00Z", "12,5"],
            ["2026-10-09T10:00:00Z", null],
          ],
        },
      ]),
    ).toEqual([
      { timestamp: "2026-10-09T09:00:00.000Z", value: 12.5, unit: "cm" },
    ]);
  });
});
describe("flood warnings", () => {
  it("does not accept malformed warning feeds as a successful all-clear", () => {
    expect(() => parseWarningReferences({})).toThrow();
    expect(() => parseWarningReferences([{}])).toThrow();
    expect(parseWarningReferences([])).toEqual([]);
    expect(
      parseWarningReferences([{ id: "cancel-1", type: "Cancel" }]),
    ).toEqual([]);
    expect(() =>
      parseWarningReferences([{ id: "../../private", type: "Alert" }]),
    ).toThrow();
  });
  it("reads actual active warnings and returns plain text", () => {
    expect(parseWarning(warning(), ref, now)).toMatchObject({
      severity: "severe",
      region: "harz",
      description: "Bitte vorsichtig sein.",
    });
  });
  it("excludes expired, test, and cancelled warnings", () => {
    expect(parseWarning(warning(), ref, now + 3 * 60 * 60_000)).toBeNull();
    expect(parseWarning({ ...warning(), status: "Test" }, ref, now)).toBeNull();
    expect(
      parseWarning({ ...warning(), msgType: "Cancel" }, ref, now),
    ).toBeNull();
  });
  it("includes genuinely statewide alerts whose official area contains the Harz", () => {
    expect(parseWarning(warning("Sachsen-Anhalt"), ref, now)?.region).toBe(
      "harz",
    );
    expect(parseWarning(warning("Niedersachsen"), ref, now)?.region).toBe(
      "germany",
    );
    expect(
      parseWarning(warning("Emden, Niedersachsen"), ref, now)?.region,
    ).toBe("germany");
  });
  it("does not classify all Niedersachsen or Thüringen warnings as Harz", () => {
    expect(isHarzText("Emden, Niedersachsen")).toBe(false);
    expect(isHarzText("Hannover, Niedersachsen")).toBe(false);
    expect(isHarzText("Kleine Überflutung in Emden")).toBe(false);
    expect(isHarzText("Erfurt, Thüringen")).toBe(false);
    expect(isHarzText("Goslar")).toBe(false);
    expect(isHarzText("Nordhausen")).toBe(false);
    expect(isHarzText("Blankenburg, Thüringen")).toBe(false);
    expect(isHarzText("Blankenburg (Harz)")).toBe(true);
    expect(isHarzText("Harzgerode")).toBe(true);
    const data = warning("Emden, Niedersachsen");
    data.info[0].description =
      "Allgemeine Hinweise zum Landkreis Harz auf der Landeswebsite";
    data.info[0].headline = "Hochwasser in Wernigerode: allgemeiner Hinweis";
    expect(parseWarning(data, ref, now)?.region).toBe("germany");
  });
});

describe("administrative region assignment", () => {
  it("keeps the Harz region inside Landkreis Harz, not the entire mountain range", () => {
    expect(regionForPoint(51.8333, 10.7833)).toBe("harz"); // Wernigerode
    expect(regionForPoint(51.895, 11.056)).toBe("harz"); // Halberstadt
    expect(regionForPoint(51.905, 10.429)).toBe("germany"); // Goslar, Niedersachsen
    expect(regionForPoint(51.501, 10.79)).toBe("germany"); // Nordhausen, Thüringen
    expect(regionForPoint(51.4828, 11.9693)).toBe("sachsen-anhalt"); // Halle
  });
  it("uses CAP area codes for district, statewide, and other Saxony-Anhalt warnings", () => {
    const withCode = (code: string) => ({
      ...warning("Amtliches Warngebiet"),
      info: [
        {
          ...warning().info[0],
          area: [
            {
              areaDesc: "Amtliches Warngebiet",
              geocode: [{ valueName: "ARS", value: code }],
            },
          ],
        },
      ],
    });
    expect(parseWarning(withCode("150850000000"), ref, now)?.region).toBe(
      "harz",
    );
    expect(parseWarning(withCode("150000000000"), ref, now)?.region).toBe(
      "harz",
    );
    expect(parseWarning(withCode("150020000000"), ref, now)?.region).toBe(
      "sachsen-anhalt",
    );
    expect(parseWarning(withCode("031530000000"), ref, now)?.region).toBe(
      "germany",
    );
    expect(parseWarning(withCode("160620000000"), ref, now)?.region).toBe(
      "germany",
    );
    expect(parseWarning(warning("Halle (Saale)"), ref, now)?.region).toBe(
      "sachsen-anhalt",
    );
    expect(parseWarning(warning("Halle (Westfalen)"), ref, now)?.region).toBe(
      "germany",
    );
    expect(parseWarning(warning("Wittenberge"), ref, now)?.region).toBe(
      "germany",
    );
  });
});
