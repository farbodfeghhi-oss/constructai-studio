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

const DOC_PROMPTS: Record<string, string> = {
  pdf: `Du bist ein technischer Dokumentationsexperte. Erstelle eine vollständige technische Dokumentation im Markdown-Format für die gegebene Konstruktionslösung. Strukturiere sie professionell mit:

1. Titelseite mit Projektname und Datum
2. Inhaltsverzeichnis
3. Zusammenfassung der Lösung
4. Detaillierte Komponentenliste als Tabelle (Name | Norm | Material | Menge | Preis)
5. Vorteile und Nachteile
6. Kostenaufstellung
7. Solid Edge CAD-Hinweise
8. Fertigungsempfehlungen

Antworte NUR mit dem Markdown-Text.`,

  docx: `Du bist ein Experte für technische Montageanleitungen im Maschinenbau. Erstelle eine detaillierte Montage-/Fertigungsanleitung im Markdown-Format:

1. Sicherheitshinweise
2. Benötigte Werkzeuge und Hilfsmittel
3. Schritt-für-Schritt Montageanleitung (nummeriert) mit Drehmomenten und Toleranzen
4. Qualitätsprüfungen nach jedem Schritt
5. Abschluss und Funktionsprüfung

Antworte NUR mit dem Markdown-Text.`,

  xlsx: `Du bist ein Experte für technische Stücklisten. Erstelle eine detaillierte Stückliste als CSV-Format für die gegebene Konstruktionslösung:

Spalten: Position;Bauteil;Norm/Bezeichnung;Material;Werkstoff-Nr;Menge;Einheit;Einzelpreis;Gesamtpreis;Lieferant;Bemerkung

Füge alle Komponenten der Lösung ein und ergänze realistische Daten. Die erste Zeile sind die Spaltenüberschriften.
Antworte NUR mit dem CSV-Text (Semikolon-getrennt).`,

  pptx: `Du bist ein Experte für technische Präsentationen. Erstelle eine Präsentationsstruktur als JSON für die gegebene Konstruktionslösung:

{
  "titel": "string",
  "slides": [
    { "titel": "string", "inhalt": ["string"], "notizen": "string" }
  ]
}

Erstelle 8-10 Slides: Titelfolie, Problemstellung, Lösungsansatz, Komponentenübersicht, Materialauswahl, Kostenanalyse, Vorteile/Nachteile, CAD-Tipps, Zusammenfassung/Empfehlung.
Antworte NUR mit validem JSON.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { loesung, format, provider = "perplexity", model, projektName } = await req.json();

    if (!loesung || !format) {
      return new Response(JSON.stringify({ error: "Lösung und Format sind erforderlich." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = DOC_PROMPTS[format];
    if (!systemPrompt) {
      return new Response(JSON.stringify({ error: `Format '${format}' wird nicht unterstützt.` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cfg = PROVIDERS[provider as keyof typeof PROVIDERS] || PROVIDERS.perplexity;
    const apiKey = Deno.env.get(cfg.keyEnv);
    if (!apiKey) throw new Error(`${cfg.keyEnv} is not configured`);

    const userText = `Projekt: ${projektName || "Konstruktionsprojekt"}

Lösung: ${loesung.titel}
Beschreibung: ${loesung.beschreibung}
Typ: ${loesung.typ}

Komponenten:
${loesung.komponenten?.map((k: any) => `- ${k.name} (${k.norm}, ${k.material}, ${k.menge}, ${k.preis})`).join("\n") || "Keine"}

Vorteile: ${loesung.vorteile?.join(", ") || "Keine"}
Nachteile: ${loesung.nachteile?.join(", ") || "Keine"}

Kosten: Material ${loesung.kosten?.material}, Fertigung ${loesung.kosten?.fertigung}, Gesamt ${loesung.kosten?.gesamt}

CAD-Tipps: ${loesung.cadTipps?.join("; ") || "Keine"}`;

    const response = await fetch(cfg.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || cfg.defaultModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate-Limit erreicht." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Keine Credits mehr." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("API error:", response.status, text);
      return new Response(JSON.stringify({ error: "Dokument-Generierung fehlgeschlagen" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";

    // Return generated content - client handles download
    let result: any = { content, format };

    if (format === "pptx") {
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        result.structured = JSON.parse(cleaned);
      } catch {
        result.structured = null;
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-document error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
