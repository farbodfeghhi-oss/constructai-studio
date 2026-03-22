
Problemursache ist sehr wahrscheinlich nicht die KI-Analyse selbst, sondern der Speicherpfad beim PDF/Bild-Upload im Bereich „Wissen“:

- In `Dashboard.tsx` wird in den Bucket unter `knowledge/{user.id}/...` hochgeladen.
- Die vorhandene Storage-Richtlinie erlaubt Uploads aber nur, wenn der **erste Ordner exakt die User-ID** ist.
- Dadurch schlägt schon der Datei-Upload mit einer RLS-Verletzung fehl, und der Speichern-Flow bricht ab.

Geplanter Fix:

1. Speicherpfad im Wissen-Bereich korrigieren
- Upload-Pfad von `knowledge/${user.id}/...` auf `${user.id}/knowledge/...` oder direkt `${user.id}/...` umstellen, damit er zu den bestehenden Bucket-Regeln passt.
- Dadurch funktionieren PDF- und Bild-Uploads wieder mit der aktuellen Zugriffskontrolle.

2. Speichern-Flow robuster machen
- Datei-Upload und Datenbank-Insert klar trennen.
- Für jeden Schritt gezielte Fehlermeldungen anzeigen:
  - „Datei konnte nicht hochgeladen werden“
  - „Eintrag konnte nicht gespeichert werden“
- So ist sofort sichtbar, ob das Problem vom Bucket oder von der Tabelle kommt.

3. Login-/Session-Prüfung vor dem Speichern härten
- Vor Upload und Insert die aktuelle Session prüfen.
- Falls keine gültige Anmeldung vorhanden ist, den Speichervorgang sauber abbrechen und eine verständliche Meldung anzeigen statt einer generischen RLS-Fehlermeldung.

4. Wissen-Dialog für PDFs/Bilder nachbessern
- Sicherstellen, dass bei PDF/Bild nur gespeichert werden kann, wenn die Datei noch vorhanden ist.
- Nach erfolgreichem Speichern Dialog und Formularzustand sauber zurücksetzen und Liste direkt neu laden.

5. End-to-End-Testfälle absichern
- PDF hochladen → KI analysieren → speichern
- Bild hochladen → KI analysieren → speichern
- Link analysieren → speichern
- Danach prüfen, dass der Eintrag sofort im Bereich „Wissen“ sichtbar ist.

Betroffene Dateien:
- `src/pages/Dashboard.tsx` – Hauptfix für Upload-Pfad, Fehlerbehandlung und Speichern-Flow

Technische Details:
```text
Ist-Zustand:
knowledge/<user_id>/file.pdf

Erlaubt laut Storage-Policy:
<user_id>/...

Empfohlener Zielpfad:
<user_id>/knowledge/<timestamp>.pdf
```

Erwartetes Ergebnis nach dem Fix:
- PDF- und Bild-Einträge im Bereich „Wissen“ lassen sich nach erfolgreicher KI-Analyse wieder speichern.
- Die RLS-Fehlermeldung verschwindet.
- Der Nutzer sieht sofort, ob ein Fehler vom Upload oder vom Datenbankeintrag kommt.
