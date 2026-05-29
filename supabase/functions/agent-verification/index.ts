// Agent 3: Logical & Math Verification
// Modell: sonar-reasoning-pro via /chat/completions
// Extrahiert den <think>-Block via shared parseReasoning() und liefert strukturiertes JSON.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callSonar } from "../_shared/perplexity/client.ts";
import { extractCitations } from "../_shared/perplexity/citations.ts";
import { parseReasoning } from "../_shared/perplexity/reasoning.ts";
import { ANTI_HALLUCINATION, loadRolePlan } from "../_shared/perplexity/prompts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const DEFAULT_SYSTEM = `Du bist Senior-Maschinenbauingenieur (15+ Jahre, DIN/ISO/EN, Blech, Solid Edge).
Aufgabe: Verifiziere den vorliegenden Mechanik-Design-Blueprint MATHEMATISCH und LOGISCH.
Prüfe: Toleranzketten, Materialkennwerte (Streckgrenze, E-Modul, Dichte), Sicherheitsfaktoren,
Lastannahmen, Spannungen/Verformungen, geometrische Plausibilität, Schraubenauslegung,
Schweißnahtfestigkeit, thermische Ausdehnung.

Denke ausführlich Schritt-für-Schritt im <think>-Block (Berechnungen, Annahmen, Quellen).
Antworte am Ende AUSSCHLIESSLICH mit einem JSON-Objekt nach folgendem Schema (KEIN Markdown-Fence):
{
  "verified_parameters": [
    { "name": string, "value": string, "unit": string, "source": string, "ok": boolean }
  ],
  "assumptions": [string],
  "warnings": [
    { "severity": "low"|"medium"|"high"|"critical", "issue": string, "recommendation": string }
  ],
  "corrections": [
    { "parameter": string, "current": string, "should_be": string, "rationale": string }
  ],
  "summary": string
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { prompt, design_blueprint, context, plan_key } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt erforderlich" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const plan = (await loadRolePlan(admin, plan_key ?? "logic_verification").catch(() => null)) ?? null;
    const systemPrompt = ((plan?.system_prompt ?? DEFAULT_SYSTEM) + "\n\n" + ANTI_HALLUCINATION).trim();
    const model = plan?.models?.primary ?? "sonar-reasoning-pro";

    const designText = typeof design_blueprint === "string"
      ? design_blueprint
      : (design_blueprint?.content ?? JSON.stringify(design_blueprint ?? {}));

    const userPrompt =
`URSPRÜNGLICHE ANFRAGE:
${prompt}

DESIGN-BLUEPRINT (zu verifizieren):
${designText.slice(0, 12000)}

${context ? `ZUSÄTZLICHER KONTEXT:\n${String(context).slice(0, 4000)}\n` : ""}
Verifiziere alle quantitativen Aussagen, identifiziere Lücken und liefere strukturiertes JSON gemäß Schema.`;

    const resp = await callSonar({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
    });

    const raw = resp?.choices?.[0]?.message?.content ?? "";
    const parsed = parseReasoning(raw);
    const citations = extractCitations(resp);

    return new Response(JSON.stringify({
      ok: true,
      model_used: resp?.model ?? model,
      thinking: parsed.thinking,
      content: parsed.answer,
      json: parsed.json,
      citations,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("agent-verification error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
