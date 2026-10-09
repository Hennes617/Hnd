import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../src/app.js";

const apps: FastifyInstance[] = [];
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});
describe("API database integration", () => {
  it("collects without a browser and retains observations across application restart", async () => {
    const directory = mkdtempSync(join(tmpdir(), "hnd-api-db-"));
    directories.push(directory);
    const config = {
      port: 0, host: "127.0.0.1", corsOrigins: "*" as const,
      cacheTtlMs: 300_000, upstreamTimeoutMs: 500,
      databasePath: join(directory, "hnd.sqlite"),
      refreshIntervalMs: 300_000, observationRetentionDays: 90,
    };
    const timestamp = new Date().toISOString();
    const app = await createApp({ logger: false, config, fetchJson: async (url) => {
      if (url.includes("pegelonline.wsv.de") && url.includes("includeTimeseries")) return [{
        uuid: "fixture-wsv", longname: "Storage fixture", latitude: 52.12, longitude: 11.62,
        water: { longname: "Elbe" },
        timeseries: [{ shortname: "W", unit: "cm", currentMeasurement: { timestamp, value: 102 } }],
      }];
      throw new Error("Other providers unavailable in fixture");
    } });
    apps.push(app);
    await app.listen({ port: 0, host: "127.0.0.1" });
    await expect.poll(async () => (await app.inject("/health")).json().storage.observations)
      .toBeGreaterThan(0);
    await app.close();
    const restarted = await createApp({ logger: false, config, fetchJson: async () => { throw new Error("offline"); } });
    apps.push(restarted);
    const overview = (await restarted.inject("/api/v1/overview?region=germany")).json();
    expect(overview.stations.find((s: {id: string}) => s.id === "fixture-wsv").measurement.value).toBe(102);
    expect(overview.providers.find((p: {id: string}) => p.id === "pegelonline").state).toBe("cached");
    const history = await restarted.inject("/api/v1/stations/fixture-wsv/history");
    expect(history.statusCode).toBe(200);
    expect(history.json().measurements).toContainEqual({ timestamp, value: 102, unit: "cm" });
    expect(history.json().provider.state).not.toBe("live");
  });
});
