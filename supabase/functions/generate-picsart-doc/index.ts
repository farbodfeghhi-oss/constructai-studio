import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Detailed German engineering prompts per document type.
// They are translated/expanded into a single English image prompt sent to Picsart.
const DOC_BUILDERS: Record<string, (l: any) => string> = {
  zeichnung: (l) =>
    `Professional technical engineering drawing (DIN/ISO standard), black ink on white background, top + front + side orthographic views with dimension lines, tolerances and surface symbols. Project: "${l.titel}". Components: ${(l.komponenten || []).map((k: any) => `${k.name} ${k.norm} ${k.material}`).join(", ")}. Style: clean CAD draftsman line art, Solid Edge / AutoCAD look, title block in lower right with project name, scale 1:1, all measurements in millimeters, ultra sharp 8K, no color, pure technical drawing.`,

  stueckliste: (l) =>
    `Professional engineering Bill of Materials (BOM) sheet rendered as a clean printable table on white paper. Title: "Stückliste – ${l.titel}". Columns: Pos | Bauteil | Norm | Material | Menge | Einzelpreis | Gesamtpreis. Rows: ${(l.komponenten || []).map((k: any, i: number) => `${i + 1}. ${k.name} | ${k.norm} | ${k.material} | ${k.menge} | ${k.preis}`).join(" ; ")}. Style: corporate engineering document, dark blue header row, monospaced numbers, DIN A4 portrait, crisp typography, photorealistic document scan, 8K detail.`,

  montage: (l) =>
    `Professional step-by-step technical assembly instruction poster, isometric exploded-view illustrations with numbered callouts (1,2,3...), arrows showing assembly direction, torque values in Nm, required tools shown as icons (hex key, wrench, screwdriver). Project: "${l.titel}". Components: ${(l.komponenten || []).map((k: any) => `${k.name} (${k.norm})`).join(", ")}. Style: IKEA-meets-Bosch service manual, line illustrations on light gray grid background, blue + orange accent color, clean sans-serif labels in German, 8K ultra detailed.`,

  praesentation: (l) =>
    `Professional engineering presentation slide cover, 16:9 aspect, dark navy blue background with subtle blueprint grid, large bold title "${l.titel}", subtitle "Konstruktionslösung – Maschinenbau", a clean 3D isometric CAD rendering of the assembly on the right (stainless steel with realistic lighting), key facts panel on the left listing main components (${(l.komponenten || []).slice(0, 4).map((k: any) => k.name).join(", ")}) and total cost ${l.kosten?.gesamt || ""}. Style: corporate keynote slide, Inter font, orange accent line, premium product visualization, 8K sharp.`,
};

const DOC_LABELS: Record<string, string> = {
  zeichnung: "Technische Zeichnung",
  stueckliste: "Stückliste",
  montage: "Montageanleitung",
  praesentation: "Präsentation",
};

async function generatePicsartImage(apiKey: string, prompt: string): Promise<string> {
  // 1. Submit inference
  const submit = await fetch("https://genai-api.picsart.io/v1/text2image", {
    method: "POST",
    headers: {
      "X-Picsart-API-Key": apiKey,
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

  if (!submit.ok) {
    const text = await submit.text();
    throw new Error(`Picsart submit failed (${submit.status}): ${text}`);
  }

  const submitData = await submit.json();
  const inferenceId: string = submitData.inference_id || submitData.id;
  if (!inferenceId) throw new Error("Picsart returned no inference_id");

  // 2. Poll for result (max ~60s)
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`https://genai-api.picsart.io/v1/text2image/inferences/${inferenceId}`, {
      headers: { "X-Picsart-API-Key": apiKey, Accept: "application/json" },
    });
    if (!poll.ok) continue;
    const pd = await poll.json();
    const status = (pd.status || "").toUpperCase();
    if (status === "DONE" || status === "FINISHED" || status === "SUCCESS") {
      const url = pd.data?.[0]?.url || pd.images?.[0]?.url || pd.result?.[0]?.url || pd.urls?.[0];
      if (!url) throw new Error("Picsart finished but no image url found");
      return url;
    }
    if (status === "FAILED" || status === "ERROR") {
      throw new Error(`Picsart inference failed: ${JSON.stringify(pd)}`);
    }
  }
  throw new Error("Picsart inference timeout");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { loesung, docType } = await req.json();
    if (!loesung || !docType) {
      return new Response(JSON.stringify({ error: "loesung und docType sind erforderlich" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const builder = DOC_BUILDERS[docType];
    if (!builder) {
      return new Response(JSON.stringify({ error: `Unbekannter docType: ${docType}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("PICSART_API_KEY");
    if (!apiKey) throw new Error("PICSART_API_KEY ist nicht konfiguriert");

    const prompt = builder(loesung);
    const imageUrl = await generatePicsartImage(apiKey, prompt);

    return new Response(
      JSON.stringify({ imageUrl, prompt, label: DOC_LABELS[docType], docType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-picsart-doc error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
