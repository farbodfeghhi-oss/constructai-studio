// Programmatic citation extraction. NEVER parse URLs from the generated text.
// Sonar sync:    response.search_results  (and legacy response.citations[])
// Sonar stream:  response.reasoning.search_results
// Agent API:     response.search_results or per-step results

export interface SearchResult {
  title?: string;
  url: string;
  snippet?: string;
  date?: string;
}

export function extractCitations(response: any): SearchResult[] {
  if (!response || typeof response !== "object") return [];

  const out: SearchResult[] = [];

  // Primary: search_results array of objects
  if (Array.isArray(response.search_results)) {
    for (const r of response.search_results) {
      if (r?.url) out.push({ url: r.url, title: r.title, snippet: r.snippet, date: r.date });
    }
  }

  // Streaming/reasoning variant
  if (Array.isArray(response.reasoning?.search_results)) {
    for (const r of response.reasoning.search_results) {
      if (r?.url) out.push({ url: r.url, title: r.title, snippet: r.snippet, date: r.date });
    }
  }

  // Legacy: citations as URL strings
  if (Array.isArray(response.citations)) {
    for (const c of response.citations) {
      if (typeof c === "string") out.push({ url: c });
      else if (c?.url) out.push({ url: c.url, title: c.title });
    }
  }

  // Dedupe by URL
  const seen = new Set<string>();
  return out.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}
