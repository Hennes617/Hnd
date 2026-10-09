import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Measurement, Reservoir, Station } from "@hnd/shared";
import { AsyncCache } from "./cache.js";

/** Single-instance, local observations and restart-safe provider cache. */
export class WaterStore {
  private readonly db: DatabaseSync;
  private closed = false;
  private lastPruned = 0;

  constructor(path: string, private readonly retentionDays = 90, private readonly now = Date.now) {
    if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    const version = Number(this.db.prepare("PRAGMA user_version").get()?.user_version || 0);
    if (version > 1) {
      this.db.close();
      throw new Error("Database schema is newer than this API supports");
    }
    if (version < 1) this.db.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE provider_cache (
        cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, fetched_at TEXT NOT NULL
      );
      CREATE TABLE stations (
        id TEXT PRIMARY KEY, metadata TEXT NOT NULL, seen_at TEXT NOT NULL
      );
      CREATE TABLE reservoirs (
        id TEXT PRIMARY KEY, metadata TEXT NOT NULL, seen_at TEXT NOT NULL
      );
      CREATE TABLE observations (
        entity_id TEXT NOT NULL, parameter TEXT NOT NULL, timestamp TEXT NOT NULL,
        value REAL NOT NULL, unit TEXT NOT NULL, recorded_at TEXT NOT NULL,
        PRIMARY KEY (entity_id, parameter, timestamp, unit)
      );
      CREATE INDEX observations_time ON observations(timestamp);
      PRAGMA user_version = 1;
      COMMIT;
    `);
    this.prune();
  }

  cache<T>(key: string, ttlMs: number, staleMs: number): AsyncCache<T> {
    return new AsyncCache<T>(ttlMs, staleMs, this.now, 30_000, {
      read: () => {
        const row = this.db.prepare("SELECT payload, fetched_at FROM provider_cache WHERE cache_key = ?").get(key);
        if (!row) return null;
        try { return { data: JSON.parse(String(row.payload)) as T, fetchedAt: String(row.fetched_at) }; }
        catch { return null; }
      },
      write: (data, fetchedAt) => {
        if (this.closed) return;
        this.db.prepare(`INSERT INTO provider_cache(cache_key,payload,fetched_at) VALUES(?,?,?)
          ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at`)
          .run(key, JSON.stringify(data), fetchedAt);
      },
    });
  }

  private transaction(work: () => void) {
    if (this.closed) return;
    this.db.exec("BEGIN IMMEDIATE");
    try { work(); this.db.exec("COMMIT"); }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
    this.prune();
  }

  private insertMeasurements(id: string, parameter: string, measurements: Measurement[]) {
    const insert = this.db.prepare(`INSERT INTO observations(entity_id,parameter,timestamp,value,unit,recorded_at)
      VALUES(?,?,?,?,?,?) ON CONFLICT(entity_id,parameter,timestamp,unit) DO UPDATE SET value=excluded.value`);
    const now = this.now();
    const cutoff = now - this.retentionDays * 86_400_000;
    const recordedAt = new Date(now).toISOString();
    for (const measurement of measurements) {
      const timestamp = Date.parse(measurement.timestamp);
      if (!Number.isFinite(measurement.value) || !Number.isFinite(timestamp) || timestamp < cutoff ||
        timestamp > now + 10 * 60_000 || !measurement.unit) continue;
      insert.run(id, parameter, new Date(timestamp).toISOString(), measurement.value, measurement.unit, recordedAt);
    }
  }

  saveStations(stations: Station[]) {
    this.transaction(() => {
      const upsert = this.db.prepare(`INSERT INTO stations(id,metadata,seen_at) VALUES(?,?,?)
        ON CONFLICT(id) DO UPDATE SET metadata=excluded.metadata,seen_at=excluded.seen_at`);
      const seenAt = new Date(this.now()).toISOString();
      for (const station of stations) {
        upsert.run(station.id, JSON.stringify(station), seenAt);
        if (station.measurement) this.insertMeasurements(station.id, "W", [station.measurement]);
        if (station.discharge) this.insertMeasurements(station.id, "Q", [station.discharge]);
      }
    });
  }

  saveHistory(stationId: string, measurements: Measurement[]) {
    this.transaction(() => this.insertMeasurements(stationId, "W", measurements));
  }

  history(stationId: string, days = 7): Measurement[] {
    const since = new Date(this.now() - Math.min(days, this.retentionDays) * 86_400_000).toISOString();
    return this.db.prepare(`SELECT timestamp,value,unit FROM observations
      WHERE entity_id=? AND parameter='W' AND timestamp>=? ORDER BY timestamp`).all(stationId, since)
      .map((row) => ({ timestamp: String(row.timestamp), value: Number(row.value), unit: String(row.unit) }));
  }

  station(id: string): Station | null {
    const row = this.db.prepare("SELECT metadata FROM stations WHERE id=?").get(id);
    return row ? JSON.parse(String(row.metadata)) as Station : null;
  }

  stations(): Station[] {
    return this.db.prepare("SELECT metadata FROM stations ORDER BY id").all()
      .map((row) => JSON.parse(String(row.metadata)) as Station);
  }

  saveReservoirs(reservoirs: Reservoir[]) {
    this.transaction(() => {
      const upsert = this.db.prepare(`INSERT INTO reservoirs(id,metadata,seen_at) VALUES(?,?,?)
        ON CONFLICT(id) DO UPDATE SET metadata=excluded.metadata,seen_at=excluded.seen_at`);
      const seenAt = new Date(this.now()).toISOString();
      for (const reservoir of reservoirs) {
        upsert.run(reservoir.id, JSON.stringify(reservoir), seenAt);
        for (const parameter of ["storage", "level", "inflow", "outflow"] as const) {
          const measurement = reservoir.telemetry?.[parameter];
          if (measurement) this.insertMeasurements(`reservoir:${reservoir.id}`, parameter, [measurement]);
        }
      }
    });
  }

  private prune() {
    const now = this.now();
    if (this.lastPruned && now - this.lastPruned < 60 * 60_000) return;
    const cutoff = new Date(now - this.retentionDays * 86_400_000).toISOString();
    this.db.prepare("DELETE FROM observations WHERE timestamp < ?").run(cutoff);
    this.db.prepare("DELETE FROM provider_cache WHERE fetched_at < ?").run(new Date(now - 8 * 86_400_000).toISOString());
    this.lastPruned = now;
  }

  status() {
    const row = this.db.prepare("SELECT COUNT(*) AS count, MAX(timestamp) AS last FROM observations").get()!;
    return { kind: "sqlite", schemaVersion: 1, observations: Number(row.count), lastObservationAt: row.last || null };
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.db.close();
  }
}
