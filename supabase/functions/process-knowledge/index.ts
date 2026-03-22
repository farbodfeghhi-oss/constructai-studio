import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROVIDERS = {
  perplexity: {
    url: "https://api.perplexity.ai/chat/completions",
    keyEnv: "PERPLEXITY_API_KEY",
    defaultModel: "sonar-pro",
  },
  monica: {
    url: "https://openapi.monica.im/v1/chat/completions",
    keyEnv: "MONICA_API_KEY",
    defaultModel: "gpt-4o",
  },
};

const ANALYSIS_PROMPT = `Du bist ein technischer Dokumentations-Experte für Maschinenbau, Elektrotechnik und Fertigungstechnik.

Analysiere den folgenden Inhalt und erstelle eine strukturierte Zusammenfassung. Antworte NUR mit validem JSON:

{
  "summary": "string - Kurze fachliche Zusammenfassung (2-3 Sätze)",
  "keywords": ["string"] - 5-15 relevante Fachbegriffe und Suchbegriffe,
  "suggestedCategory": "string - Eine der folgenden: Werkstoffe | Normteile | Fertigungsverfahren | Elektro | Montage | Konstruktion | Antriebstechnik | Dichtungstechnik | Verbindungstechnik | Sonstiges",
  "suggestedTitle": "string - Vorgeschlagener Titel falls keiner gegeben"
}`;

const LINK_ANALYSIS_PROMPT = `Du bist ein technischer Recherche-Experte. Analysiere die folgende URL und beschreibe den technischen Inhalt der Seite. Falls du die Seite kennst, gib detaillierte Informationen. Antworte NUR mit validem JSON:

{
  "summary": "string - Fachliche Zusammenfassung des Seiteninhalts",
  "keywords": ["string"] - Relevante Fachbegriffe,
  "suggestedCategory": "string - Kategorie",
  "suggestedTitle": "string - Passender Titel",
  "productInfo": "string - Falls es ein Produkt ist: Name, Hersteller, Typ"
}`;

const IMAGE_ANALYSIS_PROMPT = `Du bist ein Experte für technische Bilder im Maschinenbau. Analysiere dieses Bild (technische Zeichnung, Katalogseite, Produktfoto etc.) und beschreibe den Inhalt. Antworte NUR mit validem JSON:

{
  "summary": "string - Was zeigt das Bild",
  "keywords": ["string"] - Relevante Fachbegriffe,
  "suggestedCategory": "string - Kategorie",
  "suggestedTitle": "string - Passender Titel"
}`;

async function callAI(
  provider: keyof typeof PROVIDERS,
  messages: Array<{ role: string; content: string | unknown[] }>,
  model?: string,
) {
  const cfg = PROVIDERS[provider];
  const apiKey = Deno.env.get(cfg.keyEnv);
  if (!apiKey) throw new Error(`${cfg.keyEnv} is not configured`);

  const response = await fetch(cfg.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: model || cfg.defaultModel, messages }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`${provider} error:`, response.status, text);
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contentType, text, imageBase64, linkUrl, provider = "perplexity", model } = await req.json();
    const selectedProvider = (provider as keyof typeof PROVIDERS) || "perplexity";

    let result;

    if (contentType === "link" && linkUrl) {
      const messages = [
        { role: "system", content: LINK_ANALYSIS_PROMPT },
        { role: "user", content: `Analysiere diese URL: ${linkUrl}` },
      ];
      try {
        result = await callAI(selectedProvider, messages, model);
      } catch {
        result = await callAI(selectedProvider === "perplexity" ? "monica" : "perplexity", messages, model);
      }
    } else if (contentType === "image" && imageBase64) {
      const messages = [
        { role: "system", content: IMAGE_ANALYSIS_PROMPT },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}` } },
            { type: "text", text: "Analysiere dieses technische Bild." },
          ],
        },
      ];
      try {
        result = await callAI(selectedProvider, messages, model);
      } catch {
        result = await callAI(selectedProvider === "perplexity" ? "monica" : "perplexity", messages, model);
      }
    } else if (text) {
      const messages = [
        { role: "system", content: ANALYSIS_PROMPT },
        { role: "user", content: `Analysiere folgenden Text:\n\n${text.substring(0, 8000)}` },
      ];
      try {
        result = await callAI(selectedProvider, messages, model);
      } catch {
        result = await callAI(selectedProvider === "perplexity" ? "monica" : "perplexity", messages, model);
      }
    } else {
      return new Response(JSON.stringify({ error: "Kein Inhalt zum Analysieren." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-knowledge error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
