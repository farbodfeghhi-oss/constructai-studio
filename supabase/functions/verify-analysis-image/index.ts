// Technical verifier for Picsart-generated images.
// 1) Loads the existing generated image + analysis-run context
// 2) Sends image + report to Perplexity sonar-pro (multimodal) acting as Senior Engineering Reviewer
// 3) Receives verdict (ok|needs_revision) + improved Picsart prompt
// 4) If needs_revision → calls Picsart again with the improved prompt and stores a new image entry
//    referencing the original via parent_index. Appends verification metadata to original entry.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callSonar } from "../_shared/perplexity/client.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PICSART_API_KEY = Deno.env.get("PICSART_API_KEY")!;

const KIND_LABEL: Record<string, string> = {
  technical_drawing: "Technische Zeichnung",
  documentation: "Dokumentations-Bild",
  isometric_render: "Isometrische Darstellung",
  exploded_view: "Explosionszeichnung",
};

async function picsart(prompt: string): Promise<string> {
  const submit = await fetch("https://genai-api.picsart.io/v1/text2image", {
    method: "POST",
    headers: { "X-Picsart-API-Key": PICSART_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      prompt,
      negative_prompt: "blurry, low quality, watermark, text artifacts, distorted, wrong proportions",
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

function parseVerdict(content: string): { verdict: "ok" | "needs_revision"; notes: string; issues: string[]; improved_prompt: string } {
  // Try to extract a JSON block
  const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) ?? content.match(/\{[\s\S]*"improved_prompt"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const raw = jsonMatch[1] ?? jsonMatch[0];
      const obj = JSON.parse(raw);
      return {
        verdict: obj.verdict === "ok" ? "ok" : "needs_revision",
        notes: String(obj.notes ?? ""),
        issues: Array.isArray(obj.issues) ? obj.issues.map(String) : [],
        improved_prompt: String(obj.improved_prompt ?? ""),
      };
    } catch { /* fallthrough */ }
  }
  return { verdict: "needs_revision", notes: content.slice(0, 800), issues: [], improved_prompt: "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { run_id, image_index } = await req.json();
    if (!run_id || typeof image_index !== "number") {
      return new Response(JSON.stringify({ error: "missing run_id or image_index" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: run, error: runErr } = await admin.from("analysis_runs").select("*").eq("id", run_id).eq("user_id", user.id).maybeSingle();
    if (runErr || !run) return new Response(JSON.stringify({ error: "Run not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const images: any[] = Array.isArray(run.generated_images) ? run.generated_images : [];
    const target = images[image_index];
    if (!target) return new Response(JSON.stringify({ error: "Image not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Always refresh signed URL via storage path for stable vision-API access
    let visionUrl = target.url;
    if (target.path) {
      const { data: signed } = await admin.storage.from("analysis-uploads").createSignedUrl(target.path, 60 * 60);
      if (signed?.signedUrl) visionUrl = signed.signedUrl;
    }

    const reportContext = String(run.final_report ?? run.design_blueprint?.content ?? run.prompt ?? "").slice(0, 4000);
    const kindLabel = KIND_LABEL[target.kind] ?? target.kind;

    const systemPrompt = `Du bist ein Senior Maschinenbau-Prüfingenieur (15+ Jahre DIN/ISO/EN, Solid Edge, Blechkonstruktion).
Deine Aufgabe: visuell und fachlich prüfen, ob das vorliegende AI-generierte Bild (${kindLabel}) das tatsächliche Engineering-Ergebnis korrekt darstellt.

PRÜFKRITERIEN:
- Stimmen Geometrie, Anzahl Teile, Proportionen, Materialdarstellung mit dem Report überein?
- Sind technische Konventionen eingehalten (Ansichten, Bemaßung, Schraffuren, Pfeile, Callouts)?
- Sind sichtbare Beschriftungen lesbar / sinnvoll oder Buchstabensalat?
- Bei technischer Zeichnung: orthographische Projektion korrekt, Schriftfeld vorhanden?

Antworte AUSSCHLIESSLICH mit gültigem JSON in einem \`\`\`json-Block:
{
  "verdict": "ok" | "needs_revision",
  "notes": "Kurze fachliche Bewertung in 2-3 Sätzen",
  "issues": ["konkretes Problem 1", "konkretes Problem 2"],
  "improved_prompt": "Vollständiger neuer englischer Picsart-Prompt (max 600 Zeichen), der die Probleme behebt. Bei verdict=ok leer lassen."
}`;

    const userPrompt = `KONTEXT (Engineering-Report-Auszug):
${reportContext}

URSPRÜNGLICHER PICSART-PROMPT:
${String(target.prompt ?? "").slice(0, 800)}

BILDTYP: ${kindLabel}

Prüfe das angehängte Bild gegen den Kontext und gib JSON-Verdict zurück.`;

    const verifyResp = await callSonar({
      model: "sonar-pro",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: visionUrl } },
          ],
        },
      ],
      max_tokens: 1500,
      temperature: 0.2,
    });

    const verifyContent: string = verifyResp?.choices?.[0]?.message?.content ?? "";
    const verdict = parseVerdict(verifyContent);

    // Annotate original image with verification metadata
    const annotated = [...images];
    annotated[image_index] = {
      ...target,
      verification: {
        verdict: verdict.verdict,
        notes: verdict.notes,
        issues: verdict.issues,
        model: "sonar-pro",
        checked_at: new Date().toISOString(),
      },
    };

    let newImageEntry: any = null;

    if (verdict.verdict === "needs_revision" && verdict.improved_prompt) {
      // Regenerate via Picsart with improved prompt
      const picsartUrl = await picsart(verdict.improved_prompt);
      const imgResp = await fetch(picsartUrl);
      if (!imgResp.ok) throw new Error(`Image download failed: ${imgResp.status}`);
      const bytes = new Uint8Array(await imgResp.arrayBuffer());
      const filename = `${target.kind}-revised-${Date.now()}.png`;
      const path = `${user.id}/generated/${run_id}/${filename}`;
      const { error: upErr } = await admin.storage.from("analysis-uploads").upload(path, bytes, { contentType: "image/png", upsert: false });
      if (upErr) throw new Error(`Storage upload: ${upErr.message}`);
      const { data: signed } = await admin.storage.from("analysis-uploads").createSignedUrl(path, 60 * 60 * 24 * 7);
      const url = signed?.signedUrl ?? picsartUrl;

      newImageEntry = {
        url,
        path,
        prompt: verdict.improved_prompt,
        kind: target.kind,
        label: `${KIND_LABEL[target.kind] ?? target.kind} (Revision)`,
        created_at: new Date().toISOString(),
        revised_from: image_index,
        revision_notes: verdict.notes,
      };
      annotated.push(newImageEntry);
    }

    await admin.from("analysis_runs").update({ generated_images: annotated }).eq("id", run_id);

    return new Response(JSON.stringify({
      ok: true,
      verdict: verdict.verdict,
      notes: verdict.notes,
      issues: verdict.issues,
      improved_prompt: verdict.improved_prompt,
      new_image: newImageEntry,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("verify-analysis-image:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
