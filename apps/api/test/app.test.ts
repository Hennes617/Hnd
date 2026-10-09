import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../src/app.js";
const instances: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(instances.splice(0).map((app) => app.close()));
});
async function app() {
  const instance = await createApp({
    logger: false,
    fetchJson: async () => {
      throw new Error("Offline fixture");
    },
    config: {
      port: 3001,
      host: "127.0.0.1",
      corsOrigins: ["https://water.example"],
      cacheTtlMs: 300_000,
      upstreamTimeoutMs: 8000,
    },
  });
  instances.push(instance);
  return instance;
}
describe("HTTP API", () => {
  it("offers liveness independently of unavailable providers", async () => {
    const api = await app();
    const response = await api.inject("/health");
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("ok");
    const overview = await api.inject("/api/v1/overview");
    expect(overview.json().region).toBe("sachsen-anhalt");
    expect(overview.statusCode).toBe(200);
    expect(
      overview.json().providers.find((p: { id: string }) => p.id === "nina-lhp")
        .state,
    ).toBe("unavailable");
  });
  it("validates regions, limits search, and rejects path traversal", async () => {
    const api = await app();
    expect((await api.inject("/api/v1/overview?region=moon")).statusCode).toBe(
      400,
    );
    expect((await api.inject("/api/v1/forecast?region=moon")).statusCode).toBe(
      400,
    );
    expect((await api.inject("/api/v1/rivers?region=moon")).statusCode).toBe(
      400,
    );
    expect(
      (await api.inject(`/api/v1/stations?search=${"a".repeat(121)}`))
        .statusCode,
    ).toBe(400);
    expect(
      (await api.inject("/api/v1/stations/..%2Fprivate/history")).statusCode,
    ).toBe(400);
  });
  it("serves documented JSON collections, usable docs, and security headers", async () => {
    const api = await app();
    const docs = await api.inject("/docs");
    expect(docs.headers["content-type"]).toContain("text/html");
    expect(docs.headers["content-security-policy"]).toContain(
      "script-src 'none'",
    );
    expect((await api.inject("/openapi.json")).json().openapi).toBe("3.1.0");
    expect(
      (await api.inject("/api/v1/rivers?region=germany")).json().rivers.length,
    ).toBeGreaterThan(20);
    expect(
      (await api.inject("/api/v1/reservoirs?region=germany")).json().reservoirs
        .length,
    ).toBeGreaterThan(10);
    expect((await api.inject("/api/v1/stations/unknown")).statusCode).toBe(404);
    // The dot is part of real state identifiers; a valid but unknown identifier gets 404, not 400.
    expect(
      (await api.inject("/api/v1/stations/TH_42000.1")).statusCode,
    ).not.toBe(400);
    expect(
      (await api.inject("/api/v1/stations/NI_4886101/history")).statusCode,
    ).toBe(404);
  });
  it("serves region-aware forecast results with failed models marked unavailable", async () => {
    const api = await app();
    const response = await api.inject("/api/v1/forecast?region=harz");
    expect(response.statusCode).toBe(200);
    expect(response.json().region).toBe("harz");
    expect(response.json().horizonHours).toBe(72);
    expect(response.json().provider.state).toBe("unavailable");
    expect(response.json().riverProvider.state).toBe("reference");
    expect(response.json().riverForecasts).toEqual([]);
    const statewide = (await api.inject("/api/v1/forecast")).json();
    expect(statewide.region).toBe("sachsen-anhalt");
    expect(statewide.riverProvider.state).toBe("unavailable");
  });
  it("applies explicit allowed origins without granting a disallowed origin", async () => {
    const api = await app();
    const allowed = await api.inject({
      url: "/api/v1/rivers",
      headers: { origin: "https://water.example" },
    });
    const denied = await api.inject({
      url: "/api/v1/rivers",
      headers: { origin: "https://other.example" },
    });
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "https://water.example",
    );
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
