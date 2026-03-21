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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { beschreibung } = await req.json();

    if (!beschreibung?.trim()) {
      return new Response(JSON.stringify({ error: "Bitte geben Sie eine Beschreibung ein." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY is not configured");

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Erstelle einen professionellen Bild-KI Prompt für: ${beschreibung}` },
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
      console.error("Perplexity API error:", response.status, text);
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
