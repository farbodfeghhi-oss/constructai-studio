// Phase 6a — Picsart AI Hub: Text2Image (recraftv4 / flux-2-pro) for concept sketches.
// Uses ONLY the short isolated `picsart_image_prompt` produced by agent-docgen (Phase 5),
// never the full engineering report.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { picsartHeaders, picsartPostJson, pollPicsart, extractImageUrl } from "../_shared/picsart/client.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const GENAI_BASE = "https://genai-api.picsart.io/v1";
const ALLOWED_MODELS = ["recraftv4", "flux-2-pro"] as const;
type Model = typeof ALLOWED_MODELS[number];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { run_id, model = "recraftv4", prompt_override } = await req.json();
    if (!run_id) return json({ error: "missing run_id" }, 400);
    if (!ALLOWED_MODELS.includes(model)) return json({ error: `model must be one of ${ALLOWED_MODELS.join(", ")}` }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: run, error: runErr } = await admin
      .from("analysis_runs").select("*")
      .eq("id", run_id).eq("user_id", user.id).maybeSingle();
    if (runErr || !run) return json({ error: "Run not found" }, 404);

    // ONLY use the isolated picsart_image_prompt from docgen — never the long report.
    const dg = (run as any).design_blueprint ?? {};
    const structured = (run as any).docgen_structured ?? dg?.docgen_structured ?? {};
    const isolated =
      prompt_override ??
      structured?.picsart_image_prompt ??
      dg?.picsart_image_prompt ??
      buildFallbackPrompt(String(run.prompt ?? ""));

    const prompt = String(isolated).slice(0, 800);

    // 1) Submit to AI Hub Text2Image
    const submit = await picsartPostJson<any>(`${GENAI_BASE}/text2image`, {
      model,
      prompt,
      negative_prompt: "blurry, low quality, watermark, distorted text, deformed",
      width: 1024,
      height: 1024,
      count: 1,
    });
    const inferenceId: string = submit.inference_id || submit.id;
    if (!inferenceId) throw new Error("Picsart returned no inference_id");

    // 2) Poll with standardized status whitelist (processing|success|error)
    const result = await pollPicsart<any>(`${GENAI_BASE}/text2image/inferences/${inferenceId}`, {
      intervalMs: 2000, maxAttempts: 60,
    });
    const imgUrl = extractImageUrl(result);
    if (!imgUrl) throw new Error("Picsart finished but no image url found");

    // 3) Re-upload to private bucket
    const imgResp = await fetch(imgUrl);
    if (!imgResp.ok) throw new Error(`Image download failed: ${imgResp.status}`);
    const bytes = new Uint8Array(await imgResp.arrayBuffer());
    const filename = `concept-${model}-${Date.now()}.png`;
    const path = `${user.id}/generated/${run_id}/${filename}`;
    const { error: upErr } = await admin.storage.from("analysis-uploads")
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upErr) throw new Error(`Storage upload: ${upErr.message}`);

    const { data: signed } = await admin.storage.from("analysis-uploads").createSignedUrl(path, 60 * 60 * 24 * 7);
    const url = signed?.signedUrl ?? imgUrl;

    const entry = {
      url, path, prompt, model,
      kind: "concept_sketch",
      label: `Konzept-Skizze (${model})`,
      created_at: new Date().toISOString(),
    };
    const existing = Array.isArray((run as any).generated_images) ? (run as any).generated_images : [];
    const models_used = { ...((run as any).models_used ?? {}), picsart_concept: model };
    await admin.from("analysis_runs")
      .update({ generated_images: [...existing, entry], models_used })
      .eq("id", run_id);

    return json({ ok: true, image: entry });
  } catch (e) {
    console.error("picsart-concept-sketch:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function buildFallbackPrompt(userPrompt: string): string {
  const head = userPrompt.slice(0, 200);
  return `clean technical vector illustration of: ${head}. blueprint style, white background, no text, sharp lines, DIN/ISO engineering aesthetic.`;
}
