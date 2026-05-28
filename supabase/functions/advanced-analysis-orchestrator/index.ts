import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY")!;
const MONICA_API_KEY = Deno.env.get("MONICA_API_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Phase = "aggregator" | "gemini" | "perplexity" | "monica";
const PHASES: Phase[] = ["aggregator", "gemini", "perplexity", "monica"];

async function updateRun(runId: string, patch: Record<string, unknown>) {
  await admin.from("analysis_runs").update({ ...patch }).eq("id", runId);
}

async function setPhase(runId: string, phase: Phase, status: string, error?: string) {
  const { data } = await admin.from("analysis_runs").select("phase_status").eq("id", runId).single();
  const ps = (data?.phase_status as Record<string, unknown>) ?? {};
  ps[phase] = { status, ...(error ? { error } : {}) };
  await admin.from("analysis_runs").update({
    phase_status: ps,
    current_phase: phase,
    status: status === "error" ? "error" : (phase === "monica" && status === "done") ? "done" : "running",
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

async function aggregator(runId: string) {
  const { data: run } = await admin.from("analysis_runs").select("*").eq("id", runId).single();
  if (!run) throw new Error("Run not found");

  // References
  let references: Array<{ id: string; title: string; category: string; content: string }> = [];
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

  // Files: signed URLs + small inline base64 for images/pdf (limit)
  const files: Array<{ path: string; signed_url: string; mime: string; name: string }> = [];
  for (const path of run.file_paths ?? []) {
    const { data: signed } = await admin.storage.from("analysis-uploads").createSignedUrl(path, 60 * 60);
    const name = path.split("/").pop() ?? path;
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const mime = ext === "pdf" ? "application/pdf"
      : ext === "png" ? "image/png"
      : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
      : ext === "webp" ? "image/webp"
      : "application/octet-stream";
    files.push({ path, signed_url: signed?.signedUrl ?? "", mime, name });
  }

  return { prompt: run.prompt, references, files };
}

async function geminiPhase(ctx: Awaited<ReturnType<typeof aggregator>>) {
  const userContent: any[] = [
    { type: "text", text:
`Du erhältst eine Engineering-Anfrage mit Dateien (CAD/PDF/Bilder) und Referenz-Standards.

USER-PROMPT:
${ctx.prompt}

AKTIVE REFERENZEN (${ctx.references.length}):
${ctx.references.map((r) => `- [${r.category}] ${r.title}\n  ${r.content.slice(0, 800)}`).join("\n")}

Analysiere die Dateien und Constraints. Cross-referenziere mit den Standards. Extrahiere präzise Engineering-Constraints, erkenne Anomalien und gib einen strukturierten Technical Blueprint des Ist-Zustands und der nötigen Änderungen aus.

Antworte als JSON mit Feldern: { "summary", "constraints":[], "detected_anomalies":[], "current_state":{}, "required_changes":[], "standards_referenced":[] }.` },
  ];
  for (const f of ctx.files) {
    if (f.mime.startsWith("image/")) {
      userContent.push({ type: "image_url", image_url: { url: f.signed_url } });
    } else {
      userContent.push({ type: "text", text: `Datei (${f.mime}): ${f.name}\nURL: ${f.signed_url}` });
    }
  }

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: "Du bist ein Senior Mechanical/Electrical Engineer mit Fokus auf multimodale CAD- und Dokumenten-Analyse. Antworte ausschließlich mit validem JSON ohne Markdown-Fences." },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) throw new Error(`Gemini HTTP ${resp.status}: ${await resp.text()}`);
  const json = await resp.json();
  const text = json.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function perplexityPhase(blueprint: unknown, ctx: { references: any[] }) {
  const resp = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        { role: "system", content: "Act as a Lead Engineering Reviewer. Validate against current global engineering standards (ASME, IEEE, ISO, DIN, EN). Be precise, cite sources." },
        { role: "user", content:
`Validiere folgenden Engineering Blueprint gegen aktuelle Standards und Codes.

BLUEPRINT:
${JSON.stringify(blueprint).slice(0, 12000)}

REFERENZIERTE STANDARDS DES NUTZERS:
${ctx.references.map((r) => `- ${r.title}`).join("\n") || "(keine)"}

Liefere:
1. Standards-Validierung (welche Normen treffen zu, Konformität ja/nein, Verstöße)
2. Material-Eigenschaften & Daten in Echtzeit
3. Feasibility-Risiken
4. Empfehlungen

Antworte strukturiert in Markdown.` },
      ],
      max_tokens: 4000,
    }),
  });
  if (!resp.ok) throw new Error(`Perplexity HTTP ${resp.status}: ${await resp.text()}`);
  const json = await resp.json();
  return {
    content: json.choices?.[0]?.message?.content ?? "",
    citations: json.citations ?? [],
  };
}

async function monicaPhase(blueprint: unknown, validation: { content: string; citations: string[] }, prompt: string) {
  const resp = await fetch("https://openapi.monica.im/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${MONICA_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      messages: [
        { role: "system", content: "Du bist ein Senior Consulting Engineer (15+ Jahre). Erzeuge hochprofessionelle, umsetzbare Engineering-Reports. Antworte in präzisem, gut strukturiertem Deutsch in Markdown mit Überschriften, Tabellen und Code-Blöcken." },
        { role: "user", content:
`Synthetisiere die multimodale Analyse (KI 1) und die Standards-Validierung (KI 2) zu einem finalen Engineering Report.

URSPRÜNGLICHE ANFRAGE:
${prompt}

KI-1 BLUEPRINT (Gemini):
${JSON.stringify(blueprint).slice(0, 10000)}

KI-2 VALIDIERUNG (Perplexity):
${validation.content.slice(0, 10000)}

ZITATE:
${validation.citations.slice(0, 10).join("\n")}

Erzeuge den Report mit folgender Struktur (Markdown):
# Executive Summary
## 1. CAD Modification Guide
## 2. Electrical/Mechanical Optimizations
## 3. Step-by-step Implementation Plan
## 4. Risiken & Standards-Konformität
## 5. Anhang: Quellen` },
      ],
      max_tokens: 6000,
    }),
  });
  if (!resp.ok) throw new Error(`Monica HTTP ${resp.status}: ${await resp.text()}`);
  const json = await resp.json();
  return json.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { run_id, start_phase = "aggregator" } = await req.json();
  if (!run_id) return new Response("missing run_id", { status: 400, headers: corsHeaders });

  // Respond immediately, continue in background
  const work = (async () => {
    const startIdx = PHASES.indexOf(start_phase as Phase);
    let aggregated: any = null;
    let blueprint: any = null;
    let validation: any = null;

    // If resuming, load existing
    const { data: existing } = await admin.from("analysis_runs").select("*").eq("id", run_id).single();
    if (!existing) return;
    blueprint = existing.gemini_blueprint;
    validation = existing.perplexity_validation;

    try {
      for (let i = startIdx; i < PHASES.length; i++) {
        const phase = PHASES[i];
        await setPhase(run_id, phase, "running");
        try {
          if (phase === "aggregator") {
            aggregated = await withRetry(() => aggregator(run_id));
          } else if (phase === "gemini") {
            if (!aggregated) aggregated = await aggregator(run_id);
            blueprint = await withRetry(() => geminiPhase(aggregated));
            await updateRun(run_id, { gemini_blueprint: blueprint });
          } else if (phase === "perplexity") {
            if (!aggregated) aggregated = await aggregator(run_id);
            if (!blueprint) throw new Error("Missing Gemini blueprint");
            validation = await withRetry(() => perplexityPhase(blueprint, aggregated));
            await updateRun(run_id, { perplexity_validation: validation });
          } else if (phase === "monica") {
            if (!blueprint || !validation) throw new Error("Missing prior phases");
            const report = await withRetry(() => monicaPhase(blueprint, validation, existing.prompt));
            await updateRun(run_id, { monica_report: report });
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

  // @ts-ignore - EdgeRuntime is available in Supabase
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
  else work.catch(console.error);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
