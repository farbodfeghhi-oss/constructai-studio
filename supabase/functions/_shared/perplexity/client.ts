// Shared Perplexity API client — covers Sonar (sync), Async Deep Research, Agent API and Embeddings.
// Base URL per official docs: https://api.perplexity.ai/v1
//
// NEVER call from frontend. Only used by edge functions.

const BASE = "https://api.perplexity.ai";
const V1 = `${BASE}/v1`;

function key() {
  const k = Deno.env.get("PERPLEXITY_API_KEY");
  if (!k) throw new Error("PERPLEXITY_API_KEY is not configured");
  return k;
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      // Don't retry on 4xx (except 429)
      if (/HTTP 4(?!29)/.test(msg)) throw e;
      if (i < retries) await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Perplexity HTTP ${resp.status}: ${text}`);
  }
  return (await resp.json()) as T;
}

async function getJson<T>(url: string): Promise<T> {
  const resp = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${key()}` },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Perplexity HTTP ${resp.status}: ${text}`);
  }
  return (await resp.json()) as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// SONAR (sync) — POST /chat/completions
// ─────────────────────────────────────────────────────────────────────────────
export interface SonarOptions {
  model: string; // e.g. "sonar-pro", "sonar-reasoning-pro", "sonar"
  messages: Array<{ role: string; content: unknown }>;
  search_domain_filter?: string[]; // Body-Parameter — NEVER in system prompt
  search_mode?: "web" | "academic" | "sec";
  search_recency_filter?: "day" | "week" | "month" | "year";
  response_format?: unknown;
  max_tokens?: number;
  temperature?: number;
}

export async function callSonar(opts: SonarOptions): Promise<any> {
  // Sync chat completions endpoint is at BASE (NOT /v1/).
  return withRetry(() => postJson(`${BASE}/chat/completions`, opts));
}

// ─────────────────────────────────────────────────────────────────────────────
// DEEP RESEARCH (async) — POST /async/chat/completions  +  GET /async/chat/completions/{id}
// TTL: 7 days. Polling interval recommended: 5s.
// ─────────────────────────────────────────────────────────────────────────────
export interface AsyncSubmission {
  id: string;
  status: "CREATED" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | string;
  [k: string]: unknown;
}

export async function submitDeepResearch(opts: SonarOptions): Promise<AsyncSubmission> {
  return withRetry(() => postJson<AsyncSubmission>(`${BASE}/async/chat/completions`, { request: opts }));
}

export async function pollDeepResearch(id: string): Promise<AsyncSubmission & { response?: any }> {
  return getJson(`${BASE}/async/chat/completions/${encodeURIComponent(id)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT API — POST /v1/agent
// Multi-model fallback (max 5), multimodal (image_url with PNG/JPEG/WEBP/GIF, ≤50MB).
// ─────────────────────────────────────────────────────────────────────────────
// Per Perplexity docs (OpenAI-compatible): content parts use `text` and `image_url` types.
// image_url is an object: { url: "https://..." | "data:image/...;base64,..." }
export type AgentImageInput = { type: "image_url"; image_url: { url: string } };
export type AgentTextInput = { type: "text"; text: string };
export type AgentInputItem = AgentTextInput | AgentImageInput;

export interface AgentOptions {
  models: string[]; // 1..5 model IDs (primary first, fallbacks after)
  instructions?: string; // system prompt (re-read every loop)
  input: Array<{ role: "user" | "assistant" | "system"; content: AgentInputItem[] }> | string;
  tools?: Array<{ type: string } | Record<string, unknown>>;
  max_steps?: number;
  response_format?: unknown;
}

export async function callAgent(opts: AgentOptions): Promise<any> {
  if (!Array.isArray(opts.models) || opts.models.length === 0 || opts.models.length > 5) {
    throw new Error("Agent API: 'models' must be an array of 1 to 5 model IDs");
  }
  return withRetry(() => postJson(`${V1}/agent`, opts));
}

// ─────────────────────────────────────────────────────────────────────────────
// EMBEDDINGS — POST /v1/embeddings
// Available models: pplx-embed-v1-0.6b, pplx-embed-v1-4b  (2560 dim for 4b)
// Response embedding is base64-encoded int8 by default → decode to Float32-compatible array.
// Embeddings unnormalised → use cosine similarity in pgvector.
// ─────────────────────────────────────────────────────────────────────────────
export interface EmbeddingOptions {
  model: "pplx-embed-v1-4b" | "pplx-embed-v1-0.6b" | string;
  input: string | string[];
}

export interface EmbeddingResponse {
  data: Array<{ embedding: string | number[]; index: number }>;
  model: string;
  usage?: { prompt_tokens: number; total_tokens: number };
}

export async function callEmbeddings(opts: EmbeddingOptions): Promise<EmbeddingResponse> {
  return withRetry(() => postJson<EmbeddingResponse>(`${V1}/embeddings`, opts));
}

/** Decode base64-int8 embedding from Perplexity into a number[] (length = dim). */
export function decodeEmbedding(emb: string | number[]): number[] {
  if (Array.isArray(emb)) return emb;
  // atob → int8 array → number[]
  const binary = atob(emb);
  const out = new Array<number>(binary.length);
  for (let i = 0; i < binary.length; i++) {
    const b = binary.charCodeAt(i);
    out[i] = b > 127 ? b - 256 : b; // signed int8
  }
  return out;
}
