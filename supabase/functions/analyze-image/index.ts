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

async function requestCompletion(
  providerKey: keyof typeof PROVIDERS,
  messages: Array<{ role: string; content: string | unknown[] }>,
) {
  const cfg = PROVIDERS[providerKey];
  const apiKey = Deno.env.get(cfg.keyEnv);
  if (!apiKey) throw new Error(`${cfg.keyEnv} is not configured`);

  const response = await fetch(cfg.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
    }),
  });

  return response;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Support both old single `image` and new `images[]` format
    const body = await req.json();
    const { prompt, provider = "perplexity" } = body;
    const imageList: string[] = body.images || (body.image ? [body.image] : []);

    if (imageList.length === 0) {
      return new Response(JSON.stringify({ error: "Kein Bild übermittelt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (imageList.some((img) => img.startsWith("data:image/heic") || img.startsWith("data:image/heif"))) {
      return new Response(JSON.stringify({ error: "HEIC/HEIF wird noch nicht unterstützt. Bitte nutzen Sie JPG oder PNG." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedProvider = (provider as keyof typeof PROVIDERS) || "perplexity";

    const userContent: any[] = [];

    // Add all images
    for (const img of imageList) {
      userContent.push({
        type: "image_url",
        image_url: { url: img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}` },
      });
    }

    userContent.push({
      type: "text",
      text: prompt || `Analysiere ${imageList.length > 1 ? "diese technischen Bilder" : "dieses technische Bild"}. Erkenne alle Komponenten, Materialien, Normen und potenzielle Probleme.`,
    });

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ];

    let effectiveProvider = selectedProvider;
    let response = await requestCompletion(selectedProvider, messages);

    if (!response.ok && selectedProvider === "perplexity" && response.status >= 500) {
      response = await requestCompletion("monica", messages);
      effectiveProvider = "monica";
    }

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
      console.error(`${effectiveProvider} API error:`, response.status, text);
      return new Response(JSON.stringify({ error: "KI-Analyse fehlgeschlagen" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let analysis;
    try {
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
