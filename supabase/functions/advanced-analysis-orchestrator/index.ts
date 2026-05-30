// Orchestrator · 100% Perplexity Pipeline (5 Phases)
// aggregator (RAG via pplx-embed-v1-4b) → design (Claude Opus / Sonar Vision)
//   → verification (sonar-reasoning-pro + <think>-Parser)
//   → standards (Deep Research async)  → docgen (sonar-pro json_schema)

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { submitDeepResearch, callEmbeddings, decodeEmbedding } from "../_shared/perplexity/client.ts";
import { ANTI_HALLUCINATION, loadRolePlan } from "../_shared/perplexity/prompts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Phase = "aggregator" | "design" | "verification" | "standards" | "docgen";
const PHASES: Phase[] = ["aggregator", "design", "verification", "standards", "docgen"];

const IMG_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const RAG_QUERY_MODEL = "pplx-embed-v1-4b";
const RAG_MATCH_COUNT = 8;
const RAG_MIN_SIMILARITY = 0.55;

async function updateRun(runId: string, patch: Record<string, unknown>) {
  await admin.from("analysis_runs").update(patch).eq("id", runId);
}

async function recordModel(runId: string, phase: Phase, model: string | null | undefined) {
  if (!model) return;
  const { data } = await admin.from("analysis_runs").select("models_used").eq("id", runId).single();
  const m = (data?.models_used as Record<string, unknown>) ?? {};
  m[phase] = model;
  await admin.from("analysis_runs").update({ models_used: m }).eq("id", runId);
}

async function setPhase(runId: string, phase: Phase, status: string, error?: string) {
  const { data } = await admin.from("analysis_runs").select("phase_status, started_at").eq("id", runId).single();
  const ps = (data?.phase_status as Record<string, unknown>) ?? {};
  ps[phase] = { status, ...(error ? { error } : {}) };
  const isDone = phase === "docgen" && status === "done";
  const patch: Record<string, unknown> = {
    phase_status: ps,
    current_phase: isDone ? "done" : phase,
    status: status === "error" ? "error" : isDone ? "done" : "running",
    ...(error ? { error } : {}),
  };
  if (!data?.started_at && status === "running") patch.started_at = new Date().toISOString();
  if (status === "error" || isDone) patch.completed_at = new Date().toISOString();
  await admin.from("analysis_runs").update(patch).eq("id", runId);
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

interface RagMatch { id: string; title: string; ai_summary: string | null; category: string | null; similarity: number; }
interface Aggregated {
  prompt: string;
  user_id: string;
  rag_matches: RagMatch[];
  references_fallback: Array<{ id: string; title: string; category: string; content: string }>;
  images: Array<{ url: string; name: string }>;
  documents: Array<{ url: string; name: string; mime: string }>;
}

// ─── Phase 1: Aggregator — semantic RAG search ─────────────────────────────
async function aggregator(runId: string): Promise<Aggregated> {
  const { data: run } = await admin.from("analysis_runs").select("*").eq("id", runId).single();
  if (!run) throw new Error("Run not found");

  // Vector search over the user's knowledge base.
  let ragMatches: RagMatch[] = [];
  try {
    const emb = await callEmbeddings({ model: RAG_QUERY_MODEL, input: run.prompt });
    const vec = decodeEmbedding(emb.data?.[0]?.embedding ?? "");
    if (vec.length) {
      const { data, error } = await admin.rpc("match_knowledge_items", {
        query_embedding: `[${vec.join(",")}]`,
        match_count: RAG_MATCH_COUNT,
        p_user_id: run.user_id,
      });
      if (error) throw new Error(error.message);
      let matches = (data ?? []) as RagMatch[];
      matches = matches.filter((m) => m.similarity >= RAG_MIN_SIMILARITY);
      // If the user explicitly selected reference_ids, prefer those.
      if (Array.isArray(run.reference_ids) && run.reference_ids.length) {
        const wanted = new Set(run.reference_ids);
        const inSel = matches.filter((m) => wanted.has(m.id));
        if (inSel.length) matches = inSel;
      }
      ragMatches = matches;
    }
  } catch (e) {
    console.warn("aggregator RAG failed, falling back to explicit refs:", e instanceof Error ? e.message : e);
  }

  // Fallback / supplement for explicitly chosen references that didn't hit the vector search.
  let referencesFallback: Aggregated["references_fallback"] = [];
  if (run.reference_ids?.length) {
    const hit = new Set(ragMatches.map((m) => m.id));
    const missing = (run.reference_ids as string[]).filter((id) => !hit.has(id));
    if (missing.length) {
      const { data: refs } = await admin
        .from("knowledge_items")
        .select("id,title,category,ai_summary")
        .in("id", missing)
        .eq("user_id", run.user_id);
      referencesFallback = (refs ?? []).map((r: any) => ({
        id: r.id,
        title: r.title,
        category: r.category ?? "",
        content: r.ai_summary ?? "",
      }));
    }
  }

  // Images & docs via 60-min signed URLs.
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

  return {
    prompt: run.prompt,
    user_id: run.user_id,
    rag_matches: ragMatches,
    references_fallback: referencesFallback,
    images,
    documents,
  };
}

function renderRagContext(ctx: Aggregated): string {
  const lines: string[] = [];
  if (ctx.rag_matches.length) {
    lines.push(`SEMANTISCH RELEVANTE WISSENS-CHUNKS (Top ${ctx.rag_matches.length}, pplx-embed-v1-4b · cosine):`);
    for (const m of ctx.rag_matches) {
      lines.push(`- [${(m.category ?? "").toUpperCase()}] ${m.title} (sim=${m.similarity.toFixed(3)})`);
      if (m.ai_summary) lines.push(`  ${m.ai_summary}`);
    }
  }
  if (ctx.references_fallback.length) {
    lines.push(`\nEXPLIZIT GEWÄHLTE REFERENZEN (ohne RAG-Treffer):`);
    for (const r of ctx.references_fallback) {
      lines.push(`- [${r.category}] ${r.title}`);
      if (r.content) lines.push(`  ${r.content}`);
    }
  }
  if (ctx.documents.length) {
    lines.push(`\nNICHT-BILD-DATEIEN (HTTPS, 60 min gültig):`);
    for (const d of ctx.documents) lines.push(`- ${d.name} (${d.mime}): ${d.url}`);
  }
  return lines.join("\n");
}

// ─── Phase 2: Design ────────────────────────────────────────────────────────
async function designPhase(ctx: Aggregated) {
  const enrichedPrompt = [
    `USER-ANFRAGE:\n${ctx.prompt}`,
    renderRagContext(ctx),
    `\nLiefere einen strukturierten Mechanik-Design-Blueprint: erkannte Constraints, Anomalien, Ist-Zustand, erforderliche Änderungen, referenzierte Normen.`,
  ].filter(Boolean).join("\n\n");

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/agent-design`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
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

// ─── Phase 3: Verification (sonar-reasoning-pro + <think>) ──────────────────
async function verificationPhase(ctx: Aggregated, design: any) {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/agent-verification`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      plan_key: "logic_verification",
      prompt: ctx.prompt,
      design_blueprint: design,
      context: renderRagContext(ctx),
    }),
  });
  if (!resp.ok) throw new Error(`agent-verification HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  if (data?.error) throw new Error(`agent-verification: ${data.error}`);
  return {
    model_used: data.model_used,
    thinking: data.thinking ?? null,
    content: data.content ?? "",
    json: data.json ?? null,
    citations: data.citations ?? [],
  };
}

// ─── Phase 4: Standards (Submit only) ───────────────────────────────────────
async function standardsSubmit(runId: string, design: any, verification: any, ctx: Aggregated) {
  const plan = await loadRolePlan(admin, "standards_deep_research");
  const systemPrompt = (plan?.system_prompt ?? "") + "\n\n" + ANTI_HALLUCINATION;
  const model = plan?.models?.primary ?? "sonar-deep-research";

  const verBlock = verification?.content
    ? `\n\nMATHEMATISCHE VERIFIZIERUNG (sonar-reasoning-pro):\n${String(verification.content).slice(0, 6000)}`
    : "";
  const verJson = verification?.json
    ? `\n\nVERIFIZIERTE PARAMETER (JSON):\n${JSON.stringify(verification.json).slice(0, 4000)}`
    : "";

  const userPrompt =
`Validiere folgenden Mechanik-Design-Blueprint gegen aktuelle Engineering-Standards (DIN, EN, ISO, IEC, ASME).

URSPRÜNGLICHE ANFRAGE:
${ctx.prompt}

DESIGN-BLUEPRINT:
${(design?.content ?? JSON.stringify(design)).slice(0, 10000)}
${verBlock}${verJson}

SEMANTISCH RELEVANTE REFERENZEN:
${ctx.rag_matches.map((r) => `- ${r.title} (sim=${r.similarity.toFixed(2)})`).join("\n") || "(keine)"}

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

  fetch(`${SUPABASE_URL}/functions/v1/advanced-analysis-standards-tick`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ run_id: runId }),
  }).catch((e) => console.error("tick kickoff:", e));
}

// ─── Phase 5: Docgen ────────────────────────────────────────────────────────
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
        // Phase 6 bridge — short isolated prompt for Picsart AI Hub (recraftv4/flux-2-pro).
        // MUST NOT contain the full report. Max ~300 chars, English, blueprint/vector style.
        picsart_image_prompt: { type: "string" },
        // Flat key/value map for Picsart Variable Data Content (Replay) template.
        // Keys map to template variables (title, material, standard, tolerance, dimensions, qty…).
        data_sheet_variables: {
          type: "object",
          additionalProperties: { type: "string" },
        },
      },
      required: [
        "executive_summary",
        "cad_modification_guide",
        "optimizations",
        "implementation_plan",
        "risks_and_conformity",
        "picsart_image_prompt",
        "data_sheet_variables",
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

async function docgenPhase(ctx: Aggregated, design: any, verification: any, standards: any) {
  const context = JSON.stringify({
    user_prompt: ctx.prompt,
    design_blueprint: design,
    verification_blueprint: verification,
    standards_validation: standards,
  }).slice(0, 24000);

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/agent-docgen`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      plan_key: "tech_docgen_structured",
      prompt:
        "Synthetisiere den finalen Engineering Report aus Design-Blueprint (Schritt 2), Mathematischer Verifizierung (Schritt 3) und Normen-Validierung (Schritt 4). Antworte ausschließlich gemäß JSON-Schema. Verwende Markdown nur innerhalb der einzelnen string-Felder.",
      context,
      override_schema: FINAL_REPORT_SCHEMA,
    }),
  });
  if (!resp.ok) throw new Error(`agent-docgen HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  if (data?.error) throw new Error(`agent-docgen: ${data.error}`);

  const allCitations = [
    ...(Array.isArray(design?.citations) ? design.citations : []),
    ...(Array.isArray(verification?.citations) ? verification.citations : []),
    ...(Array.isArray(standards?.citations) ? standards.citations : []),
    ...(Array.isArray(data?.citations) ? data.citations : []),
  ];
  const uniqueSources = Array.from(new Set(allCitations.map((c: any) => (typeof c === "string" ? c : c?.url ?? "")))).filter(Boolean);

  const structured = data?.structured ?? null;
  const report = reportToMarkdown(structured ?? {}, uniqueSources) || (data?.content ?? "");
  return { report, structured };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { run_id, start_phase = "aggregator" } = await req.json();
  if (!run_id) return new Response("missing run_id", { status: 400, headers: corsHeaders });

  const work = (async () => {
    const startIdx = PHASES.indexOf(start_phase as Phase);
    let aggregated: Aggregated | null = null;
    let design: any = null;
    let verification: any = null;
    let standards: any = null;

    const { data: existing } = await admin.from("analysis_runs").select("*").eq("id", run_id).single();
    if (!existing) return;
    design = existing.design_blueprint;
    verification = existing.verification_blueprint;
    standards = existing.standards_validation;

    try {
      for (let i = startIdx; i < PHASES.length; i++) {
        const phase = PHASES[i];
        await setPhase(run_id, phase, "running");
        try {
          if (phase === "aggregator") {
            aggregated = await withRetry(() => aggregator(run_id));
            await recordModel(run_id, "aggregator", `${RAG_QUERY_MODEL} + match_knowledge_items`);
          } else if (phase === "design") {
            if (!aggregated) aggregated = await aggregator(run_id);
            design = await withRetry(() => designPhase(aggregated!));
            await updateRun(run_id, { design_blueprint: design });
            await recordModel(run_id, "design", design?.model_used);
          } else if (phase === "verification") {
            if (!aggregated) aggregated = await aggregator(run_id);
            if (!design) throw new Error("Missing design blueprint");
            verification = await withRetry(() => verificationPhase(aggregated!, design));
            await updateRun(run_id, { verification_blueprint: verification });
            await recordModel(run_id, "verification", verification?.model_used ?? "sonar-reasoning-pro");
          } else if (phase === "standards") {
            if (!aggregated) aggregated = await aggregator(run_id);
            if (!design) throw new Error("Missing design blueprint");
            if (!verification) throw new Error("Missing verification blueprint");
            await standardsSubmit(run_id, design, verification, aggregated);
            await recordModel(run_id, "standards", "sonar-deep-research");
            return; // Ticker continues asynchronously and re-enters at docgen.
          } else if (phase === "docgen") {
            if (!aggregated) aggregated = await aggregator(run_id);
            if (!design || !verification || !standards) throw new Error("Missing prior phases");
            const { report, structured } = await withRetry(() => docgenPhase(aggregated!, design, verification, standards));
            await updateRun(run_id, { final_report: report, docgen_blueprint: structured });
            await recordModel(run_id, "docgen", "sonar-pro");
          }
          await setPhase(run_id, phase, "done");
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`Phase ${phase} failed:`, msg);
          await setPhase(run_id, phase, "error", msg);
          return;
        }
      }
      await updateRun(run_id, { status: "done", current_phase: "done", completed_at: new Date().toISOString() });
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
