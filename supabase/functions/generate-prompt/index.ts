import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Du bist ein Experte für technische Bild-Prompts und CAD-Rendering. Du erstellst hochpräzise, detaillierte Prompts für Bild-KIs (Midjourney, DALL-E, Stable Diffusion), die fotorealistische technische Renderings erzeugen.

Dein Output ist NUR ein einziger, optimierter Prompt auf Englisch. Keine Erklärungen, kein Zusatztext.

Regeln für den Prompt:
1. Beginne mit dem Hauptobjekt und Material
2. Nenne exakte Maße, Normen (DIN/ISO) wenn relevant
3. Definiere Ansicht: Isometrisch, Explosionszeichnung, Schnittansicht etc.
4. Beschreibe Beleuchtung: Studio, technisch, HDR
5. Definiere Stil: CAD-Rendering, technische Zeichnung, fotorealistisch
6. Hintergrund: Weiß, Gradient, Werkstatt
7. Details: Oberflächenstruktur, Reflexionen, Schatten
8. Qualitätshinweise: 8K, ultra-detailed, sharp focus

Beispiel-Output:
"Photorealistic CAD rendering of a stainless steel A2-70 hex bolt DIN 933 M12x60, isometric view at 30° angle, studio lighting with soft shadows, brushed metal surface texture with visible thread detail, white gradient background, technical precision, 8K ultra-detailed, sharp focus, engineering visualization style"`;

const PROVIDERS = {
  perplexity: {
    url: "https://api.perplexity.ai/chat/completions",
    keyEnv: "PERPLEXITY_API_KEY",
    model: "sonar-pro",
  },
  monica: {
    url: "https://openapi.monica.im/v1/chat/completions",
    keyEnv: "MONICA_API_KEY",
    model: "gpt-4o",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { beschreibung, provider = "perplexity", images = [] } = await req.json();

    if (!beschreibung?.trim()) {
      return new Response(JSON.stringify({ error: "Bitte geben Sie eine Beschreibung ein." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cfg = PROVIDERS[provider as keyof typeof PROVIDERS] || PROVIDERS.perplexity;
    const apiKey = Deno.env.get(cfg.keyEnv);
    if (!apiKey) throw new Error(`${cfg.keyEnv} is not configured`);

    // Build user content with optional reference images
    const userText = `Erstelle einen professionellen Bild-KI Prompt für: ${beschreibung}`;
    const userContent: any[] = [];
    if (images && images.length > 0) {
      for (const img of images) {
        userContent.push({
          type: "image_url",
          image_url: { url: img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}` },
        });
      }
      userContent.push({ type: "text", text: `${userText}\n\nNutze die angehängten Referenzbilder als visuelle Inspiration.` });
    }

    const response = await fetch(cfg.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: images.length > 0 ? userContent : userText },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate-Limit erreicht. Bitte versuchen Sie es in einer Minute erneut." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Keine Credits mehr." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error(`${provider} API error:`, response.status, text);
      return new Response(JSON.stringify({ error: "KI-Generierung fehlgeschlagen" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const prompt = data.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ prompt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-prompt error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
