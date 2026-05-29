// Agent 1: Mechanik-Design & Lösungs-Generator
// Perplexity Agent API · multimodal · models: ["anthropic/claude-opus-4-7","openai/gpt-5.5"] (max 5)
// Images: PNG/JPEG/WEBP/GIF, ≤50MB, via image_url (HTTPS URL or data:image/...;base64,...)

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callAgent, callSonar, type AgentInputItem } from "../_shared/perplexity/client.ts";
import { extractCitations } from "../_shared/perplexity/citations.ts";
import { ANTI_HALLUCINATION, loadRolePlan } from "../_shared/perplexity/prompts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_BYTES = 50 * 1024 * 1024;

function normalizeImage(img: any): { url: string } {
  // Accept either { url } or { image_url: { url } } or { image_url: "..." } or raw string.
  if (typeof img === "string") return { url: img };
  const url = img?.url ?? img?.image_url?.url ?? img?.image_url;
  if (typeof url !== "string") throw new Error("Bild ohne gültige URL");
  return { url };
}

function validateImage(img: { url: string }): void {
  const m = img.url.match(/^data:([^;]+);base64,(.+)$/);
  if (m) {
    if (!ALLOWED_MIME.has(m[1].toLowerCase())) {
      throw new Error(`Bildformat nicht unterstützt: ${m[1]} (erlaubt: PNG, JPEG, WEBP, GIF)`);
    }
    const bytes = Math.floor((m[2].length * 3) / 4);
    if (bytes > MAX_BYTES) throw new Error(`Bild zu groß: ${bytes} Bytes (max 50 MB)`);
  } else if (!/^https:\/\//i.test(img.url)) {
    throw new Error("Bild-URL muss HTTPS oder data:image/...;base64,... sein");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { prompt, images = [], plan_key } = body as {
      prompt: string;
      images?: Array<{ url: string }>;
      plan_key?: string;
    };

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt erforderlich" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const normImages = (images as any[]).map(normalizeImage);
    for (const img of normImages) validateImage(img);

    const plan = (await loadRolePlan(admin, plan_key ?? "mech_design_agent")) ?? null;
    const systemPrompt = (plan?.system_prompt ?? "") + "\n\n" + ANTI_HALLUCINATION;

    const modelsArray: string[] = Array.isArray(plan?.models?.array) && plan.models.array.length
      ? plan.models.array
      : ["anthropic/claude-opus-4-7", "openai/gpt-5.5"];

    // OpenAI-compatible content parts: text + image_url (image_url as object with .url)
    const content: AgentInputItem[] = [{ type: "text", text: prompt }];
    for (const img of normImages) content.push({ type: "image_url", image_url: { url: img.url } });

    let resp: any;
    let modeUsed: "agent" | "sonar-vision";

    if (normImages.length > 0) {
      // Multimodal path → sonar-pro on /chat/completions (Agent API rejects image parts).
      modeUsed = "sonar-vision";
      resp = await callSonar({
        model: "sonar-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: content as any },
        ],
      });
    } else {
      // Text-only path → Agent API with multi-model fallback + web_search.
      modeUsed = "agent";
      resp = await callAgent({
        models: modelsArray.slice(0, 5),
        instructions: systemPrompt,
        input: [{ role: "user", content }],
        tools: (plan?.tools ?? [{ type: "web_search" }]) as Array<{ type: string }>,
        max_steps: plan?.max_steps ?? 6,
      });
    }

    // Extract assistant text from either response shape.
    let text: string = resp?.output_text ?? "";
    if (!text && Array.isArray(resp?.output)) {
      for (const item of resp.output) {
        if (item?.type === "message" || item?.role === "assistant") {
          const part = item.content?.find?.((c: any) => c.type === "output_text") ?? item.content?.[0];
          if (part?.text) text = part.text;
        }
      }
    }
    if (!text) text = resp?.choices?.[0]?.message?.content ?? "";
    const citations = extractCitations(resp);

    return new Response(JSON.stringify({
      ok: true,
      mode: modeUsed,
      model_used: resp?.model ?? (modeUsed === "sonar-vision" ? "sonar-pro" : modelsArray[0]),
      content: text,
      citations,
      raw: resp,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("agent-design error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
