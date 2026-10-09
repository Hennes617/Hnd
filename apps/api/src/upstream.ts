import { EnvHttpProxyAgent, fetch } from "undici";
export type FetchJson = (url: string) => Promise<unknown>;
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_HOSTS = new Set([
  "api.open-meteo.com",
  "flood-api.open-meteo.com",
  "api.hochwasserzentralen.de",
  "www.pegelonline.wsv.de",
  "warnung.bund.de",
  "hvz.lsaurl.de",
  "www.pegelonline.nlwkn.niedersachsen.de",
  "www.talsperrenbetrieb.de",
  "www.harzwasserwerke.de",
  "bis.azure-api.net",
]);
export function createFetcher(timeoutMs: number): FetchJson {
  // Honour managed-cloud proxy and CA trust; never disable certificate validation.
  const dispatcher =
    process.env.HTTPS_PROXY || process.env.HTTP_PROXY
      ? new EnvHttpProxyAgent()
      : undefined;
  return async (url: string) => {
    const target = new URL(url);
    if (
      target.protocol !== "https:" ||
      !ALLOWED_HOSTS.has(target.hostname) ||
      target.username ||
      target.password
    )
      throw new Error("Unsupported upstream");
    const response = await fetch(target, {
      dispatcher,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "error",
      headers: {
        accept: "application/json",
        "user-agent": "HND-Water-Monitor/1.0",
      },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Upstream HTTP ${response.status}`);
    }
    if (Number(response.headers.get("content-length") || 0) > MAX_BYTES) {
      await response.body?.cancel();
      throw new Error("Upstream response too large");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty upstream response");
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > MAX_BYTES) throw new Error("Upstream response too large");
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    } catch {
      throw new Error("Invalid upstream JSON");
    }
  };
}
export async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const output: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= items.length) return;
        output[index] = await fn(items[index]);
      }
    }),
  );
  return output;
}
/** A provider budget bounds total latency, even when many detail requests fail. */
export async function beforeDeadline<T>(
  promise: Promise<T>,
  deadline: number,
): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    void promise.catch(() => undefined);
    throw new Error("Provider time budget exceeded");
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Provider time budget exceeded")),
          remaining,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
