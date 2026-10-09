import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

// Exercise the built artifact, including prefix-only node:sqlite imports.
const reservation = createServer();
reservation.listen(0, "127.0.0.1");
await once(reservation, "listening");
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const child = spawn(process.execPath, ["apps/api/dist/server.js"], {
  env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", DB_PATH: ":memory:", UPSTREAM_TIMEOUT_MS: "500" },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stdout.on("data", (data) => { output = (output + data).slice(-8000); });
child.stderr.on("data", (data) => { output = (output + data).slice(-8000); });
const exited = once(child, "exit");
try {
  let health;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { health = await response.json(); break; }
    } catch { /* The process is still starting. */ }
    await delay(100);
  }
  assert.equal(health?.status, "ok", `Built API did not start:\n${output}`);
  assert.equal(health.storage.kind, "sqlite");
  assert.equal(health.storage.schemaVersion, 1);
  const docs = await fetch(`http://127.0.0.1:${port}/docs`);
  assert.equal(docs.status, 200);
  assert.match(docs.headers.get("content-type") || "", /text\/html/);
  console.log("Built API starts with SQLite; health and documentation respond successfully.");
} finally {
  child.kill("SIGTERM");
  const timer = setTimeout(() => child.kill("SIGKILL"), 15_000);
  timer.unref();
  await exited;
  clearTimeout(timer);
}
