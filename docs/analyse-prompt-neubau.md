# Analyse-Auftrag: Ist der Neubau vollständig?

Kopiere alles unterhalb der Linie in einen anderen Agenten (Arbeitsverzeichnis: das Repo).

---

Du prüfst ein Projekt, du baust nichts. Ändere keine Quelldatei, committe nichts, pushe nichts.
Einzige Datei, die du anlegst: `docs/analyse-befunde-neubau.md`.

## Kontext

Repo `~/Projekte/aktiv/shinkgs` = GoTV (github.com/ajiai-labs/GoTV): Go-TV-App (Übertragungen,
Turnierkalender, Kanäle, Nachspielen mit KataGo) und vollständiger Client für den KGS Go Server.

- **Alte App:** React 16 + Flow im Repo-Wurzelverzeichnis. Oberfläche `src/ui/` (87 Dateien),
  Logik `src/model/`, `src/util/`, Styles `src/css/`.
- **Neue App:** Svelte 5 + SvelteKit + TypeScript in `app/`. Oberfläche `app/src/lib/ui/` und
  `app/src/routes/`, Logik als TypeScript-Kopie in `app/src/lib/model/`, `app/src/lib/util/`.
- Ziel des Neubaus: **jede Funktion der alten App 1:1**, nur im neuen Design (zwei Designs
  „Modern“ und „Oldschool“), lauffähig im Browser, auf dem iPad (Safari) und als Desktop-App.
- Lies zuerst: `docs/umbau-svelte.md` (Plan, Stand, bekannte Abweichungen), `docs/neubau-regeln.md`
  (Regeln des Nachbaus), `AGENTS.md` Abschnitte „Architektur — Go-TV-Modul“, „TV-Quellen-Grundsatz“,
  „Desktop-App“ (beschreiben jede GoTV-Funktion genau), `app/README.md`.
- Die Commit-Texte von `git log --oneline 7a6a0b2..HEAD -- app desktop` nennen bewusste
  Abweichungen je Bereich. Eine dort begründete Abweichung ist kein Befund.

## Auftrag

1. **Funktionsabgleich alt gegen neu.** Gehe jede Datei in `src/ui/` durch (auch `src/App.js`,
   `src/index.js` außer dem Dev-Harness-Block). Liste jede für Nutzer sichtbare Funktion: Knöpfe,
   Eingaben, Anzeigen, Zustände (lädt / leer / Fehler / offline), Tastenkürzel, gespeicherte
   Einstellungen (`localStorage`-Schlüssel `gotv.*`, IndexedDB `savedLogin`), Texte mit Inhalt.
   Finde für jede die Stelle in der neuen App oder halte fest, dass sie fehlt.
2. **Aktionen.** Jede Methode von `AppActions` (`app/src/lib/model/AppActions.ts`): Wird sie in der
   neuen Oberfläche aufgerufen, wo die alte sie aufgerufen hat? Liste nicht mehr aufgerufene.
3. **Logik-Kopie.** Vergleiche `src/model`, `src/util` mit `app/src/lib/model`, `app/src/lib/util`
   (inhaltlich, nicht Typ-Syntax). Unterschiede, die das Verhalten ändern?
4. **Plattformen.** Prüfe im Code, nicht nur in Kommentaren:
   - Web-Version (GitHub Pages, `VITE_GUEST_ONLY=true`): was ist dort sichtbar, funktioniert
     Offline (`app/src/service-worker.ts` gegen `public/gotv-sw.js`)?
   - Desktop: `desktop/install.sh`, `desktop/goTV_local.py` (Proxy `/json/access`, Host-/Origin-Prüfung,
     vorgerenderte Seiten), täglicher Kalender-Timer (`tools/refresh_tv_events.py` schreibt in
     `build-desktop/`).
   - iPad: Bedienung ohne Hover, Querformat 1180x820 ohne Scrollen in Brettansichten.
5. **Selbst ausführen** (in `app/`): `npm ci` falls nötig, `npm run check`, `npm run lint`, `npm test`,
   `npm run build`. Ergebnisse festhalten. Wenn möglich `npm run dev` und die Seiten im Browser öffnen
   (ohne KGS-Konto: Live, Kalender, Kanäle, Nachspielen, Einstellungen, Anmeldeformular).
6. **Was KGS kann, aber keine der beiden Apps:** Liste Funktionen des KGS-JSON-Protokolls
   (https://www.gokgs.com/json/protocol.html, Unterseiten upstream/downstream), die weder alte noch
   neue App nutzt, z. B. Automatch (`AUTOMATCH_CREATE`, `AUTOMATCH_SET_PREFS`, `AUTOMATCH_CANCEL`,
   `AUTOMATCH_STATUS`, `AUTOMATCH_PREFS` - letztere wird schon empfangen und gespeichert, aber nicht
   angezeigt). Nur auflisten mit Nutzen in einem Satz, nicht bewerten, nicht planen.

## Regeln

- Belege jeden Befund mit Pfad und Zeile (alt und neu). Keine Vermutung ohne Beleg; wenn du etwas
  nicht prüfen konntest, schreib „nicht geprüft“ und warum.
- Keine Lösungsvorschläge, keine Umbaupläne. Nur feststellen.
- Nicht melden: Formatierung, Benennung, Stilfragen, die keine Funktion betreffen.

## Ergebnis: `docs/analyse-befunde-neubau.md`

1. Kurzfazit (3-5 Sätze): Wie vollständig ist der Neubau, wo liegen die Lücken?
2. Tabelle der Befunde, sortiert nach Schwere:

   | # | Schwere | Bereich | Funktion | Alt (Datei:Zeile) | Neu (Datei:Zeile oder „fehlt“) | Befund |
   |---|---|---|---|---|---|---|

   Schwere: **kritisch** (Funktion fehlt oder ist kaputt, Nutzer merkt es sofort), **hoch** (fehlt in
   einem Teilfall oder verhält sich anders als vorher), **mittel** (Zustand/Text/Speicherung fehlt),
   **niedrig** (Kleinigkeit).
3. Liste „nicht geprüft“ mit Grund.
4. Ergebnis der Befehle aus Punkt 5.
5. Liste aus Punkt 6 (KGS-Funktionen, die keine App nutzt).
