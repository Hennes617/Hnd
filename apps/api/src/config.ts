export interface Config {
  port: number;
  host: string;
  corsOrigins: string[] | "*";
  upstreamTimeoutMs: number;
  cacheTtlMs: number;
  databasePath?: string;
  observationRetentionDays?: number;
  refreshIntervalMs?: number;
}
function integer(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`Invalid ${name}`);
  return value;
}
export function readConfig(): Config {
  const cors = process.env.CORS_ORIGIN?.trim() || "*";
  return {
    port: integer("PORT", 3001, 1, 65535),
    host: process.env.HOST || "0.0.0.0",
    corsOrigins:
      cors === "*"
        ? "*"
        : cors
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
    upstreamTimeoutMs: integer("UPSTREAM_TIMEOUT_MS", 8000, 500, 30000),
    cacheTtlMs: integer("CACHE_TTL_SECONDS", 300, 30, 3600) * 1000,
    databasePath: process.env.DB_PATH?.trim() || "./data/hnd.sqlite",
    observationRetentionDays: integer("OBSERVATION_RETENTION_DAYS", 90, 7, 3650),
    refreshIntervalMs: integer("REFRESH_INTERVAL_SECONDS", 300, 30, 3600) * 1000,
  };
}
