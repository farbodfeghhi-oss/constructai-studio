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
    const { url, description, images, provider = "perplexity", mode = "single", pdfText } = await req.json();

    const PROVIDERS: Record<string, { url: string; keyEnv: string; model: string }> = {
      perplexity: { url: "https://api.perplexity.ai/chat/completions", keyEnv: "PERPLEXITY_API_KEY", model: "sonar-pro" },
      monica: { url: "https://openapi.monica.im/v1/chat/completions", keyEnv: "MONICA_API_KEY", model: "gpt-4o" },
    };

    const cfg = PROVIDERS[provider] || PROVIDERS.perplexity;
    const apiKey = Deno.env.get(cfg.keyEnv);
    if (!apiKey) throw new Error(`${cfg.keyEnv} not configured`);

    // Bulk PDF mode
    if (mode === "bulk" && pdfText) {
      const systemPrompt = `Du bist ein Experte für technische Produktdokumentation im Maschinenbau. Du erhältst Text aus einem PDF-Katalog oder Datenblatt. Extrahiere ALLE technischen Produkte/Komponenten die du findest.

Für JEDES Produkt erstelle einen Eintrag mit:
- name: Produktname
- description: Kurze technische Beschreibung (1-2 Sätze)
- category: Maschinenelemente|Blech|Montage|Elektro|Hydraulik|Pneumatik|Sonstiges
- keywords: Array von Suchbegriffen
- norm: DIN/ISO Norm falls erkannt
- material: Material falls erkannt
- supplier: Hersteller/Lieferant falls erkannt
- price: Preis falls erkannt
- size: Abmessungen falls erkannt

Antworte IMMER als JSON-Array:
[
  { "name": "...", "description": "...", "category": "...", "keywords": [...], "norm": "...", "material": "...", "supplier": "...", "price": "...", "size": "..." },
  ...
]

Extrahiere so viele Produkte wie möglich. Antworte NUR mit validem JSON-Array.`;

      // Split large texts into chunks
      const MAX_CHUNK = 6000;
      const allProducts: any[] = [];

      const chunks: string[] = [];
      if (pdfText.length <= MAX_CHUNK) {
        chunks.push(pdfText);
      } else {
        const paragraphs = pdfText.split(/\n\n+/);
        let current = "";
        for (const para of paragraphs) {
          if ((current + "\n\n" + para).length > MAX_CHUNK && current) {
            chunks.push(current.trim());
            current = para;
          } else {
            current = current ? current + "\n\n" + para : para;
          }
        }
        if (current.trim()) chunks.push(current.trim());
      }

      for (const chunk of chunks) {
        const response = await fetch(cfg.url, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: cfg.model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: chunk },
            ],
          }),
        });

        if (!response.ok) {
          console.error("bulk analyze error:", response.status, await response.text());
          continue;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "[]";
        try {
          const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const products = JSON.parse(cleaned);
          if (Array.isArray(products)) {
            allProducts.push(...products);
          } else if (products.name) {
            allProducts.push(products);
          }
        } catch {
          console.error("Failed to parse chunk result:", content.substring(0, 200));
        }
      }

      return new Response(JSON.stringify({ products: allProducts, chunks: chunks.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Single product mode
    const systemPrompt = `Du bist ein Experte für technische Produktdokumentation im Maschinenbau. Analysiere die bereitgestellten Informationen (Link, Beschreibung, Bilder) und schlage strukturierte Metadaten vor.

Antworte IMMER als JSON:

{
  "name": "Produktname",
  "description": "Technische Beschreibung (2-3 Sätze)",
  "category": "Maschinenelemente|Blech|Montage|Elektro|Hydraulik|Pneumatik|Sonstiges",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "norm": "DIN/ISO Norm falls erkannt",
  "material": "Material falls erkannt",
  "supplier": "Hersteller/Lieferant falls erkannt",
  "price": "Preis falls erkannt",
  "size": "Abmessungen falls erkannt"
}

Antworte NUR mit validem JSON.`;

    const userParts: string[] = [];
    if (url) userParts.push(`Produkt-URL: ${url}`);
    if (description) userParts.push(`Beschreibung: ${description}`);

    const userContent: any[] = [];
    if (images?.length) {
      for (const img of images) {
        userContent.push({ type: "image_url", image_url: { url: img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}` } });
      }
    }
    userContent.push({ type: "text", text: userParts.join("\n") || "Analysiere die bereitgestellten Bilder." });

    const response = await fetch(cfg.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent.length > 1 ? userContent : userParts.join("\n") || "Analysiere." },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("analyze-component error:", response.status, text);
      return new Response(JSON.stringify({ error: "Analyse fehlgeschlagen" }), {
        status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    let suggestion;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      suggestion = JSON.parse(cleaned);
    } catch {
      suggestion = { name: "", description: content };
    }

    return new Response(JSON.stringify({ suggestion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-component error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Fehler" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
