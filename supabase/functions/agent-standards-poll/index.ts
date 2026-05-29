// Agent 2 (Poll): Holt Status zu async Deep Research-Job und persistiert Ergebnis.
// GET /async/chat/completions/{id}  (TTL 7 Tage, alle 5 s pollen ist sicher)

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { pollDeepResearch } from "../_shared/perplexity/client.ts";
import { extractCitations } from "../_shared/perplexity/citations.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return new Response(JSON.stringify({ error: "Auth required" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const { job_id } = await req.json();
    if (!job_id) return new Response(JSON.stringify({ error: "job_id erforderlich" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const { data: job, error } = await admin.from("deep_research_jobs")
      .select("*").eq("id", job_id).eq("user_id", user.id).maybeSingle();
    if (error || !job) return new Response(JSON.stringify({ error: "Job not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    if (job.status === "completed" || job.status === "failed") {
      return new Response(JSON.stringify({ ok: true, job }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const polled = await pollDeepResearch(job.perplexity_request_id);
    const upstream = String(polled.status ?? "").toUpperCase();

    let patch: Record<string, unknown> = {};
    if (upstream === "COMPLETED") {
      const resp = (polled as any).response ?? polled;
      const text = resp?.choices?.[0]?.message?.content ?? "";
      const citations = extractCitations(resp);
      patch = { status: "completed", result: { content: text, raw: resp }, citations };
    } else if (upstream === "FAILED") {
      patch = { status: "failed", error: (polled as any).error ?? "Perplexity FAILED" };
    } else {
      patch = { status: "running" };
    }

    const { data: updated } = await admin.from("deep_research_jobs")
      .update(patch).eq("id", job.id).select().single();

    return new Response(JSON.stringify({ ok: true, job: updated, upstream_status: upstream }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("agent-standards-poll error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
