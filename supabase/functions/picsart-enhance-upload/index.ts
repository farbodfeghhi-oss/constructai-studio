// Phase 6c — Picsart Programmable Image API: enhance a CAD upload from Phase 1.
// Pipeline: Ultra Upscale → Remove Background v10 → (optional) Shadow.
// All requests use application/json with image_url; only the initial upload uses binary.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { picsartHeaders, picsartPostJson, pollPicsart, extractImageUrl } from "../_shared/picsart/client.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TOOLS_BASE = "https://api.picsart.io/tools/1.0";

type Opts = { upscale?: boolean; remove_bg?: boolean; shadow?: boolean };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { run_id, source_path, options = {} } = await req.json() as { run_id: string; source_path: string; options?: Opts };
    if (!run_id || !source_path) return json({ error: "missing run_id or source_path" }, 400);
    const opts: Opts = { upscale: true, remove_bg: true, shadow: false, ...options };

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: run, error: runErr } = await admin
      .from("analysis_runs").select("*")
      .eq("id", run_id).eq("user_id", user.id).maybeSingle();
    if (runErr || !run) return json({ error: "Run not found" }, 404);

    if (!(run as any).file_paths?.includes(source_path)) {
      return json({ error: "source_path not part of this run" }, 400);
    }

    // Build a temporary signed URL Picsart can fetch from.
    const { data: sourceSigned, error: srcErr } = await admin.storage.from("analysis-uploads")
      .createSignedUrl(source_path, 60 * 60);
    if (srcErr || !sourceSigned?.signedUrl) throw new Error(`Cannot sign source: ${srcErr?.message ?? "unknown"}`);
    let currentUrl = sourceSigned.signedUrl;

    const steps: string[] = [];

    // 1) Ultra Upscale (async). Picsart accepts JSON with image_url.
    if (opts.upscale) {
      const sub = await picsartPostJson<any>(`${TOOLS_BASE}/upscale/ultra`, {
        image_url: currentUrl,
        upscale_factor: 2,
        format: "PNG",
      });
      // Some endpoints return inline result, some return transaction_id
      const inline = extractImageUrl(sub);
      if (inline) currentUrl = inline;
      else {
        const txId = sub?.transaction_id || sub?.inference_id || sub?.id;
        if (!txId) throw new Error("Upscale: no result url and no transaction id");
        const polled = await pollPicsart<any>(`${TOOLS_BASE}/upscale/ultra/${txId}`, { intervalMs: 3000, maxAttempts: 60 });
        currentUrl = extractImageUrl(polled);
        if (!currentUrl) throw new Error("Upscale finished but no url");
      }
      steps.push("upscale-ultra");
    }

    // 2) Remove Background v10 (sync). JSON body.
    if (opts.remove_bg) {
      const sub = await picsartPostJson<any>(`${TOOLS_BASE}/removebg`, {
        image_url: currentUrl,
        output_type: "cutout",
        bg_blur: 0,
        format: "PNG",
        model: "v10",
        ...(opts.shadow ? { shadow: "bottomright" } : {}),
      });
      const out = extractImageUrl(sub);
      if (!out) throw new Error("removebg: no url returned");
      currentUrl = out;
      steps.push(opts.shadow ? "removebg-v10+shadow" : "removebg-v10");
    }

    // Download + re-upload
    const r = await fetch(currentUrl);
    if (!r.ok) throw new Error(`Enhanced image download failed: ${r.status}`);
    const bytes = new Uint8Array(await r.arrayBuffer());
    const filename = `enhanced-${Date.now()}.png`;
    const path = `${user.id}/generated/${run_id}/${filename}`;
    const { error: upErr } = await admin.storage.from("analysis-uploads")
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upErr) throw new Error(`Storage upload: ${upErr.message}`);

    const { data: signed } = await admin.storage.from("analysis-uploads").createSignedUrl(path, 60 * 60 * 24 * 7);
    const url = signed?.signedUrl ?? currentUrl;

    const entry = {
      url, path,
      kind: "cad_enhanced",
      label: `CAD-Enhanced (${steps.join(" + ") || "raw"})`,
      source_path,
      options: opts,
      steps,
      prompt: `enhance:${steps.join("+")}`,
      created_at: new Date().toISOString(),
    };
    const existing = Array.isArray((run as any).generated_images) ? (run as any).generated_images : [];
    const models_used = { ...((run as any).models_used ?? {}), picsart_enhance: steps.join("+") || "raw" };
    await admin.from("analysis_runs")
      .update({ generated_images: [...existing, entry], models_used })
      .eq("id", run_id);

    return json({ ok: true, image: entry });
  } catch (e) {
    console.error("picsart-enhance-upload:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
