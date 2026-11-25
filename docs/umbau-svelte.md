# Umbau auf Svelte 5 – Plan

**Abgeschlossen am 25.11.2026** (Phase 6, Commit 3ae1f06): es gibt nur noch die App in `app/`;
die alte React-App steht in der Git-History. Der Text unten ist der Plan und Verlauf.

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
| 1 ✅ | Logik umziehen: `src/model`, `src/model/game`, `src/util`, `src/sound` -> `app/src/lib/` als TypeScript, mit allen Tests | alle übernommenen Tests grün | erledigt 24.11.2026 |
| 2a ✅ | **Design-Entwurf, zwei Designs** (Wunsch 24.11.2026): **"Modern"** (eigenes, sehr modernes Design, Stand 2026) und **"Oldschool"** (angelehnt an das klassische KGS-Brett: Holz, klare Linien, schlicht - selbst gezeichnet, nichts aus KGS kopiert). Beide umschaltbar in den Einstellungen, ohne Neustart (Themes über CSS-Variablen + eigenes Brett-Aussehen je Design). Entwurf zum Ansehen: Brett und Hauptansichten in beiden Designs | ✅ freigegeben 24.11.2026 (siehe "Phase 2a – Stand") | ~6 Std. |
| 2b ✅ | **KGS-Kern im neuen Design:** Anmelden, Räume (Chat, Nutzer, Partien), Partien beobachten, Brett (neu als SVG), Nutzerinfo | man kann sich anmelden, Räume betreten und Partien beobachten | ~12 Std. |
| 3 ✅ | **Spielen auf KGS, alles wie in der alten App** (Wunsch 24.11.2026): Herausforderung erstellen, Vorschläge abgeben/annehmen/ablehnen und durchblättern, Rolle tauschen; eigene Partie: Zug setzen, Passen, Aufgeben, Undo bitten/annehmen/ablehnen, Zeit hinzufügen, Partie verlassen; Zählen: Gruppen tot/lebendig markieren, „Fertig“; Uhren; Partiechat. Vorlage: `src/ui/game/`, `src/ui/challenge/` | eine Partie gegen einen Menschen läuft vom Herausfordern bis zum Ergebnis durch | ~5 Std. |
| 4 ✅ | GoTV-Teile: Live, Kalender, Kanäle, Nachspielen mit KataGo und Varianten, Mein GoTV, Meine Daten, Offline | alles, was die heutige App kann, geht auch in der neuen | ~20 Std. |
| 5 ✅ | Desktop: `install.sh` baut `app/`, Proxy unverändert | Desktop-App startet die neue Oberfläche | ~2 Std. |
| 6 ✅ | Umschalten: GitHub Pages auf `app/`, alte React-App entfernen (vom Nutzer bestätigt 25.11.2026) | eine App, ein Build | erledigt 25.11.2026 |

Gesamt grob 57 Arbeitsstunden.

## Phase 1 - was dabei herauskam (24.11.2026)

- Übersetzt mit `@khanacademy/flow-to-ts`, danach von Hand: 812 Typmeldungen -> 0
  (`svelte-check`). Zwei zentrale Übersetzungsfehler des Werkzeugs korrigiert: `Index<T>` und
  `ChannelMembership` waren als "jeder Eintrag kann fehlen" übersetzt; `GamePlayers` und
  Uhren sind jetzt `Partial` (nicht jede Partie hat alle Rollen).
- Verhalten unverändert: alle 280 Logik-Tests der alten App laufen in Vitest (jsdom) grün.
  Die übernommenen Tests sind von der strengen Typprüfung ausgenommen (`tsconfig.json`
  "exclude") - sie waren nie typgeprüft und arbeiten mit absichtlich unvollständigen Daten.
- Bibliotheken aktualisiert: date-fns 2 -> 4, idb-keyval 3 -> 6, uuid 8 -> 14.
- Für die übernommene Logik sind die strengsten Lint-Regeln (`no-unsafe-*`, `any`,
  `no-floating-promises`) begründet abgeschaltet (lose typisierte KGS-/OGS-Daten, KGS-
  Nachrichten bewusst ohne Warten); die neue Oberfläche bekommt sie voll.
- Altlast aus Shin KGS markiert, nicht verändert: in `game/message.ts` vergleicht ein Zweig
  `playGameId` (immer eine Kanal-Nummer) mit einem Zeitstempel - er greift nie.
- `AppStore`/`AppActions` sind übernommen; die Anbindung an Svelte (Store-Vertrag
  `subscribe`) kommt mit der ersten Oberfläche in Phase 2b.

## Vom Nutzer zu klären (vor Phase 2b)

Erledigt: Der Nutzer hat beide Design-Entwürfe am 24.11.2026 freigegeben („gefällt mir sehr gut“).

## Phasen 2b–5 – Stand (24.11.2026)

Alle Seiten der alten App sind in `app/` nachgebaut (Regeln: `docs/neubau-regeln.md`), in
Wellen: gemeinsame Bausteine, dann Beobachten/Partie, Chat, Nutzerinfo/Suche/Konto,
Spielen, Kalender/Kanäle, Nachspielen, zuletzt Live. Gate grün (svelte-check, Lint,
429+ Tests), CI grün inkl. WebKit.

- App-Zustand: `app/src/lib/app.svelte.ts` verbindet AppStore, KgsClient und AppActions
  (unverändert übernommen) mit Svelte; ein History-Adapter übersetzt die alten "navs" in
  Seiten (tv → `/`, watch → `/beobachten`, play → `/spielen`, chat, search → `/suche`,
  more → `/konto`). `app.openReplay(url)` / `app.suggestGameReplay(game)` öffnen
  Nachspielen. KGS-Seiten stecken in `KgsGate` (Anmeldung; Web-Version: Hinweis).
- Einstellungen: `app/src/lib/config.ts` (`VITE_API_URL`, `VITE_GUEST_ONLY`, Basis-Pfad)
  ersetzt `process.env`. `app/static/tv` und `app/static/katago` verweisen auf `public/`.
- Dev-Server: KGS über den Proxy in `app/vite.config.ts` (`/json/access`, Origin entfernt
  wie beim Desktop-Proxy), `.env.development` setzt `VITE_API_URL`.
- Desktop (Phase 5): `desktop/install.sh` baut `app/` nach `build-desktop/`,
  `install.sh --alt` die alte Oberfläche. `goTV_local.py` liefert vorgerenderte Seiten
  (`/kalender` → `kalender.html`).
- Offline (Web-Version): `app/src/service-worker.ts` mit denselben Strategien wie
  `public/gotv-sw.js`, registriert nur mit `VITE_GUEST_ONLY` im Production-Build.
  Geprüft mit Playwright offline: Live, Kalender, Nachspielen der EM-Finalpartie.
- Unterwegs behobene Fehler der alten App: Raumsuche übersprang jeden zweiten Treffer,
  Byo-yomi-„+“ immer 5 s, E-Mail-Änderung ging verloren, private Chats als Räume angeboten,
  Absturz ohne Raum/Vorschlag, Filter ohne Raum.
- Bewusste Abweichungen stehen in den Commit-Texten der einzelnen Wellen.

Phase 6 (erledigt 25.11.2026, so umgesetzt; `/GoTV/neu/` und `/GoTV/tv` leiten auf `/GoTV/`,
`install.sh --alt` und `.travis.yml`/`server/` sind mit entfernt): Pages-Build auf `app/` mit `VITE_GUEST_ONLY=true`
und `BASE_PATH=/GoTV`; der alte Service Worker `gotv-sw.js` muss dann abgemeldet werden
(neuer Worker unter gleichem Scope ersetzt ihn, alte Caches `gotv-app-*` räumt der neue
beim Aktivieren mit ab - Achtung: der neue Worker nutzt das Präfix `gotv-svelte-app-`, beim Umschalten also die alten `gotv-app-*`-Caches einmal ausdrücklich löschen); alte React-App, `public/gotv-sw.js`, `.flowconfig`, CRA-Build und
`app/src/lib/demo/` (nicht mehr benutzt) entfernen.

## Phase 2a – Stand (24.11.2026, freigegeben)

Die Entwurfsseiten zeigen nur das Aussehen. Der Funktionsumfang der alten Seiten kommt in
Phase 4 und muss dann 1:1 nachgebaut werden. Für den Kalender heißt das: Monat/Liste
umschaltbar (`gotv.calendarView`), Blättern und „Heute“, Legende (mit/ohne Stream, ▶),
„+N weitere“, Klick auf einen Tag scrollt zu dessen Karten mit offener Partieliste, Liste
nach Regionen Deutschland/International plus Archiv, echte Einträge aus events.json
(60-s-Aktualisierung, Fehler mit „Erneut versuchen“). Karte: Stern, Plattform-Badge,
Zeitraum, Notizen, Brett-Status, Stream per Zwei-Klick, Stream-Chat im Live-Fenster,
Partieliste G1, G2, … (OGS), „SGF nachspielen“. Vorlage: `src/ui/tv/CalendarView.js`,
`CalendarMonth.js`, `CalendarEventCard.js`, `StreamEmbed.js`, `ReplayGameList.js`,
`FavoriteStar.js`, `StreamChat.js`.

Gefunden beim Durchgehen (vor Phase 2b/4 beheben): die übernommene Logik liest noch
`process.env` (CRA), das es im Browser der neuen App nicht gibt - `tv.ts` (PUBLIC_URL,
REACT_APP_API_URL), `KataGoEngine.ts` (PUBLIC_URL), `KgsClient.ts` (REACT_APP_API_URL,
NODE_ENV), `AppStore.ts`, `model/index.ts` (NODE_ENV), `util/offline.ts`. In den Tests
fällt das nicht auf (Node kennt `process`). Ersatz: eine Konfigurationsdatei mit
`import.meta.env` und dem SvelteKit-Pfad (`$app/paths`).

Live-Brett im Entwurf: zurückspulen und „Zum aktuellen Zug“ (gemeinsame Zugleiste
`src/lib/ui/BoardNav.svelte`, auch in Nachspielen), Wunsch des Nutzers.


Entwurf gebaut, zum Ansehen unter https://ajiai-labs.github.io/GoTV/neu/ (CI baut die neue
Oberfläche mit `BASE_PATH=/GoTV/neu` und legt sie neben die alte Web-Version; der
Offline-Speicher der alten App lässt `/neu/` in Ruhe). Seiten Live, Kalender, Kanäle,
Nachspielen, Einstellungen - mit Beispieldaten (EM-Finale Kravets–Jabarin über den
übernommenen SGF-Parser, echte Termine/Kanäle), noch ohne echte Daten.

- Design-Wahl: `src/lib/ui/design.svelte.ts` (`gotv.design` in localStorage, auf
  `<html data-design>`; `app.html` setzt es vor dem ersten Bild). Alle Farben, Schriften,
  Abstände als CSS-Variablen in `src/app.css`.
- Modern: helles Grau-Grün, Schiefer, Jade als Akzent, Schrift Bricolage Grotesque
  (Fontsource, liegt im Build, kein Google-CDN). Video auf dunkler Bühne, Brett daneben.
- Oldschool: Fenstergrau, Titelleisten in Marineblau, 3D-Rahmen, Tahoma/Verdana, Holzbrett mit
  Maserung (SVG-Filter) und plastischen Steinen, Uhren als Digitalanzeige.
- Brett: `src/lib/ui/Board.svelte` (SVG, scharf in jeder Größe, Koordinaten ohne I,
  Sternpunkte 19/13/9, letzter Zug, Ziffern-Markierungen, Klick auf Punkte).
- Logo oben links: das GoTV-Logo aus `desktop/icons/gotv.svg` (Wunsch 24.11.2026), auch als
  Tab-Symbol.
- Seiten werden als eigene Dateien geschrieben (`prerender = true`), damit Neuladen von
  z. B. `/neu/kalender` auf GitHub Pages funktioniert.

## Nicht Teil des Umbaus

- Rust/Tauri: später möglich (dieselbe Svelte-App in Tauri), jetzt nicht.
- Neue Server, Web-Push, YouTube-API, AppImage (siehe AGENTS.md "Nächste Schritte").
