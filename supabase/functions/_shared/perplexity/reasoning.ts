// Parser for sonar-reasoning-pro output.
// The model emits a <think>...</think> block with reasoning tokens,
// followed by the actual answer (often JSON). response_format does NOT strip it.

export interface ParsedReasoning {
  thinking: string | null;
  answer: string;
  json: unknown | null;
}

export function parseReasoning(content: string): ParsedReasoning {
  if (!content) return { thinking: null, answer: "", json: null };
  const match = content.match(/<think>([\s\S]*?)<\/think>\s*([\s\S]*)$/);
  const thinking = match ? match[1].trim() : null;
  const answer = (match ? match[2] : content).trim();

  let json: unknown | null = null;
  // Try to pull a JSON object out of the answer (with or without ```json fences)
  const cleaned = answer.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "").trim();
  try {
    json = JSON.parse(cleaned);
  } catch {
    // Fallback: first {...} block
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try { json = JSON.parse(m[0]); } catch { /* leave null */ }
    }
  }
  return { thinking, answer, json };
}
