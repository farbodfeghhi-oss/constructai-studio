// Knowledge processor — Phase 8: 100% Perplexity (Sonar Pro). Monica fallback removed.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callSonar } from "../_shared/perplexity/client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANALYSIS_PROMPT = `Du bist ein technischer Dokumentations-Experte für Maschinenbau, Elektrotechnik und Fertigungstechnik.

Analysiere den folgenden Inhalt und erstelle eine strukturierte Zusammenfassung. Antworte NUR mit validem JSON:

{
  "summary": "string",
  "keywords": ["string"],
  "suggestedCategory": "Werkstoffe | Normteile | Fertigungsverfahren | Elektro | Montage | Konstruktion | Antriebstechnik | Dichtungstechnik | Verbindungstechnik | Sonstiges",
  "suggestedTitle": "string"
}`;

const LINK_ANALYSIS_PROMPT = `Du bist ein technischer Recherche-Experte. Analysiere die folgende URL und beschreibe den technischen Inhalt der Seite. Antworte NUR mit validem JSON:
{ "summary": "string", "keywords": ["string"], "suggestedCategory": "string", "suggestedTitle": "string", "productInfo": "string" }`;

const IMAGE_ANALYSIS_PROMPT = `Du bist ein Experte für technische Bilder im Maschinenbau. Analysiere dieses Bild und antworte NUR mit validem JSON:
{ "summary": "string", "keywords": ["string"], "suggestedCategory": "string", "suggestedTitle": "string" }`;

async function callAI(messages: Array<{ role: string; content: string | unknown[] }>) {
  const data = await callSonar({ model: "sonar-pro", messages: messages as any });
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Antwort war kein gültiges JSON");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { contentType, text, imageBase64, linkUrl } = await req.json();
    let result;

    if (contentType === "link" && linkUrl) {
      result = await callAI([
        { role: "system", content: LINK_ANALYSIS_PROMPT },
        { role: "user", content: `Analysiere diese URL: ${linkUrl}` },
      ]);
    } else if (contentType === "image" && imageBase64) {
      result = await callAI([
        { role: "system", content: IMAGE_ANALYSIS_PROMPT },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}` } },
            { type: "text", text: "Analysiere dieses technische Bild." },
          ],
        },
      ]);
    } else if (text) {
      result = await callAI([
        { role: "system", content: ANALYSIS_PROMPT },
        { role: "user", content: `Analysiere folgenden Text:\n\n${text.substring(0, 8000)}` },
      ]);
    } else {
      return new Response(JSON.stringify({ error: "Kein Inhalt zum Analysieren." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("process-knowledge error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
