import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Asset definitions: key + prompt for Picsart
const ASSETS: Array<{ key: string; prompt: string }> = [
  {
    key: "hero",
    prompt:
      "Ultra-wide cinematic dark navy blueprint background with glowing electric blue isometric CAD wireframes of mechanical assemblies, gears, sheet metal brackets and exploded views, subtle orange accent highlights, technical grid lines, depth of field, photorealistic engineering visualization, 8K, no text",
  },
  { key: "cap_loesung", prompt: "Glowing holographic icon of a mechanical gear with blue and orange light, dark navy background, premium 3D render, no text" },
  { key: "cap_analysis", prompt: "Glowing holographic icon of a neural network connected to a CAD blueprint, electric blue with orange sparks, dark navy background, premium 3D render, no text" },
  { key: "cap_knowledge", prompt: "Glowing holographic icon of a stack of technical books with circuit patterns, blue with orange highlights, dark navy background, premium 3D render, no text" },
  { key: "cap_components", prompt: "Glowing holographic icon of mechanical bolts and bearings exploded view, blue with orange accents, dark navy background, premium 3D render, no text" },
  { key: "cap_docs", prompt: "Glowing holographic icon of a technical drawing with dimension lines on a paper, blue and orange light, dark navy background, premium 3D render, no text" },
  { key: "cap_roles", prompt: "Glowing holographic icon of a shield with AI circuit core, electric blue and orange, dark navy background, premium 3D render, no text" },
];

async function picsart(apiKey: string, prompt: string): Promise<string> {
  const submit = await fetch("https://genai-api.picsart.io/v1/text2image", {
    method: "POST",
    headers: { "X-Picsart-API-Key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      prompt,
      negative_prompt: "blurry, low quality, watermark, text, letters, distorted",
      width: 1024,
      height: 1024,
      count: 1,
    }),
  });
  if (!submit.ok) throw new Error(`picsart submit ${submit.status}: ${await submit.text()}`);
  const sd = await submit.json();
  const id = sd.inference_id || sd.id;
  if (!id) throw new Error("no inference_id");
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`https://genai-api.picsart.io/v1/text2image/inferences/${id}`, {
      headers: { "X-Picsart-API-Key": apiKey, Accept: "application/json" },
    });
    if (!poll.ok) continue;
    const pd = await poll.json();
    const st = (pd.status || "").toUpperCase();
    if (["DONE", "FINISHED", "SUCCESS"].includes(st)) {
      const url = pd.data?.[0]?.url || pd.images?.[0]?.url || pd.result?.[0]?.url || pd.urls?.[0];
      if (!url) throw new Error("no url");
      return url as string;
    }
    if (["FAILED", "ERROR"].includes(st)) throw new Error(`picsart failed: ${JSON.stringify(pd)}`);
  }
  throw new Error("picsart timeout");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const pics = Deno.env.get("PICSART_API_KEY");
    if (!pics) throw new Error("PICSART_API_KEY not configured");

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData.user;
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;
    const onlyKeys: string[] | null = Array.isArray(body?.keys) && body.keys.length > 0
      ? body.keys.filter((k: unknown): k is string => typeof k === "string")
      : null;

    const admin = createClient(url, srv);
    const { data: existing } = await admin.from("dashboard_assets").select("key, image_url").eq("user_id", user.id);
    const have = new Map((existing ?? []).map((r: any) => [r.key, r.image_url]));

    const targetAssets = onlyKeys ? ASSETS.filter((a) => onlyKeys.includes(a.key)) : ASSETS;
    const results: Record<string, string> = {};
    for (const a of targetAssets) {
      const forceThis = force || (onlyKeys !== null);
      if (!forceThis && have.has(a.key)) {
        results[a.key] = have.get(a.key) as string;
        continue;
      }
      try {
        const imgUrl = await picsart(pics, a.prompt);
        await admin.from("dashboard_assets").upsert(
          { user_id: user.id, key: a.key, image_url: imgUrl, prompt: a.prompt },
          { onConflict: "user_id,key" },
        );
        results[a.key] = imgUrl;
      } catch (e) {
        console.error(`asset ${a.key} failed:`, e);
        // Keep going; frontend will fall back to gradient placeholder.
      }
    }

    return new Response(JSON.stringify({ assets: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("dashboard-assets error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
