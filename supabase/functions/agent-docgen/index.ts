// Agent 3: Technische Dokumentation · sonar-pro + json_schema
// POST /v1/chat/completions  (System-Prompt steuert NUR Text-Generierung, NICHT Suche.)

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callSonar } from "../_shared/perplexity/client.ts";
import { extractCitations } from "../_shared/perplexity/citations.ts";
import { ANTI_HALLUCINATION, loadRolePlan } from "../_shared/perplexity/prompts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { prompt, context, plan_key, override_schema } = await req.json();
    if (!prompt) return new Response(JSON.stringify({ error: "prompt erforderlich" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const plan = await loadRolePlan(admin, plan_key ?? "tech_docgen_structured");
    const systemPrompt = (plan?.system_prompt ?? "") + "\n\n" + ANTI_HALLUCINATION;
    const model = plan?.models?.primary ?? "sonar-pro";
    const responseFormat = override_schema ?? plan?.response_format ?? undefined;

    const userText = context ? `KONTEXT:\n${context}\n\nAUFGABE:\n${prompt}` : prompt;

    const resp = await callSonar({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
      response_format: responseFormat,
      search_domain_filter: Array.isArray(plan?.search_domain_filter) && plan.search_domain_filter.length
        ? plan.search_domain_filter : undefined,
      search_mode: plan?.search_mode ?? undefined,
    });

    const content = resp?.choices?.[0]?.message?.content ?? "";
    let parsed: unknown = null;
    try { parsed = JSON.parse(content); } catch { /* keep null */ }

    return new Response(JSON.stringify({
      ok: true,
      content,
      structured: parsed,
      citations: extractCitations(resp),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("agent-docgen error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
