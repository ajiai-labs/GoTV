# Umbau auf Svelte 5 – Plan

Stand 24.11.2026. Entscheidung des Nutzers: GoTV ist ein eigenes Projekt (Fork-Verbindung zu
jkk/shinkgs gelöst) und bekommt ein neues Frontend. Vorbild für Aufbau und Verhalten ist
**CGoban 3**, das offizielle KGS-Programm ("das alte KGS"), nicht die Oberfläche von Shin KGS.
Grafiken, Steine oder Texte aus CGoban werden NICHT übernommen (gehören KGS); nachgebaut
werden nur Aufbau und Verhalten.

## Grundsätze

1. **Die heutige App läuft weiter**, bis die neue sie überholt hat. Desktop-App, Web-Version
   und nächtlicher Kalender bleiben in jeder Phase unverändert nutzbar.
2. **Logik wird mitgenommen, nicht neu erfunden.** KGS-Protokoll, SGF, Spielbaum, OGS,
   KataGo, Kalender, Kanäle, Sicherung: übersetzt von Flow nach TypeScript, mit ihren Tests.
   Neu geschrieben wird nur die Oberfläche.
3. **Jede Phase endet lauffähig**, mit Tests, Commit und Push - wie bisher.
4. **Keine neuen Server.** Alles läuft im Browser bzw. über den vorhandenen lokalen
   Desktop-Server `desktop/goTV_local.py`.

## Technik

| Was | Wahl | Warum |
|---|---|---|
| Oberfläche | Svelte 5 (Runes) | schlank, kennt der Nutzer (KAiTix) |
| Rahmen | SvelteKit mit `adapter-static` (SPA) | Routen (`/tv`, `/watch`, ...), läuft auf GitHub Pages (`paths.base = /GoTV`) und hinter dem Desktop-Server |
| Sprache | TypeScript (strict) | ersetzt Flow, das nicht mehr gepflegt wird |
| Build | Vite | ersetzt react-scripts 3: kein `openssl-legacy-provider`, keine Sass-Krücken |
| Tests | Vitest + @testing-library/svelte | Jest-kompatibel, die vorhandenen Tests ziehen fast unverändert um |
| Stil | schlichtes CSS mit Variablen (hell/dunkel) | kein Sass mehr nötig |

**Ort:** im selben Repository, neuer Ordner `app/`. Eigener CI-Job. Die alte App im
Wurzelordner bleibt bis Phase 6 unberührt.

## Phasen

| Phase | Inhalt | fertig, wenn ... | Aufwand |
|---|---|---|---|
| 0 | Gerüst: SvelteKit + TS + Vitest + Lint in `app/`, CI-Job, leere Startseite auf einer Vorschau-Adresse | `npm run build` und Tests grün in der CI | ~2 Std. |
| 1 | Logik umziehen: `src/model`, `src/model/game`, `src/util` -> `app/src/lib/` als TypeScript, mit allen Tests; `AppStore`/`AppActions` werden Svelte-Stores | alle übernommenen Tests grün | ~8 Std. |
| 2 | **KGS-Kern im CGoban-Aufbau:** Anmelden, Raumliste, Räume (Chat, Nutzer, Partien), Partien beobachten, Brett (neu als SVG), Nutzerinfo | man kann sich anmelden, Räume betreten und Partien beobachten wie in CGoban | ~12 Std. |
| 3 | Spielen: Herausforderungen, eigene Partie, Zählen | eine Partie gegen einen Menschen läuft durch | ~5 Std. |
| 4 | GoTV-Teile: Live, Kalender, Kanäle, Nachspielen mit KataGo und Varianten, Mein GoTV, Meine Daten, Offline | alles, was die heutige App kann, geht auch in der neuen | ~20 Std. |
| 5 | Desktop: `install.sh` baut `app/`, Proxy unverändert | Desktop-App startet die neue Oberfläche | ~2 Std. |
| 6 | Umschalten: GitHub Pages auf `app/`, alte React-App entfernen (nur nach ausdrücklicher Bestätigung) | eine App, ein Build | ~2 Std. |

Gesamt grob 50 Arbeitsstunden.

## Vom Nutzer zu klären (vor Phase 2)

Was genau macht CGoban besser? Bitte 3-5 Punkte, z. B.:
- Raumliste mit Kategorien wie in CGoban?
- jeder Raum mit eigenem Chat, Nutzer- und Partieliste nebeneinander?
- Beobachten in einem eigenen Fenster/Tab, mehrere gleichzeitig?
- Herausforderungen und offene Spiele so wie in CGoban?
- Tastenkürzel, Rechtsklick-Menüs, Fensteraufteilung?

## Nicht Teil des Umbaus

- Rust/Tauri: später möglich (dieselbe Svelte-App in Tauri), jetzt nicht.
- Neue Server, Web-Push, YouTube-API, AppImage (siehe AGENTS.md "Nächste Schritte").
