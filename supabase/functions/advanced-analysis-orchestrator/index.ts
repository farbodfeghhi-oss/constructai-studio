// Orchestrator · 100% Perplexity Pipeline
// Phases: aggregator → design (agent-design) → standards (Deep Research async) → docgen (agent-docgen)

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { submitDeepResearch, pollDeepResearch } from "../_shared/perplexity/client.ts";
import { extractCitations } from "../_shared/perplexity/citations.ts";
import { ANTI_HALLUCINATION, loadRolePlan } from "../_shared/perplexity/prompts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Phase = "aggregator" | "design" | "standards" | "docgen";
const PHASES: Phase[] = ["aggregator", "design", "standards", "docgen"];

const IMG_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 60 min — gives Perplexity ample download time

async function updateRun(runId: string, patch: Record<string, unknown>) {
  await admin.from("analysis_runs").update(patch).eq("id", runId);
}

async function setPhase(runId: string, phase: Phase, status: string, error?: string) {
  const { data } = await admin.from("analysis_runs").select("phase_status").eq("id", runId).single();
  const ps = (data?.phase_status as Record<string, unknown>) ?? {};
  ps[phase] = { status, ...(error ? { error } : {}) };
  await admin.from("analysis_runs").update({
    phase_status: ps,
    current_phase: phase,
    status: status === "error" ? "error" : (phase === "docgen" && status === "done") ? "done" : "running",
    ...(error ? { error } : {}),
  }).eq("id", runId);
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      if (i < retries) await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

interface Aggregated {
  prompt: string;
  references: Array<{ id: string; title: string; category: string; content: string }>;
  images: Array<{ url: string; name: string }>;
  documents: Array<{ url: string; name: string; mime: string }>;
}

async function aggregator(runId: string): Promise<Aggregated> {
  const { data: run } = await admin.from("analysis_runs").select("*").eq("id", runId).single();
  if (!run) throw new Error("Run not found");

  let references: Aggregated["references"] = [];
  if (run.reference_ids?.length) {
    const { data: refs } = await admin
      .from("knowledge_items")
      .select("id,title,category,ai_summary,extracted_text")
      .in("id", run.reference_ids)
      .eq("user_id", run.user_id);
    references = (refs ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      content: (r.ai_summary ?? r.extracted_text ?? "").slice(0, 4000),
    }));
  }

  const images: Aggregated["images"] = [];
  const documents: Aggregated["documents"] = [];
  for (const path of run.file_paths ?? []) {
    const { data: signed } = await admin.storage
      .from("analysis-uploads")
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    const url = signed?.signedUrl;
    if (!url) continue;
    const name = path.split("/").pop() ?? path;
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    if (IMG_EXT.has(ext)) {
      images.push({ url, name });
    } else {
      const mime = ext === "pdf" ? "application/pdf" : "application/octet-stream";
      documents.push({ url, name, mime });
    }
  }

  return { prompt: run.prompt, references, images, documents };
}

// ─── Phase: Design (agent-design via Perplexity) ─────────────────────────────
async function designPhase(ctx: Aggregated) {
  const enrichedPrompt = [
    `USER-ANFRAGE:\n${ctx.prompt}`,
    ctx.references.length
      ? `\nAKTIVE REFERENZEN (${ctx.references.length}):\n${ctx.references.map((r) => `- [${r.category}] ${r.title}\n  ${r.content.slice(0, 800)}`).join("\n")}`
      : "",
    ctx.documents.length
      ? `\nNICHT-BILD-DATEIEN (Download per HTTPS, gültig 60 min):\n${ctx.documents.map((d) => `- ${d.name} (${d.mime}): ${d.url}`).join("\n")}`
      : "",
    `\nLiefere einen strukturierten Mechanik-Design-Blueprint: erkannte Constraints, Anomalien, Ist-Zustand, erforderliche Änderungen, referenzierte Normen.`,
  ].join("\n");

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/agent-design`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_key: "mech_design_agent",
      prompt: enrichedPrompt,
      images: ctx.images.map((i) => ({ url: i.url })),
    }),
  });
  if (!resp.ok) throw new Error(`agent-design HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  if (data?.error) throw new Error(`agent-design: ${data.error}`);
  return {
    mode: data.mode,
    model_used: data.model_used,
    content: data.content ?? "",
    citations: data.citations ?? [],
  };
}

// ─── Phase: Standards (Submit only — polling lives in standards-tick) ────────
async function standardsSubmit(runId: string, designBlueprint: any, ctx: Aggregated) {
  const plan = await loadRolePlan(admin, "standards_deep_research");
  const systemPrompt = (plan?.system_prompt ?? "") + "\n\n" + ANTI_HALLUCINATION;
  const model = plan?.models?.primary ?? "sonar-deep-research";

  const userPrompt =
`Validiere folgenden Mechanik-Design-Blueprint gegen aktuelle Engineering-Standards (DIN, EN, ISO, IEC, ASME).

URSPRÜNGLICHE ANFRAGE:
${ctx.prompt}

DESIGN-BLUEPRINT:
${(designBlueprint?.content ?? JSON.stringify(designBlueprint)).slice(0, 12000)}

REFERENZIERTE STANDARDS DES NUTZERS:
${ctx.references.map((r) => `- ${r.title}`).join("\n") || "(keine)"}

Liefere strukturiert (Markdown): 1) Standards-Validierung mit Konformitätsstatus, 2) Material-/Werkstoffdaten, 3) Feasibility-Risiken, 4) konkrete Empfehlungen.`;

  const submission = await submitDeepResearch({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    search_domain_filter: Array.isArray(plan?.search_domain_filter) && plan.search_domain_filter.length
      ? plan.search_domain_filter
      : ["iso.org", "din.de", "beuth.de", "cen.eu", "dpma.de", "epo.org"],
    search_mode: plan?.search_mode ?? "academic",
  });

  await updateRun(runId, { standards_request_id: submission.id });

  // Fire-and-forget kick the ticker; it self-chains every ~10s.
  fetch(`${SUPABASE_URL}/functions/v1/advanced-analysis-standards-tick`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ run_id: runId }),
  }).catch((e) => console.error("tick kickoff:", e));
}


// ─── Phase: Docgen (agent-docgen via sonar-pro + json_schema) ────────────────
const FINAL_REPORT_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "final_engineering_report",
    schema: {
      type: "object",
      properties: {
        executive_summary: { type: "string" },
        cad_modification_guide: { type: "string" },
        optimizations: { type: "string" },
        implementation_plan: { type: "string" },
        risks_and_conformity: { type: "string" },
        sources: { type: "array", items: { type: "string" } },
      },
      required: [
        "executive_summary",
        "cad_modification_guide",
        "optimizations",
        "implementation_plan",
        "risks_and_conformity",
      ],
    },
  },
};

function reportToMarkdown(r: any, fallbackCitations: string[] = []): string {
  if (!r || typeof r !== "object") return String(r ?? "");
  const sources = Array.isArray(r.sources) && r.sources.length ? r.sources : fallbackCitations;
  return [
    `# Executive Summary\n\n${r.executive_summary ?? ""}`,
    `## 1. CAD Modification Guide\n\n${r.cad_modification_guide ?? ""}`,
    `## 2. Optimizations\n\n${r.optimizations ?? ""}`,
    `## 3. Implementation Plan\n\n${r.implementation_plan ?? ""}`,
    `## 4. Risks & Standards Conformity\n\n${r.risks_and_conformity ?? ""}`,
    sources.length
      ? `## 5. Sources\n\n${sources.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}`
      : "",
  ].filter(Boolean).join("\n\n");
}

async function docgenPhase(ctx: Aggregated, design: any, standards: any) {
  const context = JSON.stringify({
    user_prompt: ctx.prompt,
    design_blueprint: design,
    standards_validation: standards,
  }).slice(0, 24000);

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/agent-docgen`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_key: "tech_docgen_structured",
      prompt:
        "Synthetisiere den finalen Engineering Report aus dem Mechanik-Design-Blueprint (Schritt 2) und der Normen-Validierung (Schritt 3). Antworte ausschließlich gemäß JSON-Schema. Verwende Markdown nur innerhalb der einzelnen string-Felder.",
      context,
      override_schema: FINAL_REPORT_SCHEMA,
    }),
  });
  if (!resp.ok) throw new Error(`agent-docgen HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  if (data?.error) throw new Error(`agent-docgen: ${data.error}`);

  const allCitations = [
    ...(Array.isArray(design?.citations) ? design.citations : []),
    ...(Array.isArray(standards?.citations) ? standards.citations : []),
    ...(Array.isArray(data?.citations) ? data.citations : []),
  ];
  const uniqueSources = Array.from(new Set(allCitations.map((c: any) => (typeof c === "string" ? c : c?.url ?? "")))).filter(Boolean);

  return reportToMarkdown(data?.structured ?? {}, uniqueSources) || (data?.content ?? "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { run_id, start_phase = "aggregator" } = await req.json();
  if (!run_id) return new Response("missing run_id", { status: 400, headers: corsHeaders });

  const work = (async () => {
    const startIdx = PHASES.indexOf(start_phase as Phase);
    let aggregated: Aggregated | null = null;
    let design: any = null;
    let standards: any = null;

    const { data: existing } = await admin.from("analysis_runs").select("*").eq("id", run_id).single();
    if (!existing) return;
    design = existing.design_blueprint;
    standards = existing.standards_validation;

    try {
      for (let i = startIdx; i < PHASES.length; i++) {
        const phase = PHASES[i];
        await setPhase(run_id, phase, "running");
        try {
          if (phase === "aggregator") {
            aggregated = await withRetry(() => aggregator(run_id));
          } else if (phase === "design") {
            if (!aggregated) aggregated = await aggregator(run_id);
            design = await withRetry(() => designPhase(aggregated!));
            await updateRun(run_id, { design_blueprint: design });
          } else if (phase === "standards") {
            if (!aggregated) aggregated = await aggregator(run_id);
            if (!design) throw new Error("Missing design blueprint");
            // Submit Deep Research, then exit. The ticker takes over polling.
            await standardsSubmit(run_id, design, aggregated);
            // Leave standards as "running"; ticker advances it and re-invokes orchestrator with start_phase=docgen.
            return;
          } else if (phase === "docgen") {
            if (!aggregated) aggregated = await aggregator(run_id);
            if (!design || !standards) throw new Error("Missing prior phases");
            const report = await withRetry(() => docgenPhase(aggregated!, design, standards));
            await updateRun(run_id, { final_report: report });
          }
          await setPhase(run_id, phase, "done");

        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`Phase ${phase} failed:`, msg);
          await setPhase(run_id, phase, "error", msg);
          return;
        }
      }
      await updateRun(run_id, { status: "done", current_phase: "done" });
    } catch (e) {
      console.error("Orchestrator fatal:", e);
      await updateRun(run_id, { status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  })();

  // @ts-ignore - EdgeRuntime in Supabase
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
  else work.catch(console.error);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
