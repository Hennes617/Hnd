import { describe, expect, it } from "vitest";
import { parseNlwknHistory, parseNlwknStations } from "../src/nlwkn.js";

const now = Date.parse("2026-10-09T12:00:00Z");
const trace = {
  IstWasserstand: true, IstVorhersage: false, ParameterEinheit: "cm",
  AktuellerPegelstand: { DatumUTC: "2026-10-09T11:45:00Z", Datum: "2026-10-09T14:45:00+02:00", Wert: 0 },
  Pegelstaende: [
    { DatumUTC: "2026-10-09T11:00:00Z", Wert: -888 },
    { DatumUTC: "2026-10-09T11:15:00Z", Wert: -4 },
    { DatumUTC: "2026-10-09T11:30:00Z", Wert: "  " },
  ],
};
const station = { STA_Nummer: "12345", STA_ID: 486, Name: "Testpegel", GewaesserName: "Leine", Latitude: "9.76", Longitude: "52.13", Parameter: [{ PAT_ID: 1, Datenspuren: [{ ...trace, IstVorhersage: true }, trace] }] };
describe("NLWKN adapter", () => {
  it("fixes the provider's transposed coordinate fields and excludes forecasts and missing-value sentinels", () => {
    const [result] = parseNlwknStations({ getStammdatenResult: [station] }, now);
    expect(result.station).toMatchObject({ id: "NI_12345", latitude: 52.13, longitude: 9.76, historyAvailable: true, measurementSourceId: "nlwkn-486", freshness: "current" });
    expect(result.station.measurement).toEqual({ timestamp: "2026-10-09T11:45:00.000Z", value: 0, unit: "cm" });
    expect(result.station.warningLevel).toBeUndefined();
    expect(result.measurements.map(m => m.value)).toEqual([-4, 0]);
  });
  it("also accepts corrected axes and parses the documented week endpoint's WCF UTC timestamp", () => {
    expect(parseNlwknStations({ getStammdatenResult: [{ ...station, Latitude: 52.13, Longitude: 9.76 }] }, now)[0].station.latitude).toBe(52.13);
    const series = parseNlwknHistory({ getPegelDatenspurenResult: { Parameter: [{ PAT_ID: 1, Datenspuren: [{ ...trace, Pegelstaende: [], AktuellerPegelstand: { DatumUTC: `/Date(${now})/`, Wert: 42 } }] }] } });
    expect(series).toEqual([{ timestamp: "2026-10-09T12:00:00.000Z", value: 42, unit: "cm" }]);
  });
  it("rejects a changed or unavailable upstream format", () => {
    expect(() => parseNlwknStations({ stations: [] }, now)).toThrow();
    expect(() => parseNlwknHistory({ getPegelDatenspurenResult: {} })).toThrow();
  });
});
