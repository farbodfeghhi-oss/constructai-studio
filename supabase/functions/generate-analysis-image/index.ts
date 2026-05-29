// Generate a Picsart image (technical drawing / documentation) from an analysis run.
// Stores the image in analysis-uploads/${user_id}/generated/ and appends to analysis_runs.generated_images.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PICSART_API_KEY = Deno.env.get("PICSART_API_KEY")!;

type Kind = "technical_drawing" | "documentation" | "isometric_render" | "exploded_view";

const KIND_LABEL: Record<Kind, string> = {
  technical_drawing: "Technische Zeichnung",
  documentation: "Dokumentations-Bild",
  isometric_render: "Isometrische Darstellung",
  exploded_view: "Explosionszeichnung",
};

function buildPrompt(kind: Kind, summary: string): string {
  const head = summary.slice(0, 1200);
  switch (kind) {
    case "technical_drawing":
      return `Professional DIN/ISO technical engineering drawing, black ink on pure white background, orthographic views (top, front, side) with dimension lines, tolerances and surface symbols, title block lower right. Subject derived from this engineering report: "${head}". Style: CAD draftsman line art (Solid Edge / AutoCAD), millimetres, ultra sharp 8K, no color.`;
    case "documentation":
      return `Professional engineering documentation illustration on light grid background, clean isometric line art with labeled callouts, German labels, blue and orange accents. Subject from report: "${head}". Style: corporate technical manual, IKEA-meets-Bosch, sans-serif typography, 8K.`;
    case "isometric_render":
      return `Photorealistic 3D isometric CAD product render of the assembly described here: "${head}". Stainless steel and aluminium materials, studio lighting, light grey background, sharp shadows, 8K product visualization.`;
    case "exploded_view":
      return `Engineering exploded-view illustration with numbered callouts (1,2,3...) and assembly arrows of the parts described here: "${head}". Style: clean line art on white, blue accents, German labels, 8K technical poster.`;
  }
}

async function picsart(prompt: string): Promise<string> {
  const submit = await fetch("https://genai-api.picsart.io/v1/text2image", {
    method: "POST",
    headers: {
      "X-Picsart-API-Key": PICSART_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      prompt,
      negative_prompt: "blurry, low quality, watermark, text artifacts, distorted",
      width: 1024,
      height: 1024,
      count: 1,
    }),
  });
  if (!submit.ok) throw new Error(`Picsart submit ${submit.status}: ${await submit.text()}`);
  const sd = await submit.json();
  const inferenceId: string = sd.inference_id || sd.id;
  if (!inferenceId) throw new Error("Picsart returned no inference_id");

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`https://genai-api.picsart.io/v1/text2image/inferences/${inferenceId}`, {
      headers: { "X-Picsart-API-Key": PICSART_API_KEY, Accept: "application/json" },
    });
    if (!poll.ok) continue;
    const pd = await poll.json();
    const status = String(pd.status ?? "").toUpperCase();
    if (status === "DONE" || status === "FINISHED" || status === "SUCCESS") {
      const url = pd.data?.[0]?.url || pd.images?.[0]?.url || pd.result?.[0]?.url || pd.urls?.[0];
      if (!url) throw new Error("Picsart finished but no url");
      return url;
    }
    if (status === "FAILED" || status === "ERROR") throw new Error(`Picsart failed: ${JSON.stringify(pd)}`);
  }
  throw new Error("Picsart timeout");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { run_id, kind = "technical_drawing", prompt_override } = await req.json();
    if (!run_id) return new Response(JSON.stringify({ error: "missing run_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: run, error: runErr } = await admin.from("analysis_runs").select("*").eq("id", run_id).eq("user_id", user.id).maybeSingle();
    if (runErr || !run) return new Response(JSON.stringify({ error: "Run not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const summary = String(run.final_report ?? run.design_blueprint?.content ?? run.prompt ?? "");
    const prompt = String(prompt_override ?? buildPrompt(kind as Kind, summary));

    const picsartUrl = await picsart(prompt);

    // Download and re-upload to our private bucket
    const imgResp = await fetch(picsartUrl);
    if (!imgResp.ok) throw new Error(`Image download failed: ${imgResp.status}`);
    const bytes = new Uint8Array(await imgResp.arrayBuffer());
    const filename = `${kind}-${Date.now()}.png`;
    const path = `${user.id}/generated/${run_id}/${filename}`;
    const { error: upErr } = await admin.storage.from("analysis-uploads").upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upErr) throw new Error(`Storage upload: ${upErr.message}`);

    const { data: signed } = await admin.storage.from("analysis-uploads").createSignedUrl(path, 60 * 60 * 24 * 7);
    const url = signed?.signedUrl ?? picsartUrl;

    const entry = { url, path, prompt, kind, label: KIND_LABEL[kind as Kind] ?? kind, created_at: new Date().toISOString() };
    const existing = Array.isArray(run.generated_images) ? run.generated_images : [];
    await admin.from("analysis_runs").update({ generated_images: [...existing, entry] }).eq("id", run_id);

    return new Response(JSON.stringify({ ok: true, image: entry }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-analysis-image:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
