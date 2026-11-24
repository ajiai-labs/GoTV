# Umbau auf Svelte 5 – Plan

Stand 24.11.2026. Entscheidung des Nutzers: GoTV ist ein eigenes Projekt (Fork-Verbindung zu
jkk/shinkgs gelöst) und bekommt ein neues Frontend: **Svelte 5 + TypeScript mit einem eigenen,
modernen Design (Stand 2026)**. Ausdrücklich KEIN Nachbau von CGoban oder Shin KGS. Zuerst
wird die Codebasis modernisiert, dann die Oberfläche neu gestaltet. Ein Werkzeug zum
Zurückentwickeln (z. B. REA) ist nicht nötig: der gesamte Quellcode liegt vor.

## Grundsätze

1. **Die heutige App läuft weiter**, bis die neue sie überholt hat. Desktop-App, Web-Version
   und nächtlicher Kalender bleiben in jeder Phase unverändert nutzbar.
2. **Logik wird mitgenommen, nicht neu erfunden.** KGS-Protokoll, SGF, Spielbaum, OGS,
   KataGo, Kalender, Kanäle, Sicherung: übersetzt von Flow nach TypeScript, mit ihren Tests.
   Neu geschrieben wird nur die Oberfläche.
3. **Jede Phase endet lauffähig**, mit Tests, Commit und Push - wie bisher.
4. **Keine neuen Server.** Alles läuft im Browser bzw. über den vorhandenen lokalen
   Desktop-Server `desktop/goTV_local.py`.
5. **Funktional wie vorher, auch auf dem iPad** (Wunsch des Nutzers, 24.11.2026): die neue
   App muss alles können, was die heutige kann - als Browser-App in Safari auf dem iPad und
   in der Desktop-App. Komponententests laufen deshalb in der CI zusätzlich in WebKit
   (Safaris Engine); lokal fehlen dafür Systempakete (sudo), lokal nur Chromium.

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
| 0 ✅ | Gerüst: SvelteKit 3 + Svelte 5 + TS 6 + Vite 8 + Vitest 5 in `app/`, SPA (`adapter-static`, Fallback index.html, `BASE_PATH=/GoTV` für Pages, `ssr = false`), CI-Job `app` (Check, Lint, Tests in Chromium + WebKit, Build) | `npm run build` und Tests grün in der CI | erledigt 24.11.2026 |
| 1 | Logik umziehen: `src/model`, `src/model/game`, `src/util` -> `app/src/lib/` als TypeScript, mit allen Tests; `AppStore`/`AppActions` werden Svelte-Stores | alle übernommenen Tests grün | ~8 Std. |
| 2a | **Design-Entwurf:** Gestaltungsrichtung, Farben/Schrift (hell/dunkel), Brett und Hauptansichten als klickbarer Entwurf zum Ansehen | der Nutzer hat den Entwurf freigegeben | ~4 Std. |
| 2b | **KGS-Kern im neuen Design:** Anmelden, Räume (Chat, Nutzer, Partien), Partien beobachten, Brett (neu als SVG), Nutzerinfo | man kann sich anmelden, Räume betreten und Partien beobachten | ~12 Std. |
| 3 | Spielen: Herausforderungen, eigene Partie, Zählen | eine Partie gegen einen Menschen läuft durch | ~5 Std. |
| 4 | GoTV-Teile: Live, Kalender, Kanäle, Nachspielen mit KataGo und Varianten, Mein GoTV, Meine Daten, Offline | alles, was die heutige App kann, geht auch in der neuen | ~20 Std. |
| 5 | Desktop: `install.sh` baut `app/`, Proxy unverändert | Desktop-App startet die neue Oberfläche | ~2 Std. |
| 6 | Umschalten: GitHub Pages auf `app/`, alte React-App entfernen (nur nach ausdrücklicher Bestätigung) | eine App, ein Build | ~2 Std. |

Gesamt grob 55 Arbeitsstunden.

## Vom Nutzer zu klären (vor Phase 2b)

Freigabe des Design-Entwurfs aus Phase 2a.

## Nicht Teil des Umbaus

- Rust/Tauri: später möglich (dieselbe Svelte-App in Tauri), jetzt nicht.
- Neue Server, Web-Push, YouTube-API, AppImage (siehe AGENTS.md "Nächste Schritte").
