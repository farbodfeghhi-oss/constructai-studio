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

const SYSTEM_PROMPT = `Du bist ein technischer Dokumentations-Experte für Maschinenbau, Elektrotechnik, Fertigungstechnik und Normen (DIN/ISO/EN).

Analysiere den gegebenen Inhalt und extrahiere präzise Meta-Daten. Antworte AUSSCHLIESSLICH mit validem JSON, ohne Code-Block:

{
  "source_name": "Kurzer, sprechender Name der Quelle (z.B. 'DIN 933 – Sechskantschrauben mit Gewinde bis Kopf' oder 'Datenblatt SKF 6205-2RS Rillenkugellager')",
  "domain": "Fachbereich der Quelle in maximal 3 Wörtern (z.B. 'Befestigungstechnik', 'Wälzlager', 'Werkstoffkunde', 'Pneumatik', 'Elektroantriebe', 'Blechbearbeitung', 'Schweißtechnik')",
  "summary": "Fachliche Zusammenfassung in 2-3 Sätzen",
  "keywords": ["6-12 relevante Fachbegriffe/Suchbegriffe"]
}`;

async function callAI(
  provider: keyof typeof PROVIDERS,
  messages: Array<{ role: string; content: string | unknown[] }>,
) {
  const cfg = PROVIDERS[provider];
  const apiKey = Deno.env.get(cfg.keyEnv);
  if (!apiKey) throw new Error(`${cfg.keyEnv} ist nicht konfiguriert`);

  const res = await fetch(cfg.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: cfg.defaultModel, messages }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error(`${provider} error`, res.status, t);
    throw new Error(`${provider} ${res.status}`);
  }
  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Antwort war kein gültiges JSON");
  }
}

async function tryProviders(messages: Array<{ role: string; content: string | unknown[] }>) {
  try {
    return await callAI("perplexity", messages);
  } catch (e) {
    console.warn("perplexity failed, falling back to monica:", e);
    return await callAI("monica", messages);
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
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metadata = await tryProviders(messages);

    return new Response(JSON.stringify({ metadata }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-knowledge-source error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
