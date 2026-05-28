
# Dashboard Redesign + AI Roles Manager

Komplett neu aufgebautes Dashboard als professionelle Präsentation der MechAI-Plattform. Plus passwortgeschützter Bereich zum Umschalten der AI-Backend-Rollen.

## 1. Dashboard – Was wird gelöscht

Aktueller Dashboard-Inhalt (Willkommen-Box, RichMediaInput, Quick Actions, Wissens-Grid, Aktuelle Projekte) wird **komplett aus `src/pages/Dashboard.tsx` entfernt**. Bestehende Komponenten wie `KnowledgeLibrary`, `RichMediaInput` bleiben unangetastet — sie sind über Sidebar / andere Routen weiterhin erreichbar.

## 2. Neues Dashboard – Aufbau (Blueprint Tech Stil)

Dark Hero auf `#0a0e27` Basis mit `#1e3a8a → #3b82f6` Verläufen und Orange `#F59E0B` Akzent. Dezente Animationen (Stufe 3): Fade-Ins, sanftes Parallax, Pulse auf Status-Dots, keine cinematic Overkills.

### a) Cinematic Hero
- Großer AI-generierter Background (Picsart, Blueprint-CAD-Render mit Stahl/Aluminium Komponenten, Schaltpläne, Iso-Linien) — generiert beim ersten Laden via neuer Edge Function, in `public.dashboard_assets` gecached
- Headline „MechAI · Engineering Intelligence Platform", Sub mit Tagline
- Animierte KPI-Counter (Projekte, gelöste Analysen, Wissensbasis-Einträge, AI-Runs) — Live aus DB

### b) Capability Showcase (6 Karten Grid)
Jede Karte: AI-generiertes Icon-Bild (Picsart), Titel, Beschreibung, „Öffnen"-CTA → existierende Route. Karten:
1. Lösungs-Generator (`/loesung`)
2. Advanced Engineering Analysis (`/advanced-engineering-analysis`)
3. Wissensbasis (`/`-Section bzw. Settings)
4. Komponenten-Datenbank (`/dokumentation`)
5. PDF / Doc Generator
6. AI Roles & Settings

### c) Pipeline Live-Feed
Horizontaler Stream der letzten 5 `analysis_runs` mit Status-Chips und Realtime-Updates.

### d) AI Models Bar
Visualisierung der angebundenen Provider (Perplexity, Monica) + aktive Rolle des aktuell gewählten Role-Plans.

### e) Footer-Section
Tech-Stack-Badges, Versions-Info.

## 3. Bild- & Animations-Pipeline

Neue Edge Function `dashboard-assets`:
- Beim ersten Aufruf pro User: generiert 7 Bilder via Picsart (`PICSART_API_KEY` vorhanden) — 1 Hero + 6 Capability-Icons
- Speichert URLs in neuer Tabelle `public.dashboard_assets` (`user_id`, `key`, `image_url`, `prompt`, `created_at`)
- Skeleton-Loader während Generierung, dann sanftes Fade-In
- „Bilder neu generieren"-Button (nur in Settings sichtbar)

Animationen via Tailwind-Keyframes (bestehend in `tailwind.config.ts`): `fade-in`, `scale-in`, neue `float-slow` und `gradient-shift`.

## 4. AI Roles Manager (passwortgeschützt)

### Neue Route `/ai-roles`
Sidebar-Eintrag „AI Rollen" mit `Shield`-Icon. Zugang gesperrt durch Passwort-Gate-Komponente.

### Passwort-Setup
- Passwort `81665060` wird beim ersten Migration-Run als **bcrypt-Hash** in `app_settings` Tabelle gespeichert (nicht im Code, nicht im Frontend lesbar)
- Validierung erfolgt ausschließlich in Edge Function `verify-admin-pass` (vergleicht eingegebenes Passwort gegen DB-Hash)
- Bei Erfolg: 30 Minuten gültiges Session-Token in `sessionStorage`

### 8 Vordefinierte Role-Plans
Speicherung in neuer Tabelle `public.ai_role_plans`:

| Key | Name | Provider | Modell | System-Prompt |
|---|---|---|---|---|
| `sheet_metal_expert` | Sheet Metal Expert | Perplexity + Monica | sonar-pro + claude-sonnet | DIN/ISO Blech-Fokus |
| `cost_optimizer` | Cost Optimizer | Perplexity + Monica | sonar-pro + claude-sonnet | Lieferanten + BOM |
| `standards_auditor` | Standards Auditor | Perplexity only | sonar-deep-research | Normen-Compliance |
| `rapid_prototype` | Rapid Prototype | Monica only | claude-sonnet | Schnelle Vorschläge |
| `senior_optimizer` | Senior Mechanical Engineer | Monica | claude-sonnet | Optimierung Funktion/Fertigbarkeit/Kosten |
| `tech_doc_generator` | Technical Doc Processor | Perplexity + Monica | sonar-pro + claude | Industrie-Standard Doku |
| `bom_strict` | BOM & Drawing Spec (RAG-strict) | Monica + Knowledge | claude-sonnet | NUR aus Kontext, keine Halluzinationen |
| `design_lead_review` | Design Lead Review | Perplexity + Monica | sonar-deep + claude | DIN-Cross-Check, Mängelreport |

Jeder Plan: `id`, `key`, `name`, `description`, `provider_mode`, `models`, `system_prompt`, `is_active`, `is_builtin`, `created_at`. Genau **ein** Plan ist global `is_active = true`.

### UI `/ai-roles` (nach Passwort-Eingabe)
- Karten-Grid mit allen 8 Plans, aktiver Plan visuell hervorgehoben
- „Aktivieren"-Button pro Karte → updated DB via Edge Function `update-active-role` (re-validates Passwort-Session)
- Optional: Edit-Modal für `system_prompt` pro Plan (auch passwortgeschützt)
- Sichtbarer Banner mit aktuell aktivem Plan an oberster Stelle

### Integration in bestehende AI-Calls
Bestehende Edge Functions (`generate-solutions`, `advanced-analysis-orchestrator`, etc.) bleiben strukturell **unverändert**. Sie lesen vor jedem Call den aktiven Plan:

```ts
const { data: plan } = await admin.from("ai_role_plans").select("*").eq("is_active", true).single();
// nutzt plan.system_prompt + plan.provider_mode
```

Das ist die einzige Änderung an bestehenden Edge Functions — minimaler Eingriff, keine Refaktorierung.

## 5. Datenbank

Neue Migration mit:
- `public.dashboard_assets` (user-scoped, RLS owner-only)
- `public.ai_role_plans` (global readable, edit nur via service_role/Edge Function; RLS: SELECT für authenticated, UPDATE/INSERT blockiert)
- `public.app_settings` (key/value, hält bcrypt Passwort-Hash; nur service_role Zugriff)
- Seed mit 8 Role-Plans + Passwort-Hash für `81665060`
- GRANTs für alle 3 Tabellen

## 6. Neue Edge Functions
- `dashboard-assets` — generiert/cached Picsart-Bilder pro User
- `verify-admin-pass` — vergleicht Passwort gegen bcrypt-Hash, gibt signiertes Token
- `update-active-role` — setzt aktiven Plan (validiert Token + Hash erneut)
- `update-role-prompt` — aktualisiert `system_prompt` eines Plans (validiert)

Alle nutzen `bcrypt` via `npm:bcryptjs`, lesen Passwort-Hash aus `app_settings`. CORS + Zod Validierung Standard.

## 7. Frontend – Neue Dateien
- `src/pages/Dashboard.tsx` (komplett neu)
- `src/pages/AiRoles.tsx`
- `src/components/dashboard/HeroSection.tsx`
- `src/components/dashboard/CapabilityGrid.tsx`
- `src/components/dashboard/LiveAnalysisFeed.tsx`
- `src/components/dashboard/StatsCounter.tsx`
- `src/components/dashboard/AiModelsBar.tsx`
- `src/components/admin/PasswordGate.tsx`
- `src/components/admin/RolePlanCard.tsx`
- `src/hooks/useDashboardAssets.ts`
- `src/hooks/useAdminSession.ts`

## 8. Sicherheit
- Passwort niemals im Frontend-Code, niemals im Bundle
- bcrypt Cost 12, in `app_settings`
- Edge Functions revalidieren bei jedem Mutating-Call das Passwort (Token + DB-Lookup)
- RLS auf `ai_role_plans`: nur SELECT für `authenticated`, alle Mutations nur über Edge Function mit `service_role`

## 9. NICHT angefasst
`Loesung`, `Dokumentation`, `Settings`, `Auth`, `AppSidebar` (nur neuer Menüeintrag „AI Rollen"), `App.tsx` (nur neue Route), `KnowledgeLibrary`, `RichMediaInput`, alle bestehenden Edge Functions außer dem oben genannten Mini-Patch für aktiven Plan.
