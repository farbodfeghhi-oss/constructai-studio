// Phase 6b — Picsart Variable Data Content API: render a real data sheet
// (PNG via replay/export, or PDF via replay2pdf) from a pre-built Picsart template.
// Variables come from agent-docgen's `data_sheet_variables` map — texts are RENDERED, not generated.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { picsartPostJson, pollPicsart, extractImageUrl } from "../_shared/picsart/client.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const VDC_BASE = "https://api.picsart.io/v1"; // Variable Data Content endpoints

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { run_id, format = "pdf", variables_override, template_id_override } = await req.json();
    if (!run_id) return json({ error: "missing run_id" }, 400);
    if (!["pdf", "png"].includes(format)) return json({ error: "format must be pdf or png" }, 400);

    const templateId = template_id_override ?? Deno.env.get("PICSART_DATASHEET_TEMPLATE_ID");
    if (!templateId) return json({ error: "PICSART_DATASHEET_TEMPLATE_ID not configured. Create a Replay template in Picsart Studio first." }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: run, error: runErr } = await admin
      .from("analysis_runs").select("*")
      .eq("id", run_id).eq("user_id", user.id).maybeSingle();
    if (runErr || !run) return json({ error: "Run not found" }, 404);

    const dg = (run as any).design_blueprint ?? {};
    const structured = (run as any).docgen_structured ?? dg?.docgen_structured ?? {};
    const variables: Record<string, string> =
      variables_override ??
      structured?.data_sheet_variables ??
      dg?.data_sheet_variables ?? {};

    if (!variables || Object.keys(variables).length === 0) {
      return json({ error: "No data_sheet_variables available. Re-run docgen first." }, 400);
    }

    // Stringify all values — Picsart Replay variables are strings.
    const cleanVars: Record<string, string> = {};
    for (const [k, v] of Object.entries(variables)) cleanVars[String(k)] = String(v ?? "");

    // Step A: apply variables → replay_id
    const apply = await picsartPostJson<any>(`${VDC_BASE}/replay/apply-variables`, {
      template_id: templateId,
      variables: cleanVars,
    });
    const replayId: string = apply.replay_id || apply.id;
    if (!replayId) throw new Error("Picsart returned no replay_id");

    // Step B: export PDF or PNG
    const exportEndpoint = format === "pdf" ? `${VDC_BASE}/replay2pdf` : `${VDC_BASE}/replay/export`;
    const exportSubmit = await picsartPostJson<any>(exportEndpoint, {
      replay_id: replayId,
      ...(format === "png" ? { format: "png" } : {}),
    });

    // Inline result?
    let resultUrl = extractImageUrl(exportSubmit) || exportSubmit?.pdf_url || exportSubmit?.file_url;
    if (!resultUrl) {
      const pollUrl: string =
        exportSubmit?.poll_url ||
        (exportSubmit?.inference_id || exportSubmit?.id
          ? `${exportEndpoint}/inferences/${exportSubmit.inference_id || exportSubmit.id}`
          : "");
      if (!pollUrl) throw new Error("Picsart export returned no url and no poll id");
      const polled = await pollPicsart<any>(pollUrl, { intervalMs: 2000, maxAttempts: 60 });
      resultUrl = extractImageUrl(polled) || polled?.pdf_url || polled?.file_url;
    }
    if (!resultUrl) throw new Error("Picsart export produced no result url");

    // Download + re-upload
    const r = await fetch(resultUrl);
    if (!r.ok) throw new Error(`Result download failed: ${r.status}`);
    const bytes = new Uint8Array(await r.arrayBuffer());
    const ext = format === "pdf" ? "pdf" : "png";
    const mime = format === "pdf" ? "application/pdf" : "image/png";
    const filename = `datasheet-${Date.now()}.${ext}`;
    const path = `${user.id}/generated/${run_id}/${filename}`;
    const { error: upErr } = await admin.storage.from("analysis-uploads")
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (upErr) throw new Error(`Storage upload: ${upErr.message}`);

    const { data: signed } = await admin.storage.from("analysis-uploads").createSignedUrl(path, 60 * 60 * 24 * 7);
    const url = signed?.signedUrl ?? resultUrl;

    const entry = {
      url, path,
      kind: "data_sheet",
      label: `Datenblatt (${format.toUpperCase()})`,
      template_id: templateId,
      variables: cleanVars,
      format,
      mime,
      prompt: `template:${templateId}`,
      created_at: new Date().toISOString(),
    };
    const existing = Array.isArray((run as any).generated_images) ? (run as any).generated_images : [];
    const models_used = { ...((run as any).models_used ?? {}), picsart_datasheet: `replay-template:${templateId}` };
    await admin.from("analysis_runs")
      .update({ generated_images: [...existing, entry], models_used })
      .eq("id", run_id);

    return json({ ok: true, image: entry });
  } catch (e) {
    console.error("picsart-datasheet:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
