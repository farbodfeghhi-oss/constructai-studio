// 3-Variants Solution Generator — Phase 8: 100% Perplexity (Sonar Pro Vision via callSonar).
// Monica and Gemini code paths have been removed; the backend never falls back to other providers.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { callSonar } from "../_shared/perplexity/client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SOLUTIONS_PROMPT = `Du bist ein Senior-Entwicklungsingenieur für Maschinenbau mit 15+ Jahren Erfahrung. Spezialisiert auf Konstruktion, Normteile (DIN/ISO/EN), Materialauswahl, Blechfertigung und Solid Edge CAD.

Erstelle für die gegebene Projektbeschreibung genau 3 Lösungsvarianten. Antworte NUR mit validem JSON im folgenden Format:

{
  "loesungen": [
    { "titel": "Beste Empfehlung", "typ": "best", "beschreibung": "string", "komponenten": [{ "name": "string", "norm": "string", "material": "string", "menge": "string", "preis": "string" }], "vorteile": ["string"], "nachteile": ["string"], "kosten": { "material": "string", "fertigung": "string", "gesamt": "string" }, "cadTipps": ["string"] },
    { "titel": "Kostengünstige Alternative", "typ": "cheap", "beschreibung": "string", "komponenten": [...], "vorteile": [...], "nachteile": [...], "kosten": { "material": "string", "fertigung": "string", "gesamt": "string" }, "cadTipps": ["string"] },
    { "titel": "Hochleistungs-Variante", "typ": "performance", "beschreibung": "string", "komponenten": [...], "vorteile": [...], "nachteile": [...], "kosten": { "material": "string", "fertigung": "string", "gesamt": "string" }, "cadTipps": ["string"] }
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
}`;

const TECHNICAL_PROMPT_PROMPT = `Du bist ein Experte für technische Dokumentation im Maschinenbau. Erstelle einen DETAILLIERTEN KI-PROMPT, den der Nutzer in andere KI-Tools kopieren kann, um professionelle technische Dokumente zu generieren.

Antworte NUR mit validem JSON:
{
  "zeichnungsPrompt": "string",
  "stuecklistePrompt": "string",
  "praesentationPrompt": "string",
  "montagePrompt": "string"
}`;

function parseJson(content: string) {
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try { return JSON.parse(cleaned); } catch { return { rawResponse: content }; }
}

async function runSonar(systemPrompt: string, userContent: unknown, hasImages = false) {
  const data = await callSonar({
    model: "sonar-pro",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent as any },
    ],
  });
  return (data?.choices?.[0]?.message?.content as string) ?? "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { projektName, anforderungen, images = [], mode = "solutions", loesung, userId } = await req.json();

    // Mode: deep-analysis
    if (mode === "deep-analysis" && loesung) {
      const userText = `Analysiere diese Konstruktionslösung im Detail:\n\nTitel: ${loesung.titel}\nBeschreibung: ${loesung.beschreibung}\nKomponenten: ${JSON.stringify(loesung.komponenten)}\nKosten: ${JSON.stringify(loesung.kosten)}`;
      const content = await runSonar(DEEP_ANALYSIS_PROMPT, userText);
      return new Response(JSON.stringify(parseJson(content)), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Mode: technical-prompt
    if (mode === "technical-prompt" && loesung) {
      const userText = `Erstelle detaillierte KI-Prompts für diese Konstruktionslösung:\n\nTitel: ${loesung.titel}\nBeschreibung: ${loesung.beschreibung}\nKomponenten: ${JSON.stringify(loesung.komponenten)}\nKosten: ${JSON.stringify(loesung.kosten)}\nCAD-Tipps: ${JSON.stringify(loesung.cadTipps)}`;
      const content = await runSonar(TECHNICAL_PROMPT_PROMPT, userText);
      return new Response(JSON.stringify(parseJson(content)), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Default mode: 3 solutions
    if (!anforderungen?.trim()) {
      return new Response(JSON.stringify({ error: "Bitte geben Sie eine Projektbeschreibung ein." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (images.some((img: string) => img.startsWith("data:image/heic") || img.startsWith("data:image/heif"))) {
      return new Response(JSON.stringify({ error: "HEIC/HEIF wird noch nicht unterstützt. Bitte nutzen Sie JPG oder PNG." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional knowledge context
    let knowledgeContext = "";
    if (userId) {
      try {
        const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data: items } = await sb
          .from("knowledge_items")
          .select("title, category, ai_summary, keywords, extracted_text")
          .eq("user_id", userId)
          .limit(20);
        if (items?.length) {
          const kTexts = items.map((k: any) =>
            `- ${k.title} [${k.category}]: ${k.ai_summary || k.extracted_text || ""} (Keywords: ${(k.keywords || []).join(", ")})`
          ).join("\n");
          knowledgeContext = `\n\nDer Nutzer hat folgendes Fachwissen in seiner Wissensdatenbank gespeichert. Berücksichtige dieses Wissen:\n${kTexts}`;
        }
      } catch (e) {
        console.error("Knowledge loading error:", e);
      }
    }

    const userPrompt = projektName ? `Projekt: "${projektName}"\n\nAnforderungen:\n${anforderungen}` : anforderungen;

    let userContent: unknown = userPrompt;
    if (images.length > 0) {
      const parts: any[] = images.map((img: string) => ({
        type: "image_url",
        image_url: { url: img.startsWith("data:") || img.startsWith("http") ? img : `data:image/jpeg;base64,${img}` },
      }));
      parts.push({ type: "text", text: userPrompt });
      userContent = parts;
    }

    const content = await runSonar(SOLUTIONS_PROMPT + knowledgeContext, userContent, images.length > 0);
    return new Response(JSON.stringify(parseJson(content)), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    console.error("generate-solutions error:", msg);
    const status = /HTTP 429/.test(msg) ? 429 : /HTTP 402/.test(msg) ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
