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
    const { projektName, anforderungen, provider = "perplexity", images = [] } = await req.json();

    if (!anforderungen?.trim()) {
      return new Response(JSON.stringify({ error: "Bitte geben Sie eine Projektbeschreibung ein." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cfg = PROVIDERS[provider as keyof typeof PROVIDERS] || PROVIDERS.perplexity;
    const apiKey = Deno.env.get(cfg.keyEnv);
    if (!apiKey) throw new Error(`${cfg.keyEnv} is not configured`);

    const userPrompt = projektName
      ? `Projekt: "${projektName}"\n\nAnforderungen:\n${anforderungen}`
      : anforderungen;

    // Build user content with optional images
    const userContent: any[] = [];
    if (images && images.length > 0) {
      for (const img of images) {
        userContent.push({
          type: "image_url",
          image_url: { url: img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}` },
        });
      }
    }
    userContent.push({ type: "text", text: userPrompt });

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
          { role: "user", content: images.length > 0 ? userContent : userPrompt },
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
