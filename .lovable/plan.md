

## Plan: "Wissen" (Knowledge Base) Bereich auf dem Dashboard

### Zusammenfassung

Ein neuer "Wissen"-Bereich auf dem Dashboard, in dem Nutzer Bilder, PDFs, Praesentationen und Links hochladen und kategorisieren koennen. Die Inhalte werden in der Datenbank gespeichert und von der KI gelesen, um bessere Loesungsvorschlaege zu liefern.

### Datenbank

Neue Tabelle `knowledge_items` mit RLS (nur eigene Eintraege):

```text
knowledge_items
  id              uuid PK
  user_id         uuid NOT NULL
  title           text NOT NULL
  description     text
  category        text NOT NULL
  content_type    text  ('pdf' | 'image' | 'link' | 'presentation' | 'other')
  file_url        text  -- Storage-URL fuer hochgeladene Dateien
  link_url        text  -- fuer Internet-Links
  extracted_text  text  -- von KI extrahierter/zusammengefasster Inhalt
  ai_summary      text  -- KI-Zusammenfassung
  keywords        text[]
  created_at      timestamptz
```

Dateien werden im bestehenden `component-files` Storage Bucket gespeichert (oder einem neuen `knowledge-files` Bucket).

### Dashboard-Integration

Neuer Bereich "Wissen" auf dem Dashboard zwischen Quick Actions und Aktuelle Projekte:

- **Upload-Karte**: Drag-and-drop oder Dateiauswahl fuer PDFs, Bilder, Praesentationen + URL-Eingabefeld fuer Links
- **Kategorie-Auswahl**: Nutzer waehlt/erstellt Kategorie (z.B. "Werkstoffe", "Normteile", "Fertigungsverfahren", "Elektro")
- **KI-Verarbeitung**: Nach Upload analysiert die KI den Inhalt (PDF-Text, Bild-Erkennung, Link-Scraping) und erstellt Zusammenfassung + Keywords
- **Uebersicht**: Kompakte Liste der letzten Wissenseintraege mit Kategorie-Badges und Suchfeld

### KI-Integration in Loesungsvorschlaege

Die `generate-solutions` Edge Function wird erweitert:
- Vor dem Generieren werden relevante `knowledge_items` des Nutzers aus der DB geladen (nach Keywords/Kategorie gefiltert)
- Der extrahierte Text wird als zusaetzlicher Kontext in den System-Prompt eingefuegt
- So kann die KI auf das gespeicherte Fachwissen zugreifen

### Edge Function: Wissensverarbeitung

Neue Edge Function `process-knowledge` oder Erweiterung von `analyze-component`:
- PDF: Text extrahieren und zusammenfassen
- Bild: Inhalt beschreiben (Katalogseite, technische Zeichnung etc.)
- Link: Seiteninhalt abrufen (via Fetch) und zusammenfassen
- Ergebnis: `extracted_text` + `ai_summary` + `keywords[]` zurueck an Client

### Dateien

| Aktion | Datei |
|--------|------|
| Migration | `knowledge_items` Tabelle + RLS |
| Modify | `src/pages/Dashboard.tsx` -- Neuer "Wissen"-Bereich |
| Create | `supabase/functions/process-knowledge/index.ts` -- KI-Analyse von Uploads |
| Modify | `supabase/functions/generate-solutions/index.ts` -- Knowledge-Kontext laden |
| Modify | `supabase/config.toml` -- neue Function registrieren |

### Ablauf fuer den Nutzer

1. Nutzer klickt "Wissen hinzufuegen" auf dem Dashboard
2. Waehlt Dateityp (PDF/Bild/Link/Praesentation) und laedt hoch oder gibt URL ein
3. Waehlt/erstellt Kategorie und gibt optionale Beschreibung ein
4. KI analysiert den Inhalt automatisch und zeigt Zusammenfassung + vorgeschlagene Keywords
5. Nutzer bestaetigt -- Eintrag wird in `knowledge_items` gespeichert
6. Bei spaeteren Loesungsanfragen wird das gespeicherte Wissen automatisch als Kontext verwendet

