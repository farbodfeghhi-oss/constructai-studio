
# Phase 6 — Picsart Visuals & Doc Render (Refactor)

Ziel: Die aktuelle, generische `generate-analysis-image` / `generate-picsart-doc` Logik wird komplett ersetzt durch **drei spezialisierte Picsart-Pfade**, die jeweils das richtige Picsart-Produkt nutzen. Picsart wird damit zur echten Phase 6 nach `docgen`.

---

## 1. Architektur-Übersicht

```text
Perplexity Pipeline (Phase 1-5)
        │
        ▼
┌────────────────────────────────────────────────┐
│ Phase 6: Picsart Visuals & Doc Render          │
│                                                │
│  6a) AI Hub – Konzept-Skizzen   (recraftv4)    │
│      → genai/text2image                        │
│                                                │
│  6b) Variable Data Content API – Datenblätter  │
│      → replay/apply-variables → PDF/PNG        │
│                                                │
│  6c) Programmable Image – CAD-Upload Aufwertung│
│      → upscale/ultra  +  removebg v10          │
└────────────────────────────────────────────────┘
        │
        ▼
analysis_runs.generated_images  (typed entries)
```

Ein gemeinsamer Pipeline-Eintrag mit `kind`:
`concept_sketch` | `data_sheet` | `cad_enhanced`.

---

## 2. Backend-Änderungen

### 2.1 `agent-docgen` erweitern (Phase 5 → Phase 6 Brücke)
Im JSON-Schema von `agent-docgen` zwei neue Pflichtfelder ergänzen, **damit Picsart niemals den Volltext bekommt**:

- `picsart_image_prompt: string` — ein kurzer, isolierter Bildprompt (z.B. *"clean technical vector illustration of a sheet-metal cover, blueprint style, white background, no text"*)
- `data_sheet_variables: Record<string,string>` — flache Key/Value-Map (Titel, Werkstoff, Norm, Toleranz, Maße, Stückzahl, …) für das Variable-Data-Template

Diese Felder werden in `analysis_runs.docgen_blueprint` (oder unter `final_structured`) gespeichert und sind die einzige Quelle für Picsart.

### 2.2 Neue Edge Function `picsart-concept-sketch` (ersetzt Teile von `generate-analysis-image`)
- Endpunkt: `POST https://genai-api.picsart.io/v1/text2image`
- Body (JSON): `{ model: "recraftv4", prompt: <picsart_image_prompt>, negative_prompt, width:1024, height:1024, count:1 }`
- Fallback-Modell: `flux-2-pro` (über `?model=flux` Param vom Frontend wählbar).
- Polling: `GET /v1/text2image/inferences/{id}` — Status-Whitelist **nur** `processing` | `success` | `error`. `processing` → weiter pollen, `success` → URL abholen, `error` → werfen.
- Header: `X-Picsart-API-Key`, `Content-Type: application/json`, `Accept: application/json`.
- Upload nach `analysis-uploads/${user_id}/generated/${run_id}/concept-*.png`, Eintrag `{kind:"concept_sketch", model, prompt, url, path}` an `generated_images` anhängen.

### 2.3 Neue Edge Function `picsart-datasheet` (Variable Data Content API)
- Verwendet ein in Picsart Studio vorbereitetes **Replay-Template** (Template-ID als Secret `PICSART_DATASHEET_TEMPLATE_ID`).
- Schritt A: `POST /v1/replay/apply-variables` mit `{ template_id, variables: data_sheet_variables }` → liefert `replay_id`.
- Schritt B: Export entweder
  - `POST /v1/replay/export` (PNG/JPG) **oder**
  - `POST /v1/replay2pdf` (PDF) — vom Frontend `format: "png" | "pdf"` gewählt.
- Polling identisch (`processing|success|error`).
- Ergebnis-Datei wird nach `analysis-uploads/${user_id}/generated/${run_id}/datasheet-*.{png|pdf}` gelegt, Eintrag `{kind:"data_sheet", template_id, variables, format, url, path}`.
- **Vorteil:** Texte (Toleranzen, Werkstoffe) werden gerendert, nicht halluziniert.

### 2.4 Neue Edge Function `picsart-enhance-upload` (Programmable Image API)
Input: `run_id`, `source_path` (eines der in Phase 1 hochgeladenen Bilder), `options: { upscale: true, remove_bg: true, shadow: true }`.

Pipeline (sequenziell, alles JSON außer der Erst-Upload):
1. **Ultra Upscale** — `POST /tools/v1/upscale/ultra` (async) → poll → upscaled URL.
2. **Remove Background v10** — `POST /tools/v1/removebg` mit `{ image_url, model: "v10", output_type: "cutout" }`.
3. Optional **Shadow for Remove Background** — `POST /tools/v1/removebg/shadow` für realistischen Schlagschatten.

Status-Handling: ausschließlich `processing|success|error`. Authentifizierung via `X-Picsart-API-Key`. Bevorzugt `application/json` Bodys; nur bei initialem Binär-Upload `multipart/form-data`.
Speicherung als `cad_enhanced` mit `source_path` Referenz.

### 2.5 Orchestrator-Anbindung
- `advanced-analysis-orchestrator` bekommt **keine automatische** Phase-6-Ausführung (bleibt on-demand vom User), aber:
  - Setzt nach `docgen` einen neuen Status `awaiting_visuals`.
  - `models_used.picsart_concept = "recraftv4"`, `models_used.picsart_datasheet = "replay-template:<id>"`, `models_used.picsart_enhance = "upscale-ultra+removebg-v10"` werden bei jedem Sub-Call geschrieben.

### 2.6 Cleanup
- Alte `generate-analysis-image` Funktion → in `picsart-concept-sketch` umbenennen/ersetzen (Routen bleiben kompatibel über Wrapper, der intern auf den neuen Pfad ruft, damit Frontend-Calls nicht brechen).
- `generate-picsart-doc` (alt, hartcodierte deutsche Prompts) → deprecated, ersetzt durch `picsart-datasheet`.
- `verify-analysis-image` bleibt unverändert und wird automatisch auch auf `concept_sketch` Ergebnisse anwendbar.

### 2.7 `config.toml`
Drei neue Function-Einträge mit `verify_jwt = false`:
```
[functions.picsart-concept-sketch]
[functions.picsart-datasheet]
[functions.picsart-enhance-upload]
```

### 2.8 Secrets
- `PICSART_API_KEY` (vorhanden)
- **Neu nötig:** `PICSART_DATASHEET_TEMPLATE_ID` — wird via `add_secret` angefordert, sobald das Template in Picsart Studio existiert.

---

## 3. Frontend-Änderungen (`AnalysisResultDialog.tsx`)

Die bestehende "Picsart"-Tab-Sektion wird in **drei Sub-Tabs** umgebaut:

1. **Konzept-Skizze** — Button "Skizze erzeugen" (`recraftv4`) + Modell-Toggle (`recraftv4` / `flux-2-pro`). Zeigt `picsart_image_prompt` aus docgen als read-only Preview vor Submit.
2. **Datenblatt rendern** — Tabelle aller `data_sheet_variables` (editierbar), Format-Switch **PNG / PDF**, Button "Datenblatt rendern". Download-Link nach Erfolg.
3. **CAD-Bild aufwerten** — Liste der `file_paths` aus dem Run, je Datei Checkboxen *Upscale*, *Remove BG*, *Shadow*, Button "Aufwerten".

Galerie unten gruppiert nach `kind` mit Badge (Konzept / Datenblatt / CAD-Enhanced). Bestehender Verify-Button bleibt pro Bild verfügbar.

---

## 4. Reihenfolge der Implementierung

1. `agent-docgen` JSON-Schema erweitern (`picsart_image_prompt`, `data_sheet_variables`)
2. Secret `PICSART_DATASHEET_TEMPLATE_ID` anfragen
3. Edge Function `picsart-concept-sketch`
4. Edge Function `picsart-datasheet`
5. Edge Function `picsart-enhance-upload`
6. `config.toml` aktualisieren
7. Frontend: Sub-Tabs + neue Hooks/Calls in `AnalysisResultDialog`
8. Alte `generate-picsart-doc` / `generate-analysis-image` deprecaten

---

## 5. Out of Scope
- Kein automatisches Triggern von Phase 6 nach `docgen` (bleibt user-initiiert).
- Kein Editor für Picsart-Templates im Frontend (Template wird in Picsart Studio gepflegt).
- Keine Änderungen an Phasen 1–5 außer dem `agent-docgen`-Schema-Patch.

---

## Offene Bestätigung
1. Du legst das Replay-Template in Picsart Studio an und gibst mir die Template-ID (ich frage sie via Secret-Tool ab) — OK?
2. Default-Modell für Konzept-Skizzen = `recraftv4`, `flux-2-pro` als Toggle — OK?
3. Datenblatt-Export-Default = **PDF** (über `replay2pdf`), PNG als Option — OK?
