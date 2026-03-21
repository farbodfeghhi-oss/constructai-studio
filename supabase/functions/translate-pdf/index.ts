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
    const { text, sourceLang, targetLang, provider = "monica" } = await req.json();

    if (!text?.trim()) {
      return new Response(JSON.stringify({ error: "Kein Text zum Übersetzen." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine provider config
    const providers: Record<string, { url: string; keyEnv: string; model: string }> = {
      monica: {
        url: "https://openapi.monica.im/v1/chat/completions",
        keyEnv: "MONICA_API_KEY",
        model: "gpt-4o",
      },
      perplexity: {
        url: "https://api.perplexity.ai/chat/completions",
        keyEnv: "PERPLEXITY_API_KEY",
        model: "sonar-pro",
      },
    };

    const cfg = providers[provider] || providers.monica;
    const apiKey = Deno.env.get(cfg.keyEnv);
    if (!apiKey) throw new Error(`${cfg.keyEnv} is not configured`);

    const systemPrompt = `Du bist ein professioneller technischer Übersetzer. Übersetze den folgenden Text von ${sourceLang || "der erkannten Sprache"} nach ${targetLang || "Deutsch"}. 

Regeln:
- Bewahre die Formatierung und Struktur des Originaltexts
- Übersetze technische Fachbegriffe korrekt und kontextbezogen
- Behalte Abkürzungen, Normen (DIN/ISO/EN), Maßeinheiten und Formeln unverändert bei
- Gib NUR die Übersetzung zurück, keine Erklärungen oder Kommentare
- Wenn der Text Absätze enthält, behalte die Absatzstruktur bei`;

    // Split text into chunks if too long (max ~4000 chars per chunk for reliable translation)
    const MAX_CHUNK = 4000;
    const chunks: string[] = [];
    
    if (text.length <= MAX_CHUNK) {
      chunks.push(text);
    } else {
      // Split by paragraphs first, then by size
      const paragraphs = text.split(/\n\n+/);
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

    const translatedChunks: string[] = [];

    for (const chunk of chunks) {
      const response = await fetch(cfg.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: chunk },
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
        const errText = await response.text();
        console.error(`${provider} API error:`, response.status, errText);
        return new Response(JSON.stringify({ error: "Übersetzung fehlgeschlagen" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const translated = data.choices?.[0]?.message?.content?.trim() || "";
      translatedChunks.push(translated);
    }

    return new Response(JSON.stringify({ 
      translation: translatedChunks.join("\n\n"),
      chunks: chunks.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate-pdf error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
