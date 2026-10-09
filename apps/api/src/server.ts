import { createApp } from "./app.js";
import { readConfig } from "./config.js";
const config = readConfig();
const app = await createApp({ config });
let closing = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, "Shutting down");
    await app.close();
    process.exit(0);
  });
}
try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
