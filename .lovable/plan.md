# Advanced Engineering Analysis — Multi-Agent AI Modul

Komplett isoliertes neues Modul. Keine bestehenden Dateien werden angefasst außer:
- `src/App.tsx` (nur neue Route hinzufügen)
- `src/components/AppSidebar.tsx` (nur neuer Nav-Eintrag)
- `supabase/config.toml` (neue Function registrieren)

## 1. Neue Route & Navigation

- Route: `/advanced-engineering-analysis`
- Sidebar-Eintrag "Advanced Analysis" mit `Sparkles`-Icon
- Neue Seite: `src/pages/AdvancedEngineeringAnalysis.tsx`

## 2. Frontend (Dual-Pane Dashboard)

Neue Komponenten unter `src/components/advanced/`:

- `AdvancedAnalysisPage.tsx` — Layout-Wrapper, ResizablePanelGroup (links Input, rechts Pipeline + Output)
- `AnalysisInputPanel.tsx` — Linker Bereich:
  - Prompt-Textarea (Beschreibung, Erwartungen, Ziele)
  - Drag-and-Drop-Zone (PDF, Bilder, CAD-Screenshots) inkl. Preview-Liste; HEIC/HEIF blockieren (Memory-Regel)
  - Reference-Selector: lädt Einträge aus `public.knowledge_items` (bestehende Wissensbasis), Multi-Select mit Toggle-Liste + Suchfeld
  - "Analyse starten"-Button
- `PipelineStatusPanel.tsx` — Rechter Bereich oben:
  - 4 Schritte (Aggregator, Gemini, Perplexity, Monica) als Stepper mit Icons + Spinner + Status (pending/running/done/error)
  - Live-Updates per Realtime-Subscription auf `analysis_runs`
  - Fehler-Anzeige pro Knoten + Retry-Button für einzelne Phasen
- `AnalysisReportView.tsx` — Rechter Bereich unten:
  - Render des finalen Markdown-Reports (react-markdown + remark-gfm für Tabellen, rehype-highlight für Syntax)
  - Tabs: "Final Report", "Gemini Blueprint", "Perplexity Validation"
  - Export-Button → PDF (jsPDF + html2canvas, lokal im Browser)
- `useAnalysisRun.ts` Hook — startet Run, subscribed Realtime, hält State

Design: Dark-mode-first, semantische Tokens aus `index.css`, Akzent `--accent` (Orange `#F59E0B`) für CTAs, JetBrains Mono für Technik-Output.

## 3. Backend — Asynchrone Multi-Agent-Pipeline

### Neue DB-Tabelle `analysis_runs`

Felder: `id`, `user_id`, `prompt`, `reference_ids[]`, `file_paths[]`, `status` (queued/running/done/error), `current_phase` (aggregator/gemini/perplexity/monica/done), `phase_status` (jsonb: per Phase pending/running/done/error + error message), `gemini_blueprint` (jsonb), `perplexity_validation` (jsonb), `monica_report` (text/markdown), `error`, `created_at`, `updated_at`. RLS: nur Owner. Realtime aktiviert.

### Neuer Storage-Bucket `analysis-uploads` (privat)

Pfad-Konvention `${user_id}/${run_id}/${filename}` (Memory-Regel).

### Neue Edge Functions (alle isoliert, eigene Ordner)

1. **`advanced-analysis-start`** (sync, schnell)
   - Validiert Input (Zod), legt `analysis_runs`-Zeile an (status=queued), lädt Files in Bucket (oder akzeptiert bereits hochgeladene Pfade), triggert `advanced-analysis-orchestrator` per `fetch` ohne `await` (fire-and-forget) und gibt `run_id` zurück.

2. **`advanced-analysis-orchestrator`** (async, lang laufend)
   - Phase 1 Aggregator: lädt Files als Base64/Signed-URLs, holt Referenz-Inhalte aus `knowledge_items`, baut strukturiertes Payload, aktualisiert `phase_status`.
   - Phase 2 Gemini: ruft Lovable AI Gateway (`google/gemini-2.5-pro`, multimodal mit `image_url`/`file`) mit fest definiertem System-Prompt → strukturierter JSON-Blueprint (Tool-Calling für Struktur). Speichert in `gemini_blueprint`.
   - Phase 3 Perplexity: ruft `https://api.perplexity.ai/chat/completions` mit `sonar-pro` (vorhandener `PERPLEXITY_API_KEY` Connector). Speichert `perplexity_validation`.
   - Phase 4 Monica: ruft Monica AI (`MONICA_API_KEY` vorhanden) mit `claude-sonnet-4` für Synthese → finaler Markdown-Report mit Executive Summary, CAD Modification Guide, Optimizations, Implementation Plan. Speichert `monica_report`, setzt `status=done`.
   - Robuste Fehler: pro Phase try/catch, max. 2 Retries mit Exponential Backoff, bei finalem Fehler `phase_status[phase].error` setzen + `status=error`, Pipeline stoppt aber vorhandene Outputs bleiben sichtbar.
   - Updates nach jeder Phase → Realtime pusht an Frontend.

3. **`advanced-analysis-retry`** — startet Pipeline ab einer bestimmten Phase neu (für Retry-Button im Frontend).

### Live-Updates

Supabase Realtime auf `analysis_runs` (UPDATE-Events, gefiltert nach `id`). Kein WebSocket-Eigenbau nötig — Postgres Changes erfüllen die Anforderung.

## 4. Technik / Sicherheit

- API-Keys (`LOVABLE_API_KEY`, `PERPLEXITY_API_KEY`, `MONICA_API_KEY`) ausschließlich serverseitig via `Deno.env.get`.
- Zod-Validierung aller Edge-Function-Inputs.
- CORS-Header (`npm:@supabase/supabase-js@2/cors`) in allen Functions.
- RLS strikt nach `auth.uid()`.
- Frontend-State: ein zentraler Hook `useAnalysisRun` + React Query für Listen historischer Runs.

## 5. Was NICHT angefasst wird

- `Dashboard`, `Loesung`, `Dokumentation`, `Settings`, `Auth`, `KnowledgeLibrary`, `RichMediaInput`, bestehende Edge Functions (`generate-solutions`, `process-knowledge`, `gdrive-browse` etc.) und bestehende Tabellen außer **lesendem** Zugriff auf `knowledge_items`.

## Offene Fragen

1. Soll die History aller Analysis-Runs als zusätzliche Liste/Sidebar im neuen Modul sichtbar sein, oder reicht der aktuelle Run pro Session?
2. PDF-Export: einfache HTML-zu-PDF-Konvertierung im Browser (jsPDF) ok, oder bevorzugst du serverseitige PDF-Erzeugung (höhere Qualität, langsamer)?
3. Perplexity-Modell: `sonar-pro` (Standard, schnell) oder `sonar-deep-research` (deutlich tieferer Report, mehrere Minuten Laufzeit)?
