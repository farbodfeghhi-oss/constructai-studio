// Knowledge source metadata extractor — Phase 8: 100% Perplexity (Sonar Pro). Monica fallback removed.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callSonar } from "../_shared/perplexity/client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Du bist ein technischer Dokumentations-Experte für Maschinenbau, Elektrotechnik, Fertigungstechnik und Normen (DIN/ISO/EN).

Analysiere den gegebenen Inhalt und extrahiere präzise Meta-Daten. Antworte AUSSCHLIESSLICH mit validem JSON:

{
  "source_name": "string",
  "domain": "string (max 3 Wörter)",
  "summary": "string (2-3 Sätze)",
  "keywords": ["6-12 Fachbegriffe"]
}`;

async function extract(messages: Array<{ role: string; content: string | unknown[] }>) {
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
    let messages: Array<{ role: string; content: string | unknown[] }>;

    if (contentType === "image" && imageBase64) {
      const url = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
      messages = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url } },
            { type: "text", text: "Analysiere dieses technische Bild und liefere die Meta-Daten als JSON." },
          ],
        },
      ];
    } else if (contentType === "url" && linkUrl) {
      messages = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Analysiere die folgende URL und liefere Meta-Daten:\n${linkUrl}` },
      ];
    } else if ((contentType === "pdf" || contentType === "text") && text) {
      const trimmed = text.length > 30000 ? text.slice(0, 30000) + "\n[... gekürzt]" : text;
      messages = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Analysiere folgenden Inhalt und liefere Meta-Daten:\n\n${trimmed}` },
      ];
    } else {
      return new Response(JSON.stringify({ error: "Ungültige Eingabe" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metadata = await extract(messages);

    return new Response(JSON.stringify({ metadata }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("process-knowledge-source error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
