// Shared Picsart client — AI Hub (GenAI), Variable Data Content (Replay), Programmable Image (Tools).
// Auth: header X-Picsart-API-Key. Default body type: application/json.
// Async status whitelist (post Phase-6 standard): processing | success | error.

const KEY_NAME = "PICSART_API_KEY";

export function picsartKey(): string {
  const k = Deno.env.get(KEY_NAME);
  if (!k) throw new Error("PICSART_API_KEY is not configured");
  return k;
}

export function picsartHeaders(extra: Record<string, string> = {}): HeadersInit {
  return {
    "X-Picsart-API-Key": picsartKey(),
    "Content-Type": "application/json",
    "Accept": "application/json",
    ...extra,
  };
}

export async function picsartPostJson<T = any>(url: string, body: unknown): Promise<T> {
  const resp = await fetch(url, { method: "POST", headers: picsartHeaders(), body: JSON.stringify(body) });
  if (!resp.ok) throw new Error(`Picsart POST ${url} → HTTP ${resp.status}: ${await resp.text()}`);
  return (await resp.json()) as T;
}

export async function picsartGetJson<T = any>(url: string): Promise<T> {
  const resp = await fetch(url, { headers: { "X-Picsart-API-Key": picsartKey(), Accept: "application/json" } });
  if (!resp.ok) throw new Error(`Picsart GET ${url} → HTTP ${resp.status}: ${await resp.text()}`);
  return (await resp.json()) as T;
}

/** Normalize Picsart status to the standardised set: processing | success | error. */
export function normalizeStatus(raw: unknown): "processing" | "success" | "error" {
  const s = String(raw ?? "").toLowerCase();
  if (["success", "done", "finished", "completed"].includes(s)) return "success";
  if (["error", "failed", "failure"].includes(s)) return "error";
  return "processing";
}

/** Poll any Picsart async endpoint by polling URL with the standardised status whitelist. */
export async function pollPicsart<T = any>(
  pollUrl: string,
  opts: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<T> {
  const interval = opts.intervalMs ?? 2000;
  const attempts = opts.maxAttempts ?? 60;
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, interval));
    const data = await picsartGetJson<any>(pollUrl);
    const status = normalizeStatus(data?.status);
    if (status === "success") return data as T;
    if (status === "error") throw new Error(`Picsart error: ${JSON.stringify(data)}`);
    // status === "processing" → continue
  }
  throw new Error(`Picsart timeout after ${attempts * interval}ms (${pollUrl})`);
}

/** Extract the first usable image URL from a Picsart response payload. */
export function extractImageUrl(d: any): string {
  return (
    d?.data?.[0]?.url ??
    d?.images?.[0]?.url ??
    d?.result?.[0]?.url ??
    d?.url ??
    d?.urls?.[0] ??
    ""
  );
}
