import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Du bist ein Senior-Entwicklungsingenieur für Maschinenbau mit 15+ Jahren Erfahrung. Spezialisiert auf Konstruktion, Normteile (DIN/ISO/EN), Materialauswahl, Blechfertigung und Solid Edge CAD.

Erstelle für die gegebene Projektbeschreibung genau 3 Lösungsvarianten. Antworte NUR mit validem JSON im folgenden Format:

{
  "loesungen": [
    {
      "titel": "Beste Empfehlung",
      "typ": "best",
      "beschreibung": "string",
      "komponenten": [
        { "name": "string", "norm": "string", "material": "string", "menge": "string", "preis": "string" }
      ],
      "vorteile": ["string"],
      "nachteile": ["string"],
      "kosten": { "material": "string", "fertigung": "string", "gesamt": "string" },
      "cadTipps": ["string"]
    },
    {
      "titel": "Kostengünstige Alternative",
      "typ": "cheap",
      "beschreibung": "string",
      "komponenten": [...],
      "vorteile": [...],
      "nachteile": [...],
      "kosten": { "material": "string", "fertigung": "string", "gesamt": "string" },
      "cadTipps": ["string"]
    },
    {
      "titel": "Hochleistungs-Variante",
      "typ": "performance",
      "beschreibung": "string",
      "komponenten": [...],
      "vorteile": [...],
      "nachteile": [...],
      "kosten": { "material": "string", "fertigung": "string", "gesamt": "string" },
      "cadTipps": ["string"]
    }
  ]
}

Gib realistische DIN/ISO Normen, Materialien, Preise und praxisnahe Empfehlungen.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projektName, anforderungen } = await req.json();

    if (!anforderungen?.trim()) {
      return new Response(JSON.stringify({ error: "Bitte geben Sie eine Projektbeschreibung ein." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userPrompt = projektName
      ? `Projekt: "${projektName}"\n\nAnforderungen:\n${anforderungen}`
      : anforderungen;

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
          { role: "user", content: userPrompt },
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
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "KI-Generierung fehlgeschlagen" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let result;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      result = { rawResponse: content };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-solutions error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
