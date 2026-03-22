

## Plan: Loesung-Aktionsoptionen, Monica-Modellauswahl und Dokument-Generierung

### Zusammenfassung

Drei Hauptbereiche: (1) Aktionsbuttons unter jeder Loesung, (2) Monica-Modellauswahl bei allen KI-Chats, (3) Dokumentgenerierung via Edge Functions.

**Wichtiger Hinweis zu Monica-Tools**: "Manus PDF zu PPT", "Nano Banana PPT" und "KI-Praesentationsersteller" sind **keine API-Endpunkte** von Monica -- sie sind nur in der Monica-App/Browser-Extension verfuegbar. Monica's API bietet ausschliesslich Chat Completions (OpenAI-kompatibel). Die gewuenschten Funktionen werden stattdessen ueber die Chat-API mit spezialisierten Prompts und lokaler Dokumentgenerierung (PPTX, PDF, DOCX, XLSX) umgesetzt.

---

### Teil 1: Aktions-Buttons unter jeder Loesung

Unter jeder der 3 Loesungsvarianten (Beste/Kostenguenstig/Hochleistung) erscheinen 3 Aktions-Buttons:

1. **"Detaillierte Fachanalyse"** -- Ruft die Edge Function mit der gewaehlten Loesung erneut auf und fordert tiefere technische Details an (Berechnungen, Toleranzen, Werkstoffkennwerte, Normendetails). Ergebnis wird als expandierbarer Bereich unter der Loesung angezeigt.

2. **"Als PDF/Word exportieren"** -- Generiert ueber eine neue Edge Function (`generate-document`) ein PDF oder DOCX mit der kompletten Loesung inkl. Komponentenliste, Vor-/Nachteile, Kosten. Download-Link wird dem Nutzer praesentiert.

3. **"KI-Prompt generieren"** -- Erstellt einen detaillierten, fachlichen Prompt, den der Nutzer in andere KI-Tools kopieren kann, um technische Zeichnungen, Stuecklisten (Excel), Praesentationen und Montageanleitungen zu generieren. Nutzt die bestehende `generate-prompt` Edge Function mit angepasstem System-Prompt.

### Teil 2: Monica-Modellauswahl

Wenn der Nutzer "Monica AI" als Provider waehlt, erscheint ein zusaetzliches Dropdown mit verfuegbaren Monica-Modellen:

```text
Monica-Modelle (via openapi.monica.im):
- gpt-4o (Standard)
- gpt-4.1
- gpt-4.1-mini
- gpt-4o-mini
- claude-sonnet-4-20250514
- claude-3-7-sonnet-latest
- gemini-2.5-pro
- gemini-2.5-flash
- deepseek-chat (DeepSeek V3)
- o4-mini (Reasoning)
```

Die Modellauswahl wird an alle Edge Functions weitergeleitet, die Monica nutzen.

### Teil 3: Dokument-Generierung (Ersatz fuer Monica-Tools)

Neue Edge Function `generate-document`:
- Nimmt eine Loesung + gewuenschtes Format (pdf/docx/pptx/xlsx)
- Nutzt Monica/Perplexity API um strukturierten Inhalt zu generieren
- Generiert das Dokument serverseitig und gibt es als Download zurueck
- **PDF**: Technische Dokumentation mit Loesungsbeschreibung, Komponentenliste, Kosten
- **PPTX**: Praesentationsfolien mit der Loesung (via pptxgenjs-Stil Prompt)
- **XLSX**: Stueckliste als Excel-Datei
- **DOCX**: Montage-/Fertigungsanleitung

### Dateien

| Aktion | Datei |
|--------|------|
| Modify | `src/pages/Loesung.tsx` -- Aktionsbuttons + Modellauswahl |
| Modify | `src/components/ProviderSelect.tsx` -- Monica-Modell-Dropdown |
| Create | `supabase/functions/generate-document/index.ts` -- PDF/DOCX/PPTX/XLSX Generierung |
| Modify | `supabase/functions/generate-solutions/index.ts` -- Modellparameter akzeptieren |
| Modify | `supabase/functions/generate-prompt/index.ts` -- Technischer Prompt fuer Dokumentation |
| Modify | `supabase/config.toml` -- neue Function registrieren |

### Technische Details

**generate-document Edge Function:**
- Akzeptiert: `{ loesung, format, provider, model }`
- Fuer PDF/DOCX: Nutzt die KI um strukturierten Markdown zu generieren, konvertiert dann serverseitig
- Fuer PPTX: Generiert JSON-Struktur der Slides via KI, baut PPTX
- Fuer XLSX: Erstellt Komponentenliste als CSV/strukturiertes Format
- Gibt Base64-encodierte Datei zurueck zum direkten Download

**Detaillierte Fachanalyse:**
- Neue Edge Function `generate-deep-analysis` oder Erweiterung von `generate-solutions` mit einem `mode: "deep"` Parameter
- System-Prompt fordert: Festigkeitsberechnungen, Toleranzanalyse, Werkstoffdatenblaetter, relevante DIN/ISO Details

