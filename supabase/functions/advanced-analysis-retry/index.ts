import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { run_id, phase } = await req.json();
    if (!run_id || !phase) return new Response(JSON.stringify({ error: "missing run_id or phase" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: run } = await admin.from("analysis_runs").select("user_id").eq("id", run_id).single();
    if (!run || run.user_id !== user.id) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Reset phases from given phase onward
    const PHASES = ["aggregator", "gemini", "perplexity", "monica"];
    const idx = PHASES.indexOf(phase);
    if (idx < 0) return new Response(JSON.stringify({ error: "invalid phase" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: cur } = await admin.from("analysis_runs").select("phase_status").eq("id", run_id).single();
    const ps = (cur?.phase_status as Record<string, any>) ?? {};
    for (let i = idx; i < PHASES.length; i++) ps[PHASES[i]] = { status: "pending" };
    await admin.from("analysis_runs").update({ phase_status: ps, status: "queued", current_phase: phase, error: null }).eq("id", run_id);

    fetch(`${SUPABASE_URL}/functions/v1/advanced-analysis-orchestrator`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}` },
      body: JSON.stringify({ run_id, start_phase: phase }),
    }).catch(console.error);

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
