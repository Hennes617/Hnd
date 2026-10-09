import { describe, expect, it } from "vitest";
import { parseHwwReservoir, parseTsbReservoirs } from "../src/reservoirs.js";

// Synthetic fixtures exercise the schemas inspected on the official operator sites.
const now = Date.parse("2026-10-09T12:00:00Z");
describe("reservoir observations", () => {
  it("uses fixed MEZ for HWW even during daylight saving, and calculates only documented capacity ratios", () => {
    const item = parseHwwReservoir({ datum: "09.10.2026 12:30:00", stauinhalt: "6,635", zufluss: "0", abgabe: "0.047" }, 13.27, now);
    expect(item.storage).toEqual({ timestamp: "2026-10-09T11:30:00.000Z", value: 6.635, unit: "Mio. m³" });
    expect(item.fillPercent?.value).toBe(50);
    expect(item.inflow?.value).toBe(0);
    expect(item.freshness).toBe("current");
    expect(parseHwwReservoir({ datum: "09.10.2026 12:30:00", stauinhalt: "6.635" }, undefined, now).fillPercent).toBeUndefined();
  });
  it("never converts blank or missing reservoir data to zero", () => {
    expect(() => parseHwwReservoir({ datum: "09.10.2026 12:30:00", stauinhalt: "  " }, 13, now)).toThrow();
    expect(() => parseHwwReservoir({ datum: "n/a", stauinhalt: 10 }, 13, now)).toThrow();
  });
  it("keeps TSB flow-only observations, including real zero, without inventing storage or a filling percentage", () => {
    const result = parseTsbReservoirs([{ metadata_station_no: "575404", L4_label: "Zuflussmenge", L4_timestamp: "2026-10-09T12:00:00+02:00", L4_ts_unitsymbol: "m³/s", L4_ts_value: 0 }], now).kelbra;
    expect(result.inflow?.value).toBe(0);
    expect(result.storage).toBeUndefined();
    expect(result.fillPercent).toBeUndefined();
    expect(result.freshness).toBe("current");
    expect(result.note).toContain("keinen Beckeninhalt");
  });
  it("does not rejuvenate old storage through a fresh inflow or accept a changed unit silently", () => {
    const result = parseTsbReservoirs([{ metadata_station_no: "579430",
      L1_label: "Beckeninhalt", L1_ts_unitsymbol: "hm³", L1_ts_value: 12, L1_timestamp: "2026-10-01T12:00:00+02:00",
      L4_label: "Zuflussmenge", L4_ts_unitsymbol: "m³/s", L4_ts_value: 1, L4_timestamp: "2026-10-09T12:00:00+02:00",
      L2_label: "Beckenpegel", L2_ts_unitsymbol: "cm", L2_ts_value: 100, L2_timestamp: "2026-10-09T12:00:00+02:00",
    }], now).rappbode;
    expect(result.freshness).toBe("stale");
    expect(result.storage?.timestamp).toBe("2026-10-01T10:00:00.000Z");
    expect(result.level).toBeUndefined();
  });
});
