import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import {
  rivers,
  reservoirs,
  sources,
  riverInRegion,
  reservoirInRegion,
} from "@hnd/shared";
import type { Region } from "@hnd/shared";
import { readConfig, type Config } from "./config.js";
import { createDataService, type DataService } from "./service.js";
import { createFetcher, type FetchJson } from "./upstream.js";
import { docsHtml } from "./docs.js";
import { openapi } from "./openapi.js";
import { createForecastService } from "./forecast.js";
const regionQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    region: {
      type: "string",
      enum: ["harz", "sachsen-anhalt", "germany"],
      default: "sachsen-anhalt",
    },
  },
};
const idParams = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "string", pattern: "^[a-zA-Z0-9_.-]{1,80}$" } },
  additionalProperties: false,
};
interface AppOptions {
  config?: Config;
  fetchJson?: FetchJson;
  service?: DataService;
  logger?: boolean;
}
export async function createApp(options: AppOptions = {}) {
  const config = options.config || readConfig();
  // Only trust forwarding headers when explicitly configured by the operator.
  const app = Fastify({
    logger: options.logger ?? true,
    trustProxy: process.env.TRUST_PROXY === "true",
    bodyLimit: 16 * 1024,
    requestTimeout: 30_000,
  });
  const fetchJson =
    options.fetchJson || createFetcher(config.upstreamTimeoutMs);
  const service = options.service || createDataService(fetchJson, config);
  const forecastService = createForecastService(fetchJson);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  });
  await app.register(cors, {
    origin: config.corsOrigins === "*" ? "*" : config.corsOrigins,
    methods: ["GET", "HEAD", "OPTIONS"],
    credentials: false,
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      error: {
        code: "RATE_LIMITED",
        message: "Zu viele Anfragen. Bitte kurz warten.",
      },
    }),
  });
  app.setErrorHandler((error, request, reply) => {
    const code = (error as { statusCode?: number }).statusCode;
    const status = code && code >= 400 && code <= 599 ? code : 500;
    if (status >= 500) request.log.error({ err: error }, "Request failed");
    reply.status(status).send({
      error: {
        code:
          status === 400
            ? "INVALID_REQUEST"
            : status === 429
              ? "RATE_LIMITED"
              : "INTERNAL_ERROR",
        message:
          status === 400
            ? "Ungültige Anfrageparameter."
            : status === 429
              ? "Zu viele Anfragen. Bitte kurz warten."
              : "Die Anfrage konnte nicht verarbeitet werden.",
      },
    });
  });
  app.setNotFoundHandler((_, reply) =>
    reply.status(404).send({
      error: { code: "NOT_FOUND", message: "Endpunkt nicht gefunden." },
    }),
  );
  app.get("/health", { config: { rateLimit: false } }, async () => ({
    status: "ok",
    service: "hnd-api",
    uptime: Math.floor(process.uptime()),
  }));
  app.get("/", async (_, reply) =>
    reply.type("text/html; charset=utf-8").send(docsHtml),
  );
  app.get("/docs", async (_, reply) =>
    reply.type("text/html; charset=utf-8").send(docsHtml),
  );
  app.get("/openapi.json", async () => openapi);
  app.get<{ Querystring: { region?: Region } }>(
    "/api/v1/overview",
    { schema: { querystring: regionQuery } },
    async (request) =>
      service.overview(request.query.region || "sachsen-anhalt"),
  );
  app.get<{ Querystring: { region?: Region; search?: string } }>(
    "/api/v1/stations",
    {
      schema: {
        querystring: {
          ...regionQuery,
          properties: {
            ...regionQuery.properties,
            search: { type: "string", maxLength: 120 },
          },
        },
      },
    },
    async (request) => {
      const snapshot = await service.overview(
        request.query.region || "sachsen-anhalt",
      );
      const search = request.query.search?.trim().toLocaleLowerCase("de") || "";
      const stations = snapshot.stations.filter(
        (s) =>
          !search ||
          `${s.name} ${s.water} ${s.id}`
            .toLocaleLowerCase("de")
            .includes(search),
      );
      return {
        stations,
        total: stations.length,
        providers: snapshot.providers.filter((p) => p.id !== "nina-lhp"),
        generatedAt: snapshot.generatedAt,
      };
    },
  );
  app.get<{ Params: { id: string } }>(
    "/api/v1/stations/:id",
    { schema: { params: idParams } },
    async (request, reply) => {
      const station = await service.station(request.params.id);
      return (
        station ||
        reply.status(404).send({
          error: {
            code: "STATION_NOT_FOUND",
            message: "Pegel nicht gefunden oder aktuell nicht abrufbar.",
          },
        })
      );
    },
  );
  app.get<{ Params: { id: string } }>(
    "/api/v1/stations/:id/history",
    { schema: { params: idParams } },
    async (request, reply) => {
      const history = await service.history(request.params.id);
      return (
        history ||
        reply.status(404).send({
          error: {
            code: "HISTORY_NOT_AVAILABLE",
            message:
              "Für diesen Pegel ist keine integrierte Wasserstandszeitreihe verfügbar.",
          },
        })
      );
    },
  );
  app.get<{ Querystring: { region?: Region } }>(
    "/api/v1/warnings",
    { schema: { querystring: regionQuery } },
    async (request) => {
      const snapshot = await service.overview(
        request.query.region || "sachsen-anhalt",
      );
      return {
        warnings: snapshot.warnings,
        providers: snapshot.providers.filter((p) => p.id === "nina-lhp"),
        generatedAt: snapshot.generatedAt,
      };
    },
  );
  app.get<{ Querystring: { region?: Region } }>(
    "/api/v1/forecast",
    { schema: { querystring: regionQuery } },
    async (request) =>
      forecastService.forecast(request.query.region || "sachsen-anhalt"),
  );
  app.get<{ Querystring: { region?: Region } }>(
    "/api/v1/rivers",
    { schema: { querystring: regionQuery } },
    async (request) => ({
      rivers: rivers.filter((river) =>
        riverInRegion(river, request.query.region || "sachsen-anhalt"),
      ),
    }),
  );
  app.get<{ Querystring: { region?: Region } }>(
    "/api/v1/reservoirs",
    { schema: { querystring: regionQuery } },
    async (request) => ({
      reservoirs: reservoirs.filter((reservoir) =>
        reservoirInRegion(reservoir, request.query.region || "sachsen-anhalt"),
      ),
    }),
  );
  app.get("/api/v1/sources", async () => ({ sources }));
  return app;
}
