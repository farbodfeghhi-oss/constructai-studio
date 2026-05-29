// Agent 2 (Submit): Normenprüfer · async Deep Research
// POST /async/chat/completions → request_id (TTL 7 Tage)

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { submitDeepResearch } from "../_shared/perplexity/client.ts";
import { ANTI_HALLUCINATION, loadRolePlan } from "../_shared/perplexity/prompts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return new Response(JSON.stringify({ error: "Auth required" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const { prompt, plan_key } = await req.json();
    if (!prompt) return new Response(JSON.stringify({ error: "prompt erforderlich" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const plan = await loadRolePlan(admin, plan_key ?? "standards_deep_research");
    const systemPrompt = (plan?.system_prompt ?? "") + "\n\n" + ANTI_HALLUCINATION;
    const model = plan?.models?.primary ?? "sonar-deep-research";

    // Search filters belong in the request body, NEVER in the system prompt.
    const submission = await submitDeepResearch({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      search_domain_filter: Array.isArray(plan?.search_domain_filter) && plan.search_domain_filter.length
        ? plan.search_domain_filter
        : ["iso.org", "din.de", "beuth.de", "cen.eu", "dpma.de", "epo.org"],
      search_mode: plan?.search_mode ?? "academic",
    });

    const { data: job, error } = await admin.from("deep_research_jobs").insert({
      user_id: user.id,
      perplexity_request_id: submission.id,
      prompt,
      status: submission.status === "COMPLETED" ? "completed" : "running",
    }).select().single();
    if (error) throw new Error(error.message);

    return new Response(JSON.stringify({ ok: true, job, request_id: submission.id, upstream_status: submission.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("agent-standards error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
