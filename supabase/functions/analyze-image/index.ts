import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Du bist ein Senior-Entwicklungsingenieur für Maschinenbau und Konstruktion mit 15+ Jahren Erfahrung in Deutschland. Spezialisiert auf Standardkomponenten, Normen (DIN/ISO/EN), Materialauswahl, Solid Edge CAD, Blechfertigung und technische Dokumentation.

Analysiere das Bild technisch präzise. Antworte IMMER im folgenden JSON-Format:

{
  "erkannteTeile": [
    { "name": "string", "norm": "string", "material": "string", "groesse": "string" }
  ],
  "technischeAnalyse": {
    "material": "string",
    "norm": "string",
    "einsatz": "string"
  },
  "probleme": [
    { "beschreibung": "string", "schweregrad": "warnung|kritisch|info" }
  ],
  "alternativen": [
    { "name": "string", "vorteil": "string" }
  ],
  "naechsteSchritte": ["string"]
}

Wenn kein technisches Bild erkannt wird, gib trotzdem eine sinnvolle strukturierte Antwort. Antworte NUR mit validem JSON.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, prompt } = await req.json();

    if (!image) {
      return new Response(JSON.stringify({ error: "Kein Bild übermittelt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const userContent: any[] = [];

    // Add image
    userContent.push({
      type: "image_url",
      image_url: { url: image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}` },
    });

    // Add optional text prompt
    userContent.push({
      type: "text",
      text: prompt || "Analysiere dieses technische Bild. Erkenne alle Komponenten, Materialien, Normen und potenzielle Probleme.",
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate-Limit erreicht. Bitte versuchen Sie es in einer Minute erneut." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Keine Credits mehr. Bitte laden Sie Ihr Konto auf." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "KI-Analyse fehlgeschlagen" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Try to parse JSON from the response
    let analysis;
    try {
      // Strip markdown code fences if present
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      analysis = { rawResponse: content };
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
