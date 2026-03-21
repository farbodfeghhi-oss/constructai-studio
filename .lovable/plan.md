

## Plan: Komponenten-Datenbank mit AI-Suche und Dokumentation als Referenz-System

### Zusammenfassung

Die **Dokumentation** wird zur zentralen Datenbank/Referenz, in der Nutzer Produkt-Links, PDFs, Katalogbilder und Beschreibungen speichern. Die **Komponenten-Suche** durchsucht diese Datenbank UND kann via Perplexity API im Internet suchen. AI-gestützte Metadaten-Vorschläge unterstützen den Nutzer bei der Erfassung.

### Datenbank-Schema

Neue Tabelle `components` mit RLS (nur eigene Einträge sehen/bearbeiten):

```text
components
  id            uuid PK
  user_id       uuid FK -> auth.users
  name          text NOT NULL
  description   text
  category      text (Maschinenelemente | Blech | Montage | Elektro | ...)
  keywords      text[]
  norm          text
  material      text
  supplier      text
  price         text
  size          text
  url           text           -- Produkt-Link
  image_urls    text[]         -- Bilder (base64 oder Storage-URLs)
  file_urls     text[]         -- PDFs, Katalogseiten
  source        text           -- 'manual' | 'web_search' | 'ai_import'
  created_at    timestamptz
  updated_at    timestamptz
```

Storage Bucket `component-files` fuer PDFs und Bilder.

### Edge Function: `search-components`

Neue Edge Function die Perplexity API nutzt um im Internet nach technischen Komponenten zu suchen basierend auf Nutzerbeschreibung + optionalen Keywords + optionalem Bild. Gibt strukturierte Ergebnisse zurueck (Name, Beschreibung, Link, geschaetzter Preis, Lieferant).

### Edge Function: `analyze-component`

Neue Edge Function die hochgeladene PDFs/Bilder analysiert und Metadaten vorschlaegt: Name, Kategorie, Keywords, Norm, Material. Nutzt Perplexity/Monica je nach Provider-Auswahl.

### Dokumentation-Seite (Umbau)

Bestehende Tabs bleiben erhalten. Neuer Tab **"Produkt-Datenbank"**:

- **Produkt hinzufuegen**: Formular mit Feldern fuer Link, Beschreibung, Kategorie, Keywords, Dateien (PDF/Bilder)
- **AI-Assistent**: Beim Einfuegen eines Links oder Hochladen einer Datei analysiert AI den Inhalt und schlaegt Kategorie, Keywords, Beschreibung vor
- **Nutzer bestaetigt/korrigiert** die AI-Vorschlaege vor dem Speichern
- **Produktliste**: Durchsuchbare Tabelle aller gespeicherten Produkte mit Filtern

### Komponenten-Suche (Umbau)

Bestehende hardcoded Daten + Datenbank-Ergebnisse zusammen durchsuchen:

1. **Lokale Suche**: Durchsucht `components`-Tabelle nach Keywords/Name/Kategorie
2. **AI-Websuche**: Neuer Bereich "Intelligente Suche" -- Nutzer beschreibt was gebraucht wird (Textarea + optionale Keywords + Bild-Upload via RichMediaInput)
3. **Suchergebnisse**: AI-Ergebnisse werden als Karten angezeigt mit "Zur Dokumentation hinzufuegen"-Button
4. **Archivieren**: Bei Bestaetigung wird das Ergebnis in die `components`-Tabelle gespeichert

### AI-Unterstuetzung ueberall

- **Dokumentation**: AI schlaegt Metadaten vor beim Hinzufuegen
- **Komponenten-Suche**: AI-Websuche + AI-Vorschlaege fuer aehnliche Produkte
- **Smart Autocomplete**: Kategorie- und Keyword-Vorschlaege basierend auf Beschreibung

### Dateien

| Aktion | Datei |
|--------|------|
| Migration | `components`-Tabelle + RLS + Storage Bucket |
| Create | `supabase/functions/search-components/index.ts` |
| Create | `supabase/functions/analyze-component/index.ts` |
| Modify | `src/pages/Dokumentation.tsx` -- Neuer Tab "Produkt-Datenbank" |
| Modify | `src/pages/Komponenten.tsx` -- AI-Websuche + DB-Integration |

### Clever AI

Zur Integration von "Clever AI": Es konnte keine oeffentliche API-Dokumentation fuer diesen Dienst gefunden werden. Bitte teile die genaue URL oder den Anbieter-Namen mit, damit ich die Moeglichkeiten pruefen kann.

