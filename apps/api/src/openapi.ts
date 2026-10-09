/** Public base origin for generated clients; reject credentials and non-HTTP URLs. */
export function publicApiOrigin(value = process.env.API_PUBLIC_URL): string {
  if (!value) return "/";
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return "/";
    return url.origin;
  } catch {
    return "/";
  }
}
const regionParameter = {
  name: "region",
  in: "query",
  required: false,
  schema: {
    type: "string",
    enum: ["harz", "sachsen-anhalt", "germany"],
    default: "sachsen-anhalt",
  },
};
const idParameter = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string", pattern: "^[a-zA-Z0-9_.-]{1,80}$" },
};
const json = (schema: unknown) => ({
  description:
    "OK. Providerzustände beachten: HTTP 200 garantiert keine aktuellen Quelldaten.",
  content: { "application/json": { schema } },
});
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const object = (
  properties: Record<string, unknown>,
  required: string[] = [],
) => ({ type: "object", properties, ...(required.length ? { required } : {}) });
const array = (items: unknown) => ({ type: "array", items });
const str = { type: "string" };
const num = { type: "number" };
const errors = {
  "400": { ...json(ref("Error")), description: "Ungültige Parameter (INVALID_REQUEST)." },
  "404": { ...json(ref("Error")), description: "Endpunkt oder Standort unbekannt. Bekannte Pegel ohne Beobachtungen liefern eine leere Zeitreihe mit HTTP 200." },
  "429": {
    ...json(ref("Error")),
    description: "Ratenlimit überschritten (120/min und Quell-IP). Zeitversetzt erneut versuchen.",
    headers: { "Retry-After": { description: "Sekunden bis zu einem erneuten Versuch", schema: { type: "integer" } } },
  },
  "500": { ...json(ref("Error")), description: "Interner Fehler (INTERNAL_ERROR)." },
};
export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "HND Open Water API",
    version: "1.0.0",
    description:
      "Kostenlose, schlüssellose API. Deutschlandweite Pegelmetadaten und Hochwasserwarnungen; Sachsen-Anhalt ist die Standardansicht, harz bezeichnet ausschließlich den Landkreis Harz. Keine amtliche Warnplattform. Keine vollständige Datenabdeckung. Lizenzbedingungen der jeweiligen Quellen gelten.",
  },
  servers: [
    {
      url: publicApiOrigin(),
      description:
        "Öffentliche API-Instanz (API_PUBLIC_URL oder aktueller Ursprung)",
    },
  ],
  paths: {
    "/health": {
      get: {
        summary: "API Liveness (keine Upstream-Readiness)",
        responses: {
          "200": json(
            object({
              status: { const: "ok" }, service: str, uptime: num,
              storage: object({
                kind: { const: "sqlite" },
                schemaVersion: { type: "integer" },
                observations: { type: "integer", description: "Anzahl gespeicherter Beobachtungen; keine Aussage über aktuelle Quellenverfügbarkeit." },
                lastObservationAt: { type: ["string", "null"], format: "date-time" },
              }),
            }),
          ),
        },
      },
    },
    "/api/v1/overview": {
      get: {
        summary: "Gesamtansicht mit expliziter Datenverfügbarkeit",
        parameters: [regionParameter],
        responses: { "200": json(ref("Snapshot")), ...errors },
      },
    },
    "/api/v1/stations": {
      get: {
        summary: "Pegelstandorte und verfügbare Messwerte",
        parameters: [
          regionParameter,
          {
            name: "search",
            in: "query",
            schema: { type: "string", maxLength: 120 },
          },
        ],
        responses: {
          "200": json(
            object({
              stations: array(ref("Station")),
              total: num,
              providers: array(ref("ProviderState")),
              generatedAt: str,
            }),
          ),
          ...errors,
        },
      },
    },
    "/api/v1/stations/{id}": {
      get: {
        summary: "Ein Pegelstandort",
        parameters: [idParameter],
        responses: { "200": json(ref("Station")), ...errors },
      },
    },
    "/api/v1/stations/{id}/history": {
      get: {
        summary: "Verfügbare Wasserstandsreihe und lokal gesammelte Beobachtungen",
        description: "Originalzeitreihe, soweit integriert, ergänzt um echte lokal gespeicherte Beobachtungen. Umfang hängt von Quelle und Betriebsdauer ab; keine künstliche Historie. Bekannte Pegel ohne Beobachtungen liefern HTTP 200, measurements: [] und provider.state: unavailable. Nur unbekannte Pegel liefern HTTP 404. Zeitstempel, Einheiten und Providerzustand beachten.",
        parameters: [idParameter],
        responses: {
          "200": json(
            object({
              stationId: str,
              parameter: { const: "W" },
              measurements: array(ref("Measurement")),
              provider: ref("ProviderState"),
            }),
          ),
          ...errors,
        },
      },
    },
    "/api/v1/warnings": {
      get: {
        summary: "LHP-Hochwasserwarnungen via NINA",
        parameters: [regionParameter],
        responses: {
          "200": json(
            object({
              warnings: array(ref("Warning")),
              providers: array(ref("ProviderState")),
              generatedAt: str,
            }),
          ),
          ...errors,
        },
      },
    },
    "/api/v1/forecast": {
      get: {
        summary:
          "72-Stunden-Niederschlagsprognose und modellierter täglicher GloFAS-Abfluss",
        description:
          "Open-Meteo-Modellprognosen an ausgewählten Orten. Die Niederschlagseinschätzung ist eine transparente Heuristik und keine amtliche Hochwasserwarnung. GloFAS-Tageswerte sind Modellwerte und keine Pegelmessungen; grobe Modellauflösung kann von lokalen Gewässern abweichen. Providerzustände und Vollständigkeit beachten.",
        parameters: [regionParameter],
        responses: { "200": json(ref("ForecastSnapshot")), ...errors },
      },
    },
    "/api/v1/rivers": {
      get: {
        summary:
          "Regional gefilterte Flüsse; vollständige schematische Verläufe",
        parameters: [regionParameter],
        responses: { "200": json(object({ rivers: array(ref("River")) })) },
      },
    },
    "/api/v1/reservoirs": {
      get: {
        summary:
          "Regional gefilterte Talsperren mit verfügbaren Betreiber-Messwerten",
        description: "telemetry enthält ausschließlich tatsächlich verfügbare Betriebsdaten. Bauliche capacityMillionM3 und aktueller Stauinhalt sind unterschiedliche Größen. Fehlende Felder bedeuten unbekannte Werte, nicht null Kubikmeter oder Entwarnung.",
        parameters: [regionParameter],
        responses: {
          "200": json(object({ reservoirs: array(ref("Reservoir")), providers: array(ref("ProviderState")), generatedAt: { type: "string", format: "date-time" } })),
          ...errors,
        },
      },
    },
    "/api/v1/sources": {
      get: {
        summary: "Quellenverzeichnis",
        responses: { "200": json(object({ sources: array(ref("Source")) })) },
      },
    },
  },
  components: {
    schemas: {
      ForecastLocation: object({
        id: str,
        name: str,
        latitude: num,
        longitude: num,
        district: str,
      }),
      ForecastHour: object({
        timestamp: { type: "string", format: "date-time" },
        precipitationMm: { type: ["number", "null"] },
        rainMm: { type: ["number", "null"] },
        probabilityPercent: { type: ["number", "null"] },
      }),
      RainfallForecast: object({
        location: ref("ForecastLocation"),
        hourly: array(ref("ForecastHour")),
        totals: object({
          next24hMm: { type: ["number", "null"] },
          next72hMm: { type: ["number", "null"] },
          max1hMm: { type: ["number", "null"] },
          max6hMm: { type: ["number", "null"] },
        }),
        rainfallClass: {
          type: "string",
          enum: ["low", "elevated", "high", "unknown"],
        },
        completeness: {
          type: "string",
          enum: ["complete", "partial", "unavailable"],
        },
        explanation: str,
      }),
      RiverForecast: object({
        id: str,
        name: str,
        water: str,
        latitude: num,
        longitude: num,
        model: str,
        daily: array(
          object({
            timestamp: str,
            dischargeM3s: { type: ["number", "null"] },
          }),
        ),
        note: str,
      }),
      ForecastSnapshot: object({
        generatedAt: { type: "string", format: "date-time" },
        region: { type: "string", enum: ["harz", "sachsen-anhalt", "germany"] },
        horizonHours: { const: 72 },
        locations: array(ref("RainfallForecast")),
        riverForecasts: array(ref("RiverForecast")),
        provider: ref("ProviderState"),
        riverProvider: ref("ProviderState"),
        methodology: object({
          version: str,
          description: str,
          thresholds: str,
          limitations: array(str),
          sources: array(object({ name: str, url: str })),
        }),
      }),
      Measurement: object(
        {
          timestamp: { type: "string", format: "date-time" },
          value: num,
          unit: str,
        },
        ["timestamp", "value", "unit"],
      ),
      ProviderState: object(
        {
          id: str,
          name: str,
          state: {
            type: "string",
            enum: ["live", "cached", "unavailable", "reference"],
          },
          fetchedAt: { type: ["string", "null"], format: "date-time" },
          stale: { type: "boolean" },
          dataUpdatedAt: { type: "string", format: "date-time" },
          message: str,
          url: str,
        },
        ["id", "name", "state", "fetchedAt", "message", "url"],
      ),
      Station: object(
        {
          id: str,
          name: str,
          water: str,
          latitude: num,
          longitude: num,
          agency: str,
          sourceUrl: str,
          region: str,
          measurement: { anyOf: [ref("Measurement"), { type: "null" }] },
          discharge: { anyOf: [ref("Measurement"), { type: "null" }] },
          freshness: {
            type: "string",
            enum: ["current", "stale", "unavailable"],
          },
          note: str,
          warningLevel: { type: "integer", minimum: -1, maximum: 4 },
          warningLabel: str,
          warningSource: str,
          warningTimestamp: str,
          historyAvailable: { type: "boolean", description: "Eine integrierte Originalreihe oder echte lokal gespeicherte Beobachtungen sind verfügbar." },
          measurementSourceId: { type: "string", description: "Quellstations-ID für den zugeordneten Messwert und seine Originalzeitreihe, z. B. eine PEGELONLINE-UUID; nicht automatisch Quelle der Warnklasse." },
          sourceStationNumber: { type: "string", description: "Unveränderte Original-Pegelnummer der Quelle." },
        },
        [
          "id",
          "name",
          "water",
          "latitude",
          "longitude",
          "agency",
          "sourceUrl",
          "region",
          "measurement",
          "discharge",
          "freshness",
        ],
      ),
      Warning: object(
        {
          id: str,
          title: str,
          description: str,
          severity: {
            type: "string",
            enum: ["extreme", "severe", "moderate", "minor", "unknown"],
          },
          source: str,
          sourceUrl: str,
          sentAt: str,
          expiresAt: { type: ["string", "null"] },
          area: str,
          region: str,
          instruction: str,
        },
        [
          "id",
          "title",
          "severity",
          "source",
          "sourceUrl",
          "sentAt",
          "expiresAt",
          "area",
          "region",
        ],
      ),
      GeoPoint: object({ name: str, lat: num, lon: num }, [
        "name",
        "lat",
        "lon",
      ]),
      River: object({
        id: str,
        name: str,
        lengthKm: num,
        researchVerified: { type: "boolean" },
        basin: str,
        region: array(str),
        source: ref("GeoPoint"),
        mouth: ref("GeoPoint"),
        route: array(ref("GeoPoint")),
        reservoirIds: array(str),
        sourceIds: array(str),
        description: str,
        geometryAccuracy: { const: "approximate" },
      }),
      Reservoir: object({
        id: str,
        name: str,
        capacityMillionM3: num,
        verifiedFields: array({
          type: "string",
          enum: ["name", "operator", "capacityMillionM3"],
        }),
        verifiedAt: { type: "string", format: "date" },
        researchVerified: { type: "boolean" },
        riverId: str,
        type: str,
        operator: str,
        region: array(str),
        lat: num,
        lon: num,
        sourceIds: array(str),
        description: str,
        geometryAccuracy: { const: "approximate" },
        telemetry: ref("ReservoirTelemetry"),
      }),
      ReservoirTelemetry: object({
        storage: { ...ref("Measurement"), description: "Beobachteter Stauinhalt in Mio. m³; keine bauliche Kapazität." },
        level: { ...ref("Measurement"), description: "Beobachteter Wasserstand in der Originaleinheit der Betreiberquelle." },
        inflow: { ...ref("Measurement"), description: "Zufluss in m³/s." },
        outflow: { ...ref("Measurement"), description: "Abgabe in m³/s." },
        fillPercent: { ...ref("Measurement"), description: "Füllanteil in %, nur bei belegter Bezugsgröße; keine Hochwasserklasse." },
        freshness: { type: "string", enum: ["current", "stale", "unavailable"] },
        sourceUrl: { type: "string", format: "uri" },
        sourceName: str,
        note: str,
      }, ["freshness", "sourceUrl", "sourceName"]),
      Error: object({ error: object({ code: str, message: str }, ["code", "message"]) }, ["error"]),
      Source: object({
        id: str,
        name: str,
        operator: str,
        url: str,
        kind: str,
        coverage: array(str),
        access: str,
        researchVerified: { type: "boolean" },
        verifiedAt: { type: "string", format: "date" },
      }),
      Snapshot: object({
        generatedAt: str,
        region: { type: "string", enum: ["harz", "sachsen-anhalt", "germany"] },
        stations: array(ref("Station")),
        rivers: array(ref("River")),
        reservoirs: array(ref("Reservoir")),
        warnings: array(ref("Warning")),
        sources: array(ref("Source")),
        providers: array(ref("ProviderState")),
        coverage: object({
          stations: str,
          warnings: str,
          geography: str,
          complete: { const: false },
        }),
      }),
    },
  },
};
