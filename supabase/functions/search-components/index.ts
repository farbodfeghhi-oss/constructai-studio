import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, keywords, provider = "perplexity", images } = await req.json();

    if (!description && (!keywords || keywords.length === 0)) {
      return new Response(JSON.stringify({ error: "Beschreibung oder Keywords erforderlich" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const PROVIDERS: Record<string, { url: string; keyEnv: string; model: string }> = {
      perplexity: { url: "https://api.perplexity.ai/chat/completions", keyEnv: "PERPLEXITY_API_KEY", model: "sonar-pro" },
      monica: { url: "https://openapi.monica.im/v1/chat/completions", keyEnv: "MONICA_API_KEY", model: "gpt-4o" },
    };

    const cfg = PROVIDERS[provider] || PROVIDERS.perplexity;
    const apiKey = Deno.env.get(cfg.keyEnv);
    if (!apiKey) throw new Error(`${cfg.keyEnv} not configured`);

    const systemPrompt = `Du bist ein Beschaffungsexperte für Maschinenbau-Komponenten. Suche im Internet nach passenden Produkten basierend auf der Beschreibung des Nutzers.

Antworte IMMER als JSON-Array mit bis zu 5 Ergebnissen:

[
  {
    "name": "Produktname",
    "description": "Kurze technische Beschreibung",
    "category": "Maschinenelemente|Blech|Montage|Elektro|Hydraulik|Pneumatik|Sonstiges",
    "keywords": ["keyword1", "keyword2"],
    "norm": "DIN/ISO Norm falls bekannt",
    "material": "Material falls bekannt",
    "supplier": "Lieferant/Hersteller",
    "price": "Geschätzter Preis oder Preisbereich",
    "size": "Abmessungen falls bekannt",
    "url": "Produkt-URL falls verfügbar"
  }
]

Antworte NUR mit validem JSON-Array.`;

    const userContent: any[] = [];
    if (images?.length) {
      for (const img of images) {
        userContent.push({ type: "image_url", image_url: { url: img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}` } });
      }
    }
    const searchText = [description, keywords?.length ? `Keywords: ${keywords.join(", ")}` : ""].filter(Boolean).join("\n");
    userContent.push({ type: "text", text: searchText });

    const response = await fetch(cfg.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent.length > 1 ? userContent : searchText },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("search-components error:", response.status, text);
      return new Response(JSON.stringify({ error: "Suche fehlgeschlagen" }), {
        status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    let results;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      results = JSON.parse(cleaned);
    } catch {
      results = [];
    }

    return new Response(JSON.stringify({ results, citations: data.citations || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("search-components error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Fehler" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
