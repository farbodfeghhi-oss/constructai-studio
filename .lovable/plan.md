## Ziel
Drei Erweiterungen für MechAI:
1. Voller Editor für AI-Rollen-Pläne (Name, Beschreibung, System-Prompt, Modelle) unter `/ai-roles`
2. Aktiver Plan wird pro `analysis_runs`-Datensatz mitgespeichert und sichtbar gemacht
3. Dashboard erhält "Visuals neu generieren"-Button mit Ladestatus pro Asset

---

### Phase 1 · Datenbank-Migration

**Neue Spalten in `public.analysis_runs`:**
- `plan_id UUID NULL` — Referenz auf den verwendeten `ai_role_plans.id`
- `plan_key TEXT NULL` — Snapshot des Keys (überlebt Plan-Löschung)
- `plan_name TEXT NULL` — Snapshot des Namens zur Anzeige in der Historie

### Phase 2 · Edge Functions

**`update-role-plan` (neu)** — Admin-Endpoint mit Passwortprüfung (analog zu `update-role-prompt`). Akzeptiert `password`, `plan_id`, plus optional: `name` (1–80), `description` (1–500), `system_prompt` (min 10), `models` (JSON-Objekt). Validiert mit Zod und schreibt nur übergebene Felder via Service-Role.

**`advanced-analysis-start` (Update)** — Liest vor dem Insert den aktuell aktiven Plan (`ai_role_plans.is_active = true`, neuester) und schreibt `plan_id`, `plan_key`, `plan_name` in den neuen Run.

**`dashboard-assets` (Update)** — Akzeptiert neuen Body-Parameter `keys: string[]`, um einzelne Assets gezielt neu zu rendern. `force: true` regeneriert weiterhin alles.

### Phase 3 · Frontend — AI-Rollen-Editor

**`RolePlanCard.tsx`** komplett editierbar machen:
- Inline-Editor (Modus „Bearbeiten") mit Feldern: Name, Beschreibung (Textarea), System-Prompt (Textarea), Modelle (JSON-Editor mit Validierung + Hilfe-Tooltip mit Schema-Beispiel)
- Speichern ruft neue `update-role-plan` Function
- Bestehender „Prompt bearbeiten"-Modus wird durch „Plan bearbeiten" ersetzt (umfassender)
- Read-only Spec-Badges (api_mode, endpoint, tools, etc.) bleiben unverändert sichtbar

### Phase 4 · Frontend — Plan-Anzeige in Analysis Runs

**`LiveAnalysisFeed.tsx`** und **`AnalysisHistory.tsx`**: Pro Run-Zeile ein kleines Plan-Badge (`plan_name`) neben Status anzeigen.

**`useAnalysisRun.ts`** Typ: `plan_id`, `plan_key`, `plan_name` ergänzen.

**`AnalysisReportView.tsx`**: Header zeigt verwendeten Plan ("Ausgeführt mit Rolle: …").

### Phase 5 · Frontend — Dashboard Asset-Regeneration

**`useDashboardAssets.ts`** erweitern um:
- `regenerateKey(key: string)`-Methode für Einzel-Regeneration
- State `regeneratingKeys: Set<string>` zur Anzeige pro Asset

**`HeroSection.tsx`** & **`CapabilityGrid.tsx`**:
- Hover-Overlay-Button „Neu generieren" auf Hero und jeder Capability-Kachel
- Lade-Spinner-Overlay während ein einzelnes Asset regeneriert wird
- Hero zusätzlich: globaler „Alle Visuals neu generieren"-Button (versteckt hinter kleinem Refresh-Icon oben rechts)

---

### Technische Details
- `models`-JSON-Editor: einfaches `Textarea` mit `JSON.parse`-Validierung beim Speichern (Toast bei Fehler) — kein zusätzlicher Library-Bedarf
- Plan-Snapshot in Runs läuft unabhängig vom aktuellen Status der Pläne — gelöschte oder umbenannte Pläne brechen die Historie nicht
- Asset-Regeneration nutzt bestehenden Picsart-Flow; Polling läuft serverseitig, Client zeigt nur Spinner bis Response
- Alle Edge-Function-Updates behalten `verify_jwt = false`-Default (Admin-Passwort schützt Mutations)

### Out of Scope
- Erstellen komplett neuer Pläne (nur Editieren bestehender)
- Versionierung der Plan-Änderungen
- Bulk-Aktionen über mehrere Pläne