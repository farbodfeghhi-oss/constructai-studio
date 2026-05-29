## Ziel
Nach Abschluss eines Analyse-Runs öffnet sich automatisch ein großes Ergebnis-Fenster (Modal/Dialog), das den finalen Engineering-Report **plus** eine Meta-Sidebar zeigt und folgende Aktionen anbietet:

1. **Run-Metadaten** (AI-Rolle, Haupt-Prompt, Rechenzeit, Quellen, hochgeladene Dateien, verwendete Modelle pro Phase)
2. **Picsart-Bildgenerierung** auf Basis des Ergebnisses (Technische Zeichnungen / Doku-Bilder)
3. **Export** als **PDF**, **Word (.docx)** und **HTML**

## Backend-Änderungen

### 1. DB-Migration (`analysis_runs`)
Neue Spalten:
- `started_at timestamptz` (gesetzt beim Übergang `queued → running`)
- `completed_at timestamptz` (gesetzt beim Übergang auf `done`/`error`)
- `models_used jsonb` (z.B. `{"design":"claude-opus-4.7", "verification":"sonar-reasoning-pro", ...}`)
- `generated_images jsonb` (Array `{url, prompt, kind, created_at}`)

Backfill für laufende Runs nicht nötig.

### 2. Orchestrator (`advanced-analysis-orchestrator`)
- Setzt `started_at` beim ersten Phase-Wechsel und `completed_at` am Ende.
- Schreibt nach jeder Phase `models_used.<phase> = <model_name>` (aus jeweiliger Agent-Response).

### 3. Neue Edge Function `generate-analysis-image`
- Input: `run_id`, `kind` ("technical_drawing" | "documentation"), `prompt_override?`
- Liest `analysis_runs.final_report` + `design_blueprint`.
- Baut Picsart-Prompt (technische Zeichnung, isometrisch, Bemaßung etc.).
- Ruft Picsart API (`PICSART_API_KEY` ist bereits vorhanden, siehe `generate-picsart-doc`) → lädt Bild in Storage-Bucket `analysis-uploads/${user_id}/generated/`.
- Hängt Eintrag an `analysis_runs.generated_images`.

### 4. Neue Edge Function `export-analysis-report`
- Input: `run_id`, `format` ("pdf" | "docx" | "html")
- HTML: server-rendertes Markdown → HTML mit eingebettetem CSS, inkl. Meta-Tabelle und Bilder.
- PDF: HTML → PDF via Deno-kompatible Lib (`https://esm.sh/html-pdf-node` Fallback: PDFKit). Bevorzugt: einfache HTML-zu-PDF Route mit `pdf-lib` + minimaler Renderer; alternativ Browser-print im Frontend (siehe Fallback unten).
- DOCX: `docx`-NPM Lib via esm.sh → Buffer.
- Antwort: Base64-Blob oder Signed-URL (Upload nach `analysis-uploads/${user_id}/exports/`).

**Fallback (falls Deno-PDF schwierig):** Export rein clientseitig in den ersten Wurf:
- HTML: Blob aus Markdown→HTML
- PDF: `window.print()` über dedizierte Print-View
- DOCX: `docx` NPM-Paket clientseitig

Für saubere Architektur und Konsistenz wähle ich die **Edge-Function-Variante** (`export-analysis-report`).

## Frontend-Änderungen

### 1. Neue Komponente `AnalysisResultDialog.tsx`
- Vollbild-Dialog (`Dialog` aus shadcn, `max-w-[1400px]`).
- Öffnet sich automatisch, wenn `run.status === "done"` (gesteuert über lokalen State + Effekt in `AdvancedEngineeringAnalysis.tsx`, mit "X" zum Schließen).
- Layout: links Report (Markdown-Rendering), rechts Sidebar mit:
  - **Run-Info**: Plan-Name, Plan-Key (AI-Rolle), Erstellt am, Dauer (`completed_at - started_at`)
  - **Haupt-Prompt** (collapsible)
  - **Modelle pro Phase** (aus `models_used`)
  - **Quellen**: Citations aus Design / Verification / Standards / Docgen
  - **Hochgeladene Dateien**: aus `file_paths` (Filename + Signed-URL via Edge oder direct)
  - **RAG-Treffer**: Top-Knowledge-Items (aus `design_blueprint.rag_matches` falls vorhanden — sonst nur Anzahl Referenzen)
- Aktionen-Toolbar oben rechts:
  - Buttons: **Export PDF**, **Export Word**, **Export HTML** → ruft `export-analysis-report` und triggert Download.
  - Button: **Bilder mit Picsart erzeugen** → öffnet Sub-Dialog mit Prompt-Vorschlag (technische Zeichnung / Doku-Bild), ruft `generate-analysis-image`, zeigt Galerie der generierten Bilder unten im Report.

### 2. `AnalysisReportView.tsx`
- Bleibt für die Inline-Vorschau im Hauptpanel.
- Neuer Button "Vollbild-Ansicht" → öffnet `AnalysisResultDialog`.

### 3. `useAnalysisRun.ts`
- Felder ergänzen: `started_at`, `completed_at`, `models_used`, `generated_images`.

### 4. `AdvancedEngineeringAnalysis.tsx`
- Auto-Open-Effekt: wenn Run von `running` → `done` wechselt und Dialog noch nie für diesen Run geöffnet war.

## Out of Scope
- Keine Änderungen an Pipeline-Logik (aggregator/design/verification/standards/docgen).
- Keine Mehrsprachigkeit der Exports (Deutsch wie der Report).
- Keine Bearbeitung des Reports vor Export (read-only).
- Picsart-Bildgenerierung erzeugt einzelne Bilder on-demand, keine automatische Vollserie.

## Reihenfolge der Implementierung
1. DB-Migration (`started_at`, `completed_at`, `models_used`, `generated_images`)
2. Orchestrator-Patch (Timestamps + models_used)
3. Edge Function `generate-analysis-image`
4. Edge Function `export-analysis-report`
5. Frontend: Hook + Dialog + Auto-Open + Buttons
