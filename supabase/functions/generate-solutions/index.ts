import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SOLUTIONS_PROMPT = `Du bist ein Senior-Entwicklungsingenieur für Maschinenbau mit 15+ Jahren Erfahrung. Spezialisiert auf Konstruktion, Normteile (DIN/ISO/EN), Materialauswahl, Blechfertigung und Solid Edge CAD.

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

const DEEP_ANALYSIS_PROMPT = `Du bist ein Senior-Entwicklungsingenieur für Maschinenbau. Erstelle eine DETAILLIERTE FACHANALYSE für die gegebene Lösung. Antworte NUR mit validem JSON:

{
  "festigkeit": { "beschreibung": "string", "berechnungen": ["string"], "sicherheitsfaktor": "string" },
  "toleranzen": [{ "bauteil": "string", "toleranz": "string", "passung": "string", "norm": "string" }],
  "werkstoffkennwerte": [{ "material": "string", "zugfestigkeit": "string", "streckgrenze": "string", "haerte": "string", "dichte": "string" }],
  "normenDetails": [{ "norm": "string", "titel": "string", "relevanz": "string" }],
  "fertigungshinweise": ["string"],
  "qualitaetspruefung": ["string"]
}

Gib exakte technische Werte, Berechnungen und normgerechte Details.`;

const TECHNICAL_PROMPT_PROMPT = `Du bist ein Experte für technische Dokumentation im Maschinenbau. Erstelle einen DETAILLIERTEN KI-PROMPT, den der Nutzer in andere KI-Tools kopieren kann, um professionelle technische Dokumente zu generieren.

Der Prompt soll folgendes abdecken:
1. Technische Zeichnung (als Bild) - mit Maßen, Toleranzen, Oberflächen
2. Stückliste (als Excel) - mit allen Komponenten, Normen, Materialien, Mengen
3. Lösungs-Präsentation - professionelle Slides mit der Konstruktionslösung
4. Montage-Anleitung - Schritt-für-Schritt mit Werkzeugen und Drehmomenten

Antworte NUR mit validem JSON:
{
  "zeichnungsPrompt": "string (kompletter Prompt für technische Zeichnung)",
  "stuecklistePrompt": "string (kompletter Prompt für Stückliste als Excel)",
  "praesentationPrompt": "string (kompletter Prompt für Präsentation)",
  "montagePrompt": "string (kompletter Prompt für Montage-Anleitung)"
}`;

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

async function requestCompletion(
  providerKey: keyof typeof PROVIDERS,
  messages: Array<{ role: string; content: string | unknown[] }>,
  model?: string,
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
      model: model || cfg.defaultModel,
      messages,
    }),
  });

  return response;
}

function handleErrorResponse(response: Response, provider: string) {
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
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projektName, anforderungen, provider = "perplexity", model, images = [], mode = "solutions", loesung, userId } = await req.json();

    // Mode: deep-analysis
    if (mode === "deep-analysis" && loesung) {
      const selectedProvider = (provider as keyof typeof PROVIDERS) || "perplexity";
      const userText = `Analysiere diese Konstruktionslösung im Detail:\n\nTitel: ${loesung.titel}\nBeschreibung: ${loesung.beschreibung}\nKomponenten: ${JSON.stringify(loesung.komponenten)}\nKosten: ${JSON.stringify(loesung.kosten)}`;
      
      const messages = [
        { role: "system", content: DEEP_ANALYSIS_PROMPT },
        { role: "user", content: userText },
      ];

      const response = await requestCompletion(selectedProvider, messages, model);
      if (!response.ok) {
        const errResp = handleErrorResponse(response, selectedProvider);
        if (errResp) return errResp;
        const text = await response.text();
        console.error(`${selectedProvider} API error:`, response.status, text);
        return new Response(JSON.stringify({ error: "KI-Analyse fehlgeschlagen" }), {
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
    }

    // Mode: technical-prompt
    if (mode === "technical-prompt" && loesung) {
      const selectedProvider = (provider as keyof typeof PROVIDERS) || "perplexity";
      const userText = `Erstelle detaillierte KI-Prompts für diese Konstruktionslösung:\n\nTitel: ${loesung.titel}\nBeschreibung: ${loesung.beschreibung}\nKomponenten: ${JSON.stringify(loesung.komponenten)}\nKosten: ${JSON.stringify(loesung.kosten)}\nCAD-Tipps: ${JSON.stringify(loesung.cadTipps)}`;

      const messages = [
        { role: "system", content: TECHNICAL_PROMPT_PROMPT },
        { role: "user", content: userText },
      ];

      const response = await requestCompletion(selectedProvider, messages, model);
      if (!response.ok) {
        const errResp = handleErrorResponse(response, selectedProvider);
        if (errResp) return errResp;
        const text = await response.text();
        console.error(`${selectedProvider} API error:`, response.status, text);
        return new Response(JSON.stringify({ error: "Prompt-Generierung fehlgeschlagen" }), {
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
    }

    // Default mode: generate solutions
    if (!anforderungen?.trim()) {
      return new Response(JSON.stringify({ error: "Bitte geben Sie eine Projektbeschreibung ein." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (images.some((img: string) => img.startsWith("data:image/heic") || img.startsWith("data:image/heif"))) {
      return new Response(JSON.stringify({ error: "HEIC/HEIF wird noch nicht unterstützt. Bitte nutzen Sie JPG oder PNG." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedProvider = (provider as keyof typeof PROVIDERS) || "perplexity";

    // Load knowledge context if user is authenticated
    let knowledgeContext = "";
    if (userId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sb = createClient(supabaseUrl, supabaseKey);
        const { data: knowledgeItems } = await sb
          .from("knowledge_items")
          .select("title, category, ai_summary, keywords, extracted_text")
          .eq("user_id", userId)
          .limit(20);
        if (knowledgeItems && knowledgeItems.length > 0) {
          const kTexts = knowledgeItems.map((k: any) =>
            `- ${k.title} [${k.category}]: ${k.ai_summary || k.extracted_text || ""} (Keywords: ${(k.keywords || []).join(", ")})`
          ).join("\n");
          knowledgeContext = `\n\nDer Nutzer hat folgendes Fachwissen in seiner Wissensdatenbank gespeichert. Beruecksichtige dieses Wissen bei deinen Empfehlungen:\n${kTexts}`;
        }
      } catch (e) {
        console.error("Knowledge loading error:", e);
      }
    }

    const userPrompt = projektName
      ? `Projekt: "${projektName}"\n\nAnforderungen:\n${anforderungen}`
      : anforderungen;

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

    const messages = [
      { role: "system", content: SOLUTIONS_PROMPT + knowledgeContext },
      { role: "user", content: images.length > 0 ? userContent : userPrompt },
    ];

    let effectiveProvider = selectedProvider;
    let response = await requestCompletion(selectedProvider, messages, model);

    if (!response.ok && selectedProvider === "perplexity" && response.status >= 500) {
      response = await requestCompletion("monica", messages, model);
      effectiveProvider = "monica";
    }

    if (!response.ok) {
      const errResp = handleErrorResponse(response, effectiveProvider);
      if (errResp) return errResp;
      const text = await response.text();
      console.error(`${effectiveProvider} API error:`, response.status, text);
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
