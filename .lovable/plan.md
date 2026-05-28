## Ziel

Den Bereich „Dokumentation" zu einer schlanken „Wissensbasis" umbauen mit drei Tabs:
1. **DIN/ISO Normen** – Upload + Suche + Aktivieren/Deaktivieren
2. **Technische Daten** (vorher „Produkt-Datenbank") – Upload + Suche + Aktivieren/Deaktivieren
3. **Release-Checkliste** – unverändert

Stückliste und Materialien werden komplett entfernt. Alle bisherigen Demo-Daten in DIN/ISO Normen und Produkt-Datenbank werden gelöscht.

## Umfang

### Navigation & Seite
- Sidebar-Eintrag „Dokumentation" → **„Wissensbasis"** umbenennen (`src/components/AppSidebar.tsx`).
- `src/pages/Dokumentation.tsx` neu strukturieren:
  - Titel „Wissensbasis", neue Kurzbeschreibung.
  - Tabs „Stückliste" und „Materialien" entfernen (samt Logik, Konstanten, State).
  - Tabs „DIN/ISO Normen" und „Technische Daten" durch neue Wissens-Komponente ersetzen.
  - Tab „Release-Checkliste" unverändert lassen.

### Neue Wissens-Komponente (für beide Bereiche wiederverwendet)
Eine gemeinsame Komponente `KnowledgeLibrary` mit Prop `scope: "norm" | "technical"`:

- **Upload-Bereich**: PDF, Bild (PNG/JPG/WEBP), URL, freier Text. Keine Größenbeschränkung im Frontend; auch Server-Limits beachten (siehe technische Details).
- **Fortschrittsanzeige**: Prozent-Balken für Upload + Extraktion + KI-Analyse (Phasen: Upload 0–40%, Textextraktion 40–80%, KI-Analyse 80–100%).
- **Automatische Metadaten**: Nach Extraktion ruft eine Edge Function die KI auf und liefert **Quelle-Name** (Titel) und **Quelle-Fachbereich** (Kategorie) plus Keywords und Zusammenfassung.
- **Suchfeld**: Filtert über Titel, Fachbereich, Keywords, Zusammenfassung und Volltext.
- **Aktivieren/Deaktivieren-Schalter** pro Eintrag (Switch). Nur aktive Einträge werden bei neuen Projekten/Lösungen berücksichtigt.
- **Listendarstellung**: Kartenliste mit Titel, Fachbereich-Badge, Quelltyp-Icon, Zusammenfassung, Schalter, Löschen-Button.

### Datenbank
Bestehende Tabelle `public.knowledge_items` wird erweitert (statt einer neuen Tabelle), da sie bereits Felder für Titel, Beschreibung, Kategorie, Datei-URL, Link, Extracted Text, AI Summary und Keywords besitzt.

Migration:
- Spalte `scope text not null default 'technical'` hinzufügen (Werte: `'norm'`, `'technical'`).
- Spalte `is_active boolean not null default true` hinzufügen.
- Spalte `source_name text` (= „Quelle-Name", vom KI-Analyse-Schritt).
- Spalte `domain text` (= „Quelle-Fachbereich").
- Spalte `updated_at` + Trigger.
- Bestehende Demo-Daten in `public.components` werden gelöscht. Die Tabelle `components` bleibt erhalten, wird aber von der Wissensbasis nicht mehr verwendet (Komponenten-Suche-Modul nutzt sie weiterhin).

### Storage
- Neuer Bucket `knowledge-files` (privat) für PDFs/Bilder.
- RLS-Policies: nur eigener User darf in `${user.id}/...` schreiben/lesen.

### Edge Function
Neue Edge Function `process-knowledge-source` (bzw. bestehende `process-knowledge` erweitern):
- Eingaben: `{ scope, contentType: 'pdf'|'image'|'url'|'text', fileUrl?, text?, linkUrl? }`.
- Schritte: Text extrahieren (PDF via `pdfjs-dist` im Browser vor Upload, Bild via Vision-Modell, URL via Firecrawl-ähnlichem Scrape **oder** direkt KI mit URL, Text 1:1).
- KI-Aufruf (Lovable AI Gateway, `google/gemini-3-flash-preview`) liefert JSON `{ source_name, domain, summary, keywords[] }`.
- Liefert Metadaten + Extracted Text an Client zur Speicherung.

### Integration mit „Neue Projekte / Lösungen"
- In `generate-solutions` und `generate-prompt` Edge Functions die aktiven Wissens-Items (`is_active = true`) des Users laden und als Kontext in den Prompt einfügen (Titel + Zusammenfassung der relevantesten Treffer).

## Technische Details

```text
Tabs (neu):
  DIN/ISO Normen   → KnowledgeLibrary scope="norm"
  Technische Daten → KnowledgeLibrary scope="technical"
  Release-Checkliste → unverändert
```

Upload-Flow (Client):
```text
1. User wählt PDF/Bild/URL/Text
2. Bei Datei: in Browser nach Storage hochladen → fileUrl
   Fortschritt 0–40% via XHR/upload progress
3. Bei PDF: pdfjs-dist im Browser extrahiert Volltext (40–70%)
   Bei Bild: an Edge Function senden für Vision-Analyse
4. Edge Function `process-knowledge-source` aufrufen (70–95%)
5. Insert in knowledge_items mit scope, source_name, domain,
   keywords, ai_summary, extracted_text, is_active=true (95–100%)
```

Edge Function Body:
```ts
{
  scope: "norm" | "technical",
  contentType: "pdf" | "image" | "url" | "text",
  rawText?: string,   // für PDF/Text
  imageBase64?: string,
  linkUrl?: string,
}
→ { source_name, domain, summary, keywords[] }
```

Limits:
- Frontend: keine künstliche Größenprüfung für PDFs.
- Supabase Storage Standard-Limit (50 MB) wird respektiert; falls größer, Hinweis-Toast.
- Edge Function `process-knowledge-source` schneidet Volltext auf z.B. ersten 30k Zeichen für KI-Analyse, speichert aber vollen Text in DB.

Betroffene Dateien:
- `src/pages/Dokumentation.tsx` – komplett neu strukturiert
- `src/components/KnowledgeLibrary.tsx` – **neu**
- `src/components/AppSidebar.tsx` – Eintrag umbenennen
- `supabase/functions/process-knowledge-source/index.ts` – **neu**
- `supabase/functions/generate-solutions/index.ts` – aktive Wissens-Items als Kontext
- `supabase/functions/generate-prompt/index.ts` – dito
- Migration: Spalten `scope`, `is_active`, `source_name`, `domain`, `updated_at` auf `knowledge_items`; Bucket `knowledge-files` + Policies; Löschen der Komponenten-Demo-Daten

## Ergebnis

- Sidebar zeigt „Wissensbasis"; Seite hat nur noch 3 Tabs.
- Beide Wissens-Bereiche akzeptieren PDF/Bild/URL/Text mit Fortschrittsanzeige.
- KI ermittelt automatisch „Quelle-Name" und „Quelle-Fachbereich".
- Suche durchsucht Titel, Fachbereich, Keywords und Volltext.
- Aktivieren/Deaktivieren steuert, ob ein Eintrag bei neuen Lösungen herangezogen wird.
- Release-Checkliste bleibt unverändert.
