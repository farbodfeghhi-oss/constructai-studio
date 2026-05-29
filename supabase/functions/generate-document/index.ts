// Document Generator — Phase 8: 100% Perplexity (Sonar Pro, 200K context for long Markdown).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callSonar } from "../_shared/perplexity/client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DOC_PROMPTS: Record<string, string> = {
  pdf: `Du bist ein technischer Dokumentationsexperte. Erstelle eine vollständige technische Dokumentation im Markdown-Format für die gegebene Konstruktionslösung mit Titelseite, Inhaltsverzeichnis, Zusammenfassung, Komponenten-Tabelle, Vor/Nachteilen, Kostenaufstellung, Solid Edge CAD-Hinweisen und Fertigungsempfehlungen. Antworte NUR mit dem Markdown-Text.`,
  docx: `Du bist ein Experte für technische Montageanleitungen im Maschinenbau. Erstelle eine detaillierte Montage-/Fertigungsanleitung im Markdown-Format mit Sicherheitshinweisen, Werkzeugen, nummerierten Schritten inkl. Drehmomenten/Toleranzen, Qualitätsprüfungen und Funktionsprüfung. Antworte NUR mit dem Markdown-Text.`,
  xlsx: `Du bist ein Experte für technische Stücklisten. Erstelle eine detaillierte Stückliste als CSV (Semikolon-getrennt) mit Spalten: Position;Bauteil;Norm/Bezeichnung;Material;Werkstoff-Nr;Menge;Einheit;Einzelpreis;Gesamtpreis;Lieferant;Bemerkung. Antworte NUR mit dem CSV-Text.`,
  pptx: `Du bist ein Experte für technische Präsentationen. Erstelle 8-10 Slides als JSON: { "titel": "string", "slides": [{ "titel": "string", "inhalt": ["string"], "notizen": "string" }] }. Antworte NUR mit validem JSON.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { loesung, format, projektName } = await req.json();

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

    const data = await callSonar({
      model: "sonar-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
    });

    const content = (data?.choices?.[0]?.message?.content as string)?.trim() ?? "";
    const result: any = { content, format };

    if (format === "pptx") {
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        result.structured = JSON.parse(cleaned);
      } catch {
        result.structured = null;
      }
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    console.error("generate-document error:", msg);
    const status = /HTTP 429/.test(msg) ? 429 : /HTTP 402/.test(msg) ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
