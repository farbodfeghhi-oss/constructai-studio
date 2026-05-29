// Self-chaining poller for Perplexity Deep Research (Standards phase).
// Each invocation does one poll; if still running, sleeps ~10s then re-fetches itself.
// On COMPLETED: writes standards_validation, marks phase done, kicks orchestrator(start_phase=docgen).
// On FAILED:    marks phase error.
// Hard deadline: 45 minutes from run.created_at to prevent runaway chains.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { pollDeepResearch } from "../_shared/perplexity/client.ts";
import { extractCitations } from "../_shared/perplexity/citations.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const POLL_DELAY_MS = 10_000;
const HARD_DEADLINE_MS = 45 * 60 * 1000;

async function setPhaseError(runId: string, error: string) {
  const { data } = await admin.from("analysis_runs").select("phase_status").eq("id", runId).single();
  const ps = (data?.phase_status as Record<string, unknown>) ?? {};
  ps.standards = { status: "error", error };
  await admin.from("analysis_runs").update({
    phase_status: ps, status: "error", error, current_phase: "standards",
  }).eq("id", runId);
}

async function setPhaseDone(runId: string, validation: any) {
  const { data } = await admin.from("analysis_runs").select("phase_status").eq("id", runId).single();
  const ps = (data?.phase_status as Record<string, unknown>) ?? {};
  ps.standards = { status: "done" };
  await admin.from("analysis_runs").update({
    phase_status: ps, standards_validation: validation, current_phase: "docgen", status: "running",
  }).eq("id", runId);
}

function scheduleNext(runId: string) {
  // Self-chain after delay without blocking the response.
  const fire = () => fetch(`${SUPABASE_URL}/functions/v1/advanced-analysis-standards-tick`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ run_id: runId }),
  }).catch((e) => console.error("tick re-chain:", e));

  const work = new Promise<void>((resolve) => {
    setTimeout(() => { fire(); resolve(); }, POLL_DELAY_MS);
  });
  // @ts-ignore EdgeRuntime
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { run_id } = await req.json();
    if (!run_id) return new Response("missing run_id", { status: 400, headers: corsHeaders });

    const { data: run } = await admin.from("analysis_runs").select("*").eq("id", run_id).single();
    if (!run) return new Response("not found", { status: 404, headers: corsHeaders });

    // Stop if already past standards.
    if (run.current_phase !== "standards" || run.status === "error" || run.status === "done") {
      return new Response(JSON.stringify({ ok: true, skip: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!run.standards_request_id) {
      await setPhaseError(run_id, "Missing standards_request_id");
      return new Response(JSON.stringify({ ok: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Hard deadline guard
    if (Date.now() - new Date(run.created_at).getTime() > HARD_DEADLINE_MS) {
      await setPhaseError(run_id, "Deep Research timeout (45 min hard deadline)");
      return new Response(JSON.stringify({ ok: false, timeout: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const polled = await pollDeepResearch(run.standards_request_id);
    const upstream = String(polled.status ?? "").toUpperCase();

    if (upstream === "COMPLETED") {
      const resp = (polled as any).response ?? polled;
      const validation = {
        content: resp?.choices?.[0]?.message?.content ?? "",
        citations: extractCitations(resp),
        request_id: run.standards_request_id,
      };
      await setPhaseDone(run_id, validation);
      // Resume orchestrator at docgen
      fetch(`${SUPABASE_URL}/functions/v1/advanced-analysis-orchestrator`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
        body: JSON.stringify({ run_id, start_phase: "docgen" }),
      }).catch((e) => console.error("docgen kickoff:", e));
      return new Response(JSON.stringify({ ok: true, status: "completed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (upstream === "FAILED") {
      await setPhaseError(run_id, `Deep Research FAILED: ${(polled as any).error ?? "unknown"}`);
      return new Response(JSON.stringify({ ok: false, status: "failed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Still CREATED / IN_PROGRESS → chain again.
    scheduleNext(run_id);
    return new Response(JSON.stringify({ ok: true, status: upstream || "running" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("standards-tick fatal:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
