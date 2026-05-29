
## Ziel

Erweiterung der bestehenden 4-Phasen-Pipeline (`aggregator → design → standards → docgen`) auf **5 Phasen** mit semantischer Vektorsuche in Phase 1 und einer neuen Reasoning-Phase 3 (`sonar-reasoning-pro` mit `<think>`-Parser).

---

## Backend

### 1. DB-Migration (`analysis_runs`)
- `ALTER TABLE public.analysis_runs ADD COLUMN verification_blueprint jsonb;`
- Default für `phase_status` aktualisieren auf:
  ```json
  {"aggregator":{"status":"pending"},"design":{"status":"pending"},"verification":{"status":"pending"},"standards":{"status":"pending"},"docgen":{"status":"pending"}}
  ```
- Bestehende laufende/queued Runs erhalten den neuen Default per Backfill.

### 2. Neue Edge Function `agent-verification`
- Endpoint: `https://api.perplexity.ai/chat/completions`
- Modell: `sonar-reasoning-pro`
- Input: `design_blueprint.content` + User-Prompt + RAG-Kontext
- System-Prompt: Senior-Maschinenbauingenieur — verifiziere Toleranzen, Materialkennwerte, Sicherheitsfaktoren, Lastannahmen, geometrische Plausibilität. Liefere JSON mit `verified_parameters`, `assumptions`, `warnings`, `corrections`.
- Nach Rückgabe: `parseReasoning()` aus `_shared/perplexity/reasoning.ts` aufrufen.
- Response shape:
  ```json
  { "thinking": "...<think>-Block...", "content": "Antworttext", "json": {...}, "citations": [...] }
  ```
- `verify_jwt = false` in `config.toml` ergänzen.
- Synchroner Call (kein Polling nötig — `sonar-reasoning-pro` antwortet innerhalb von Edge-Function-Limits).

### 3. Refactor `agent-rag-search` Aufruf in Phase 1
- `aggregatorPhase` im Orchestrator umbauen:
  - Statt `knowledge_items.extracted_text.slice(0, 4000)` für jede Referenz:
  - Pro Referenz (oder global über alle Referenzen) Aufruf von `agent-rag-search` mit `query = run.prompt`, `match_count = 8`, `min_similarity = 0.6`.
  - Ergebnis: Top-N relevante `knowledge_items` (id, title, ai_summary).
  - Falls die User-Auswahl `reference_ids` enthält, RAG-Suche auf diese Auswahl beschränken (per Filter in `match_knowledge_items`-RPC oder Nachfilter im Orchestrator).
  - Bilder: bestehende Signed-URL-Logik (60 Min TTL) unverändert.
- Edge Case: Wenn `agent-rag-search` `empty: true` zurückliefert, Fallback auf `ai_summary` der explizit gewählten Referenzen (kein hartes Abschneiden mehr).

### 4. Refactor `advanced-analysis-orchestrator/index.ts`
- `PHASES`-Konstante erweitern: `["aggregator","design","verification","standards","docgen"]`.
- Neue Funktion `verificationPhase(run, aggregatedContext, designBlueprint)`:
  - Ruft `agent-verification` auf, schreibt `verification_blueprint = { content, thinking, json, citations }` in DB.
- `standardsSubmit` (bestehende async Submit-Logik) erhält zusätzlich `verification_blueprint` im Prompt-Body.
- `docgenPhase` erhält alle drei Blueprints (Design + Verification + Standards) als Input.
- Phasen-Routing in `start_phase`-Handling und `advanced-analysis-retry` um `verification` ergänzen.

### 5. `advanced-analysis-retry/index.ts`
- `verification` als gültigen Retry-Phase-Key zulassen.

### 6. `supabase/config.toml`
- `[functions.agent-verification]` mit `verify_jwt = false` ergänzen.

---

## Frontend

### 7. `src/hooks/useAnalysisRun.ts`
- `PhaseKey` erweitern: `"aggregator" | "design" | "verification" | "standards" | "docgen"`.
- `AnalysisRun`-Interface um `verification_blueprint: any` ergänzen.

### 8. `src/components/advanced/PipelineStatusPanel.tsx`
- `PHASES`-Array auf 5 Einträge erweitern, neuer Schritt 3:
  ```
  { key: "verification", label: "Perplexity · Logical Verification",
    sub: "sonar-reasoning-pro · <think>-CoT · Toleranzen & Physik",
    icon: Calculator }
  ```

### 9. `src/components/advanced/AnalysisReportView.tsx`
- Neuer Tab `"verification"` mit Label „Mathematische Verifizierung".
- Anzeige:
  - **Reasoning (`<think>`)** in einem ausklappbaren `<details>`-Block, Monospace.
  - **Verifizierte Parameter** als Markdown aus `verification_blueprint.content`.
  - **Strukturiertes JSON** (`verified_parameters`, `warnings`, `corrections`) als Tabelle, falls `verification_blueprint.json` vorhanden.
  - Zitate wie bei Design/Standards.

### 10. `src/pages/AdvancedEngineeringAnalysis.tsx`
- Header-Untertitel anpassen: „100% Perplexity Pipeline · RAG → Design → Verification → Standards → Docgen".

---

## Technische Details

### Datenfluss

```text
User-Prompt + reference_ids + file_paths
         │
         ▼
[1] aggregator     → agent-rag-search (pplx-embed-v1-4b, cosine, top-N)
         │           + Signed URLs (60 min) für Bilder
         ▼
[2] design         → agent-design (Claude Opus 4.7 / Sonar Vision)
         │           ⇒ design_blueprint
         ▼
[3] verification   → agent-verification (sonar-reasoning-pro + parseReasoning)
         │           ⇒ verification_blueprint { thinking, content, json }
         ▼
[4] standards      → agent-standards (sonar-deep-research, async)
         │           + standards-tick Poller
         │           ⇒ standards_validation
         ▼
[5] docgen         → agent-docgen (sonar-pro json_schema)
                     ⇒ final_report
```

### Reasoning-Parser-Integration
- `_shared/perplexity/reasoning.ts` existiert bereits und liefert `{ thinking, answer, json }`.
- In `agent-verification` direkt auf `choices[0].message.content` anwenden, dann strukturiert speichern.

### RAG-Filter auf `reference_ids`
- Aktuell unterstützt `match_knowledge_items(query_embedding, match_count, p_user_id)` nur User-Scope.
- Plan: Im Orchestrator nach RPC-Call nachfiltern (`matches.filter(m => reference_ids.includes(m.id))`), falls `reference_ids.length > 0`. Optional spätere RPC-Erweiterung — nicht in dieser Iteration.

### Abwärtskompatibilität
- Alte Runs ohne `verification_blueprint` zeigen im Tab den Hinweis „Phase in dieser älteren Pipeline-Version nicht ausgeführt".

---

## Out of Scope
- Keine Änderungen an `agent-design`, `agent-standards`, `agent-standards-poll`, `agent-docgen`, `agent-rag-embed`.
- Kein Reasoning-Modell-Wechsel.
- Keine UI-Redesigns außer dem neuen Tab und dem 5. Pipeline-Step.
