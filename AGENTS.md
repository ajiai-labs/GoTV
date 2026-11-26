# GoTV

Eigenständige App `ajiai-labs/GoTV` (Wunsch 24.11.2026: nach außen als eigene App auftreten,
nicht als Fork - README, Seitenbeschreibung und Repo-Beschreibung entsprechend). Go-TV:
Übertragungen mit Brett neben dem Stream, Turnierkalender, Go-Kanäle, Nachspielen mit
KataGo; dazu vollständiger KGS-Client. Entstanden aus jkk/shinkgs (React 16, Flow,
react-scripts 3.4.1, SCSS); die Fork-Verbindung hat der Nutzer am 24.11.2026 gelöst
("Leave fork network"). `LICENSE.txt` (MIT, Justin Kramer) bleibt für den übernommenen
Code, der Herkunftshinweis steht in der README unter "Origin and license".
Oberfläche: Svelte 5 + TypeScript in `app/` - seit 25.11.2026 die einzige (Phase 6: die alte
React-App aus `src/` ist entfernt, die Web-Version unter https://ajiai-labs.github.io/GoTV/ ist
die neue App). **Pfade in den älteren Abschnitten unten:** `src/model/X.js` heißt jetzt
`app/src/lib/model/X.ts`, `src/util/X.js` → `app/src/lib/util/X.ts`, `src/ui/tv/X.js` →
`app/src/lib/ui/tv/X.svelte`; die alte Fassung steht in der Git-History (vor Commit 3ae1f06).

Ursprüngliche drei Bausteine:

1. **Live:** laufende Übertragungen mit Video und Brettern (KGS/OGS).
2. **Kalender:** Turniere mit Übertragung (YouTube/Twitch), Stream direkt in der App.
3. **Nachspielen:** SGF einer Profipartie laden und Zug für Zug durchgehen.

Referenz-Logik (Rust, funktioniert bereits): `~/Projekte/aktiv/Tiger-s-Mouth`
Nur LOGIK und Datenschemata übernehmen, portiert nach TypeScript (früher JavaScript/Flow).
Kein Rust-Code, keine Rust-Abhängigkeiten.

- `data/tournaments.json` → Kalender-Schema
- `crates/ui/src/tournaments.rs` → Kalender-View-Logik
- `crates/ui/src/chat_panel.rs` → extract_urls / normalize_url
- `crates/go-engine/src/sgf.rs` → SGF-Parser
- `crates/ui/src/sgf_review.rs` → SGF-Nachspiel-Logik

## Regeln

- Branch `feature/go-tv`, ein Commit pro abgeschlossenem Schritt, Conventional Commits.
  Pushen: jeden abgeschlossenen Schritt auf `feature/go-tv` UND `master` (Fast-Forward,
  `git push origin feature/go-tv:master`) - Wunsch des Nutzers seit 23.11.2026 (vorher galt
  "Nicht pushen"). Ein Push auf master veröffentlicht über die CI die Web-Version.
- Nach jedem Schritt grün (wie die GitHub-CI): `cd app && npm run check && npm run lint &&
  npm test && npm run build`, dazu die Python-Tool-Tests (`python3 -m unittest
  tools.test_update_events tools.test_check_links tools.test_refresh_tv_events
  tools.test_speedgo`). Regeln für Oberflächen-Arbeit: `docs/neubau-regeln.md`.
- Vor jeder Änderung die betroffenen bestehenden Dateien lesen.
- Kein KGS-Logo, kein Branding, das den Fork als offiziellen KGS-Client ausgibt.
  `LICENSE.txt` unverändert lassen.
- Stream-Einbettung nur über offizielle Embed-Player:
  - YouTube: `https://www.youtube-nocookie.com/embed/<id>`
  - Twitch: `player.twitch.tv` mit `parent=<hostname>`
  Kein Scraping, kein Re-Streaming, kein Entfernen von Werbung/Branding.
  Iframe lädt erst nach Klick (Zwei-Klick-Lösung, vorher Platzhalter).
  Wenn Einbetten nicht möglich ist: Button "Extern öffnen" mit
  `target=_blank rel=noopener`.
- Protokoll-Hygiene (Desktop-Proxy): Clients außerhalb des Browsers gehen über den
  regulären Endpoint `/json/access`, nicht über eine ausgehebelte Browser-Prüfung.
  Details: Abschnitt "Proxy-Begründung" unten.

## Setup und Befehle (Node 24 via Nix)

Node kommt aus dem Nix-Store; npm ist dabei. Kein yarn mehr (die alte App ist entfernt).

| Befehl (in `app/`) | Zweck |
|---|---|
| `npm ci` | Abhängigkeiten installieren |
| `npm run dev` | Dev-Server, KGS über den Vite-Proxy (`.env.development`) |
| `npm run check` | TypeScript-/Svelte-Prüfung |
| `npm run lint` | Prettier + ESLint |
| `npm test` | Unit-Tests (Node) + Komponententests (Chromium; CI zusätzlich WebKit) |
| `npm run build` | Build nach `app/build/` |
| `VITE_GUEST_ONLY=true BASE_PATH=/GoTV npm run build` | Web-Version wie auf GitHub Pages |
| `sh desktop/install.sh` (im Hauptordner) | Linux-Desktop-App bauen + installieren |

- Port 3000 ist auf diesem Rechner dauerhaft fremdbelegt (firecrawl-mcp, 13.11.2026) → für
  Dev-/Vorschau-Server einen anderen Port nehmen (z. B. `npx vite dev --port 5199`).
- Ein Production-Build mit `VITE_GUEST_ONLY=true` überschreibt `app/build/`; `install.sh`
  baut ohnehin neu.

## Desktop-App (GNOME, lokal)

Lokale Installation als Desktop-App (eigenes Fenster, kein Browser-Chrome, kein
sudo, kein Electron). Dateien unter `desktop/`:

- **`goTV_local.py`** — Python-Stdlib-`ThreadingHTTPServer`, bindet NUR an
  `127.0.0.1:8788` (Port per `GOTV_PORT`/`--port`). Liefert `build-desktop/` aus
  (SPA-Fallback auf `index.html` für History-Routen wie `/tv`, `/watch`;
  Pfad-Traversal durch `normpath` + `startswith`-Check auf das Build-Verzeichnis
  blockiert). `/igs-bridge` ist reserviert für eine künftige IGS-Quelle und
  antwortet bewusst 501, bis die IGS-Nutzungsbedingungen geprüft sind (siehe
  TV-Quellen-Grundsatz unten).
- **`launch-gotv`** — Health-Check (curl gegen den Server, bounded loop), startet
  den Server, erkennt einen Chromium-Browser (nativ → Flatpak → Snap, feste
  Reihenfolge chromium/chrome/brave/edge) und öffnet ihn mit
  `--app=http://127.0.0.1:8788 --user-data-dir=~/.local/share/gotv/profile
  --class=gotv` (eigenes Profil, kein Browser-Chrome).
- **`gotv.desktop`** — Desktop-Eintrag, `StartupWMClass=gotv` (passend zu
  `--class`). `Name=GoTV`, `Icon=gotv` (Icon unter `desktop/icons/`, PNGs in
  `desktop/icons/png/`).
- **`install.sh` / `uninstall.sh`** — user-scoped (kein sudo): baut
  `build-desktop/`, installiert Launcher nach `~/.local/bin`, `.desktop` nach
  `~/.local/share/applications`, Icon nach
  `~/.local/share/icons/hicolor/512x512/apps`; aktualisiert Desktop-DB/Icon-Cache,
  falls vorhanden. `uninstall.sh` stoppt den Server (`pkill -f` auf das
  Server-Skript) und lässt Nutzerdaten (Browser-Profil, Logs) bewusst stehen.

### Proxy-Begründung (Commits 05c4082, 98655e7, 38cab76)

**Ursprünglich** (05c4082) lief der lokale Proxy gegen den Browser-Endpoint
`/json-cors/access` und entfernte den Origin-Header, um KGS' Origin-Whitelist zu
umgehen. Funktionierte, war aber der falsche Weg: `/json-cors/access` ist für
Browser-Clients mit Origin-Prüfung gedacht, nicht für Nicht-Browser-Clients wie
diesen lokalen Proxy.

**Korrektur (98655e7):** Ziel ist jetzt der reguläre Endpoint `/json/access` für
Clients außerhalb des Browsers — denselben, den auch Tiger's Mouth nutzt
(`REACT_APP_API_URL=/json/access`). Gemessen (curl, siehe Kopfkommentar in
`goTV_local.py`):

| Request | Ergebnis |
|---|---|
| POST, `Origin: https://shin.gokgs.com` | 200 |
| POST, `Origin: http://127.0.0.1:8788` | 403 |
| POST, kein Origin-Header | 200 + Cookie |

Ergebnis: **auch** `/json/access` prüft die Origin-Whitelist, sobald ein
Origin-Header gesetzt ist. Den Origin-Header wie ursprünglich angefragt einfach
durchzureichen würde den Login wieder auf 403 brechen. Der Proxy entfernt den
Origin-Header deshalb weiterhin — das ist jetzt aber eine gemessene Notwendigkeit
des richtigen (Nicht-Browser-)Endpoints, nicht mehr das Umgehen einer
Browser-Prüfung über den falschen (Browser-)Endpoint. Cookies (`JSESSIONID`,
`Path=/json` passt zur lokalen Route `/json/access`) und Long-Polling
(GET ohne Read-Timeout) laufen unverändert durch.

**Absicherung (38cab76), DNS-Rebinding-Guard** — vor jeder Anfrage
(`_request_allowed`):
- `Host`-Header muss exakt `127.0.0.1:8788` oder `localhost:8788` sein, sonst
  403 "Forbidden host".
- Ist ein `Origin`-Header gesetzt, muss er exakt `http://127.0.0.1:8788` bzw.
  `http://localhost:8788` sein; ein fehlender Origin-Header ist erlaubt
  (server-seitige Requests ohne Origin). Sonst 403 "Forbidden origin".

Mit curl getestet: fremder Host → 403, fremder Origin → 403, lokale
Host/Origin-Kombinationen (inkl. ohne Origin) → normal verarbeitet.
QA-Screenshots/Belege: `~/.hermes/cache/scratch/go-tv-qa/`.

Kleiner offener Rest (kosmetisch, keine Funktion): die Fehlermeldung in
`main()` bei fehlendem Build verweist noch auf den alten Pfad
`.../json-cors/access` statt `/json/access` (Zeile ~294 in `goTV_local.py`).

## Architektur — Go-TV-Modul

- `src/model/tv.js` — pure Logik: Sortierung nach Spielstärke, Event-/URL-Parsing-Helfer.
- `src/ui/TvScreen.js` — TV-Tab mit Bereichen Live / Kalender / Kanäle / Nachspielen
  (TabNav), darunter "Meine Daten" (BackupPanel) und bei fehlendem Netz der Offline-Hinweis.
- `src/util/urls.js` — extract_urls/normalize_url (Port von chat_panel.rs).
- `src/model/sgf.js` — SGF-Parser (Port von sgf.rs, erweitert um Varianten) → GameTree.
  Koordinaten nach SGF-Standard wie in sgf.rs: Buchstabe = Index ab oben links, "i" wird
  NICHT übersprungen (nur die Brett-Beschriftung A-H, J-T tut das), y = 0 ist die
  oberste Reihe (19), passend zu `board[y][x]`.
- `src/model/OgsTvSource.js` — anonymer OGS-REST-Adapter zu GameChannel, 5-s-Polling
  (ein Request) nur für `ogs_game_id` aus einem Kalender-Event und nur bei geöffnetem
  Stream; stoppt bei Partieende. OGS liefert das SGF laufender Partien anonym NICHT
  (HTTP 403 "Sign in to download SGF of in-progress games", gemessen 17.11.2026):
  laufende Partien kommen deshalb aus `gamedata` des Detail-Abrufs
  (`src/model/OgsGameData.js`: Züge → SGF-Text, Ränge, Uhren); das SGF mit dem
  Partiechat wird erst nach Partieende einmal geladen.
- `src/model/OgsRealtime.js` — Gast-Verbindung zur dokumentierten OGS-Echtzeit-API
  (WebSocket `wss://online-go.com`, Protokoll der offiziellen goban-Bibliothek,
  `authenticate` mit leerem jwt, `game/connect {game_id, chat: true}`, Ping alle 10 s).
  Liefert Züge, Uhren und Partiechat sofort; `OgsTvSource` mischt sie in die REST-Daten.
  REST bleibt Rückfall: voller Takt ohne Verbindung, sonst nur jeder 12. Poll; Ergebnis
  und SGF kommen nach Partieende weiter über REST. Gesendet wird nur Handshake,
  connect/disconnect und Ping. Geprüft 17.11.2026: Doku nennt goban ausdrücklich als
  Referenz für Third-Party-Clients, Gastzugang ist vorgesehen, die OGS-ToS enthalten
  keine API-Klausel.
- `src/model/OgsGameFinder.js` — `ogs_players` (OGS-Benutzernamen) im Kalender-Event als
  Alternative zur festen `ogs_game_id`: `OgsTvSource.observeEvent` sucht die Partie
  zwischen GENAU diesen Spielern, die im Live-Fenster des Events begonnen hat (laufende
  Partie zuerst, sonst die zuletzt beendete), und folgt einer Serie (Bo5) selbst zur
  nächsten Partie. Während eine Partie läuft, wird nur sie gepollt; davor/danach die
  Partieliste des ersten Spielers alle 15 s. Eine `ogs_game_id` hat Vorrang.
- `src/model/OgsLinks.js` — "OGS-Partielink zuordnen" an der Übertragungskarte: der
  Zuschauer trägt einen Link `https://online-go.com/game/<id>` ein, gespeichert nur in
  localStorage (`gotv.ogsLinks`, pro Event-ID), events.json bleibt unberührt. Der Link
  ersetzt die OGS-Zuordnung des Events; `observeEvent` nimmt die Spieler aus der
  verlinkten Partie und wechselt nach Partieende selbst zur nächsten Partie derselben
  zwei Spieler (nie zurück zu einer älteren).
- Verbindungsanzeige am OGS-Brett (`BroadcastCard._renderOgsStatus`): "Live verbunden"
  (Echtzeit, `game.tvLive`), "wird alle paar Sekunden abgefragt" (REST-Rückfall),
  "Verbindung zu OGS unterbrochen – letzter Stand von HH:MM:SS" (Fehler bei stehendem
  Brett), "Partie beendet – eine weitere Partie … erscheint automatisch".
- Zuschauen ohne KGS-Login: `src/ui/tv/GuestTvScreen.js`, erreichbar über den Button
  "Go TV ohne Anmeldung ansehen" im LoginScreen und direkt über `/tv` (einziger Pfad,
  den `App.js` ohne `currentUser` rendert; `/tv/` zählt mit). Streams, Kalender,
  OGS-Bretter und Nachspielen laufen ohne KGS; KGS-Bretter/-Chat bleiben leer.
- Kinomodus (`BroadcastCard`, Button "Kinomodus" bei geöffneter Übertragung): die Karte
  füllt das Fenster (`.BroadcastCard-cinema`, zusätzlich Fullscreen-API, wo erlaubt),
  Stream links, Brett rechts, Verhältnis per Regler (30-80 %, `gotv.cinemaSplit` in
  localStorage), Chat einklappbar, Esc beendet. Es wechseln nur CSS-Klassen, das
  Stream-Iframe wird nicht neu geladen. Nach Layoutwechsel wird ein `resize`-Event
  ausgelöst, weil `BoardContainer` seine Größe nur darauf neu misst.
- Ziehbare Trennkante (`BroadcastCard-splitter`, `role="slider"` - mit "separator" meldet
  der CRA-Build eine a11y-Warnung, die in der CI mit `CI=true` als Fehler zählt) auch in
  der Grundansicht:
  Pointer-Capture hält den Griff beim Ziehen über das Iframe; Pfeiltasten ändern
  die Aufteilung ohne Zugnavigation. Beide Ansichten teilen `gotv.cinemaSplit`.
- Eingebettetes SGF-Brett (`.SgfReplay-compact`): eigener quadratischer Container
  mit vollständigem Inset/Padding-Reset. Die globale Desktop-Regel für
  `.GameScreen-board-container` reserviert sonst 350 px für die Watch-Seitenleiste.
- Video-Umschaltung (`BroadcastCard`): Übertragungen öffnen nach Klick mit Video;
  "Nur Brett" entfernt den Player samt Ton, "Video zuschalten" lädt ihn wieder.
  Brettposition und Verbindung bleiben erhalten. Gilt auch im Kinomodus.
- Beispiel bei leerem Live-Bereich (`CinemaExample`): EGF-Twitch-Kanal (aktuelles
  Programm/Offlinebild) und lokal gebündelte Finalpartie der EM 2026, Kravets–Jabarin,
  unabhängig voneinander. Kein erfundenes Live-Event, kein KGS-/OGS-Join. Echte
  Übertragungen verdrängen das Beispiel. `SgfReplayView compact` zeigt Brett und
  Navigation ohne Datei-Eingabe; Ergebnis erst beim letzten Zug.
  Quelle von `public/tv/em-finale-2026.sgf` (unverändert übernommen am 17.11.2026):
  https://eurogofed.org/archives/sgf/egc/2026/ec/8-AndriiKravets-AliJabarin.sgf
- Brett-Verzögerung (`src/model/DelayBuffer.js`, Regler und Tasten −5 s/+5 s in
  `BroadcastCard`, 0-120 s; `src/model/BoardDelay.js` merkt den Wert pro Kanal in
  `gotv.boardDelays` (Schlüssel: `channel` platform/id, sonst stream_url), der zuletzt
  gesetzte Wert in `gotv.boardDelay` gilt als Vorgabe für Kanäle ohne eigenen Wert): die Karte zeigt jedes Brett so, wie es vor N
  Sekunden war. Verzögert wird der ganze Partie-Schnappschuss, also Züge, Ergebnis,
  Uhren, Chat, Brettliste und Statuszeile gemeinsam — nichts nimmt das Video vorweg.
  Gilt für KGS- und OGS-Bretter; ein 500-ms-Timer läuft nur bei Verzögerung > 0.
- Kalender-Tab: `src/ui/tv/CalendarMonth.js` + `src/model/tvCalendar.js` — Monatsblatt
  (Montag zuerst, mehrtägige Turniere als durchgehender Balken, "Heute", Blättern,
  Klick auf einen Tag zeigt dessen Turnierkarten). `CalendarView` schaltet zwischen
  "Monat" (Standard) und "Liste" (Regionen, Archiv) um, gemerkt in
  `gotv.calendarView`.
  Turniere mit Partien zum Nachspielen (begonnen + `ogs_*`/`sgf_url`) tragen im
  Monatsblatt ein "▶" vor dem Namen; ein Klick auf den Tag scrollt zu dessen Karten
  und öffnet die Partieliste sofort (`renderEvent(event, {openGames: true})`).
- Pflegehinweise zu Hand-Einträgen in `public/tv/events.json` (stehen bewusst NICHT in
  den `notes`, die sieht der Zuschauer): `berliner-kranich-2026` ist von Hand
  eingetragen, weil der DGoB-Importer die Kategorie 'deutschlandpokal' nicht zieht.
  `speed-go-championship-2026-11-22-surma-ovsiienko` ist bestätigt per
  speedgochampionship.com/bracket; den gleichzeitigen twitch-egf-Import blendet
  `dropImportedDuplicates` aus. OGS-Namen: `mateusz.surma1995`, `OvsiienkoVsevolod`.
  Die Speed-Go-Einträge vom 01.11. und 08.11. tragen `ogs_game_ids` aus den
  "online-go: G1 G2 G3"-Links der Bracket-Seite (OGS-Konten dort: artem92/RemiC bzw.
  Avtikh/Welvang); seit 23.11. ergänzt der Speed-Go-Importer solche Nummern selbst
  (Surma - Ovsiienko: 5 Partien).
- Turnierpartien nachspielen (`src/model/OgsReplay.js`, `OgsTvSource.fetchEventGames`,
  `src/ui/tv/ReplayGameList.js`, `src/ui/tv/RecentReplays.js`): Für Events mit
  `ogs_game_ids` (Partienummern, z. B. von der Turnierseite) oder `ogs_players` listet die
  App die beendeten OGS-Partien als G1, G2, … — an der Karte, sobald das Event begonnen
  hat, und im Nachspielen-Tab unter "Turnierpartien der letzten 3 Monate". Bei
  `ogs_players` filtert OGS die Partieliste des ersten Spielers per
  `started__gte/started__lte` auf das Live-Fenster (geprüft 22.11.2026), daher klappt das
  auch Wochen später. Abgebrochene/annullierte Partien fallen weg. Bewusst OHNE
  Ergebnis in der Liste (kein Spoiler); geladen wird das OGS-SGF, das anonym verfügbar
  ist, sobald die Partie beendet ist. Events mit OGS-Partien bleiben 90 Tage
  (`REPLAY_KEEP_DAYS`) im Archiv statt 14.
  Unter Live steht ein Turnier nach Ende seines Live-Fensters noch 24 Stunden als
  "Gerade zu Ende – Partien nachspielen" (Partien sofort aufgelistet), sonst wäre es
  ab Fensterende nur noch unten im Nachspielen-Tab zu finden.
- Kanäle-Tab (`src/ui/tv/ChannelsView.js`, `src/model/tvChannels.js`, Wunsch 23.11.2026:
  Kanäle sauber getrennt vom Turnierkalender): `channels[]` aus events.json, gruppiert in
  "Spieler" (`kind: "player"`) und "Verbände und Turniere" (Standard). Optional
  `schedule: [{weekday 1-7, time "HH:MM", duration_minutes}]` in deutscher Zeit
  (Europe/Berlin, per `Intl` umgerechnet, Sommer-/Winterzeit egal): die Karte zeigt
  "Feste Sendezeit: sonntags 10:30 Uhr", während der Zeit "läuft gerade (geplant)" und
  steht oben in ihrer Gruppe; unter Live erscheint ein Hinweis "Jetzt auf den Kanälen
  (geplant)" mit Sprung in den Tab. Ob wirklich gesendet wird, weiß die App ohne
  YouTube-API nicht - daher "(geplant)". JuppTube (Franz-Josef Dickhut): sonntags 10:30,
  150 Min.; belegt durch die Livestreams 01.-22.11.2026 (Start jeweils 10:28-10:30 MEZ,
  aus `liveBroadcastDetails` der Videoseiten), Termine kündigt er nicht einzeln an.
  `fetchTvData` teilt eine laufende Anfrage zwischen Events und Kanälen.
- Turnierübersicht mit Brettvorschau (`src/ui/tv/BoardPreviewGrid.js`, 23.11.2026): ab zwei
  Brettern einer Übertragung Kacheln statt der Textliste - kleines SVG-Brett (Stellung am
  `activeNode`, also der letzte Zug), Spieler mit Rang, Zugnummer, KGS/OGS; Klick holt die
  Partie groß neben den Stream (`_onSelectBoard`). Die Kacheln bekommen dieselben
  verzögerten Schnappschüsse wie das große Brett; beendete Partien zeigen "beendet" ohne
  Ergebnis. KGS-Listeneinträge ohne Züge: "Brett nach Klick".
- KataGo im Browser (23.11.2026, `src/model/KataGoEngine.js`, `src/ui/tv/KataGoPanel.js`):
  Engine von Web KaTrain (MIT, github.com/Sir-Teo/web-katrain, Commit a6a67d6) als
  fertiger Web Worker in `public/katago/` (katago-worker.js 2,7 MB mit TensorFlow.js
  4.22.0, tfjs/*.wasm, Netz g170 b6c96 3,8 MB, CC0; Herkunft in `public/katago/NOTICE.txt`).
  Neu bauen nur über `bash tools/katago-worker/build.sh` (klont die feste Commit-Version,
  esbuild); der App-Build braucht weder esbuild noch TypeScript. Backend: WebGPU, sonst
  WASM, sonst JS - läuft auf jeder Grafikkarte und auf Tablets, ohne Server. Im
  Nachspielen-Tab (nicht in kompakten Brettern) Schalter "KataGo-Analyse" (aus per
  Vorgabe, `gotv.katago`): Gewinnchance/Punkte aus Sicht Schwarz, 5 beste Züge als
  Ziffern 1-5 auf dem Brett (Kopie des Markups, der Baum bleibt unverändert) und
  "Die Partie spielte X: laut KataGo N Punkte schlechter als Y". Visits 50/100/400/1000,
  `maxTimeMs` 30 s (Worker-Vorgabe wären 0,8 s). Stärkeres Netz (.bin.gz, z. B. b18 aus
  KaTrain) per Dateiauswahl, bleibt im Browser (katagotraining.org sendet kein CORS,
  direktes Laden geht nicht). Gemessen 23.11.2026, headless-Chromium ohne GPU (WASM):
  100 Visits auf 19x19 in rund 1-3 s. Desktop-Server liefert `.wasm` als
  `application/wasm`.
- Ganze Partie auswerten (23.11.2026, `KataGoEngine.evaluateGame`/`verifyMistakes`,
  `src/ui/tv/GameGraph.js`): Knopf "Ganze Partie auswerten" im KataGo-Feld. Schritt 1:
  jede Stellung der Hauptlinie per `katago:eval_batch` (Netz ohne Suche, 24 je Anfrage;
  236 Züge in ~5 s, WASM). Schritt 2: die 10 auffälligsten Züge (`findMistakes`, sortiert
  nach verlorener Gewinnchance, ab 2 Punkten) mit echter Suche (60 Visits, Gruppe
  "background", wird beim Blättern nicht abgebrochen) nachgerechnet: Verlust = Partiezug
  gegen KataGos besten Zug in der Stellung davor. Grund: Das Netz allein schwankt im
  Ko-Kampf stark. Anzeige: Gewinnkurve (Klick springt zum Zug, gelb = aktueller Zug, rote
  Striche = Fehler) und "Partieentscheidende Fehler" (max. 5; Klick zeigt die Stellung
  vor dem Fehler). Gesamtdauer echte Turnierpartie: ~25 s. Hinweis in der App: das kleine
  Netz ist im Ko-Kampf ungenau.
- Nachspielen untersuchen und fortsetzen (23.11.2026):
  `src/model/ReplayVariation.js` - Klick auf einen freien Punkt setzt einen eigenen Zug als
  Seitenzweig (neuer GameNode, Partie bleibt erstes Kind = Hauptlinie); Schlagen kommt aus
  `computeGameNodeStates`. Upstream-ShinKGS schickt Züge immer an den KGS-Server, ein
  lokales Ausprobieren gab es dort nicht - Baum- und Brettlogik werden aber wiederverwendet.
  Eigene Züge prüfen Selbstmord und einfaches Ko (Stellung vor dem gegnerischen Zug darf
  nicht wiederkehren; `getMoveError` -> Hinweis unter dem Brett), kein Superko. Leiste "Variante ab Zug N · X ist am Zug" mit "Zurück zur
  Partie" und "Variante löschen" (`removeVariation`, ganzer Zweig ab der Abzweigung); das
  Ergebnis erscheint nur am letzten Zug der Hauptlinie. An jeder Abzweigung "Weiter mit:
  Partie F3 · KataGo C17 · Variante E5" (`getContinuations`/`showContinuation`, Klick
  springt auf den ersten Zug der Fortsetzung). KataGo-Vorschläge haben "Variante legen":
  die erwartete Folge (`pv`, GTP "Q16", bis zum ersten Passen, max. 12 Züge,
  `getPvPoints`) wird per `playVariationLine` als Zweig gelegt, der erste Zug trägt den
  Kommentar "KataGo-Variante: C17 · Schwarz 50 % · …"; durchgehen mit BoardNav. KataGo
  analysiert auch innerhalb von Varianten.
  `src/model/ReplayProgress.js` (`gotv.replays`, die 30 letzten Partien): Zug pro Partie
  (Schlüssel `url:<url>`, `game:kgs-<id>`, eingefügtes SGF per Text-Hash), beim Öffnen
  "Weiter bei Zug N" mit "Von vorn"; Lesezeichen mit Notiz (max. 200 Zeichen) pro Zug.
  "Zuletzt nachgespielt" (`RecentlyReplayed.js`) im Nachspielen-Tab öffnet Partien mit URL.
  Varianten (eigene und KataGo) bleiben gespeichert: `getVariationEntries` legt jeden
  Variantenzug als {Pfad der Kindindizes zum Elternknoten, x, y, Kommentar} ab
  (`variations` in `gotv.replays`, max. 400 Züge), `applyVariationEntries` legt sie beim
  Öffnen in derselben Reihenfolge wieder. "Als SGF speichern" (`src/model/SgfWriter.js`)
  schreibt Partie, Varianten und Kommentare als SGF-Datei (Download, UTF-8); bei Dateien
  bleiben deren Wurzelangaben, KGS-Partien bekommen SZ/KM/HA/RU aus RULES.
  Kompakte Bretter (Kinobeispiel, Aufzeichnung) merken nichts.
- Kanäle-Ausbau (23.11.2026): oben im Tab der Wochenplan (`ChannelWeek.js`, Mo-So, feste
  Sendezeiten, heute markiert, laufende rot). Jede Kanalkarte hat "Auf YouTube/Twitch
  öffnen (mit Chat)" (`getChannelLiveUrl`: YouTube `/channel/<UC>/live` führt zur laufenden
  Sendung) - Like, Abo und Schreiben im Chat gibt es nur auf der Plattform selbst.
  Chat in GoTV (`src/model/StreamChat.js`, `src/ui/tv/StreamChat.js`, Zwei-Klick):
  Twitch per offiziellem Chat-Embed `twitch.tv/embed/<login>/chat?parent=<host>` an
  Twitch-Kanälen und laufenden Twitch-Events; YouTube per `youtube.com/live_chat?v=<id>&
  embed_domain=<host>` nur bei Events mit `video_id` - für einen YouTube-Kanal kennt
  GoTV die Nummer der laufenden Sendung ohne YouTube-API nicht.
- Offline (Web-Version, 23.11.2026): eigener Service Worker `public/gotv-sw.js`, registriert
  von `src/util/offline.js` NUR im Production-Build mit `REACT_APP_GUEST_ONLY=true`
  (GitHub Pages) - nicht in der Desktop-App (läuft lokal) und nicht im Dev-Server. Die von
  CRA zusätzlich erzeugte `service-worker.js` (lädt Workbox von einem Google-CDN) bleibt
  unbenutzt. Registriert als `gotv-sw.js?v=<Hash von main.*.chunk.js>`: jeder neue Build
  installiert einen neuen Worker, der alte App-Cache wird beim Aktivieren gelöscht.
  Beim Installieren gespeichert: alle Dateien aus `asset-manifest.json` plus index.html,
  manifest, Icons, tv/events.json, das EM-Finale und KataGo komplett (Worker, WASM, Netz).
  Doppelte Adressen werden vorher entfernt (`cache.addAll` scheitert sonst still).
  Strategien: Seitenaufrufe und events.json (lokal + raw.githubusercontent) zuerst Netz
  (6 s), sonst letzter Stand; /static/ und /katago/ aus dem Speicher; OGS-SGF
  (`/api/v1/games/<id>/sgf`) einmal geladen -> gespeichert (laufende Partien liefert OGS mit
  403, die werden nie gespeichert); OGS-Details und Spielerlisten zuerst Netz OHNE
  Zeitlimit (Live-Brett pollt sie, ein langsames Netz darf keinen alten Stand zeigen),
  nur bei Netzfehler der letzte Stand; Daten-Cache max. 300 Einträge. Streams, Live-Bretter,
  KGS nie. `OfflineNotice` zeigt ohne Netz, was weiter geht. Eine Partie aus einer Adresse
  steht jetzt schon beim Öffnen unter "Zuletzt nachgespielt" (vorher erst nach dem ersten
  Zug), damit man sie offline wiederfindet. Geprüft 23.11.2026 mit Playwright
  (`setOffline`): App lädt, Turnierpartie Ovsiienko - Surma öffnet, KataGo rechnet.
- "Meine Daten" (`src/model/Backup.js`, `src/ui/tv/BackupPanel.js`, unten im TV-Tab,
  23.11.2026): "Sicherung speichern" lädt alle `gotv.*`-Schlüssel als JSON-Datei herunter
  (`{format: "gotv-backup", version: 1, createdAt, data}`, ohne `gotv.notified`, damit das
  andere Gerät seine eigenen Erinnerungen behält). "Sicherung einspielen …" prüft die Datei
  (fremde/kaputte Einträge fallen weg, neuere Version -> Hinweis), zeigt den Inhalt in
  Worten und führt erst nach "Einspielen" zusammen, ohne etwas zu löschen: Favoriten
  vereinigt, `gotv.replays` pro Partie der neuere Stand (`updatedAt`, max. 30 Partien),
  `ogsLinks`/`boardDelays` pro Eintrag aus der Datei, einfache Einstellungen aus der Datei.
  Danach lädt GoTV neu, damit alle Teile die Daten neu lesen. Kein Konto, kein Server: die
  Datei trägt man selbst (z. B. per Cloud-Ordner aufs Tablet). Geprüft mit zwei getrennten
  Browser-Profilen (Stern + Variante kommen an).
- "Mein GoTV" (`src/model/TvFavorites.js`, `src/model/MyGoTv.js`, `src/ui/tv/MyGoTv.js`,
  `FavoriteStar.js`): Stern ☆/★ an Kanälen (ChannelCard) und Turnieren (CalendarEventCard,
  damit auch BroadcastCard). Gespeichert nur im Browser (`gotv.favorites`
  {channels, events}). Favoriten-Kanäle stehen im Kanäle-Tab ganz oben ("★ Favoriten"),
  Favoriten-Turniere tragen im Monatsblatt "★". Oben unter Live listet "Mein GoTV" die
  Favoriten: läuft gerade / nächster Termin (Kanal: nächste feste Sendezeit, "(geplant)";
  Turnier: Kalendertermin), vorbei Turniere fallen weg. Erinnerung 10 Min. vor Beginn per
  Browser-Notification (`gotv.reminders`, schon gemeldete in `gotv.notified`), geprüft im
  60-s-Takt von TvScreen und nur solange GoTV offen ist; ganztägige Turniere ohne `start`
  bekommen keine Erinnerung.
- CI + Web-Version (`.github/workflows/ci.yml`, Stand 25.11.2026): jeder Push/PR prüft die
  App (`check`, `lint`, Tests in Chromium + WebKit, Build), die Python-Tools und den
  Desktop-Server. Auf master wird danach die App mit `VITE_GUEST_ONLY=true BASE_PATH=/GoTV`
  nach https://ajiai-labs.github.io/GoTV/ veröffentlicht (fürs Tablet: Seite öffnen, "Zum
  Startbildschirm"). Dort gibt es nur das Gast-TV: KGS lässt Anfragen nur von seiner eigenen
  Webseite zu, die Desktop-App braucht dafür ihren lokalen Proxy. `404.html` = `index.html`
  fängt Unterpfade ab; `/GoTV/neu/` und `/GoTV/tv` sind Weiterleitungen. Tägliche Bot-Commits (GITHUB_TOKEN) starten
  keinen Workflow - die Web-Version lädt events.json ohnehin zur Laufzeit von GitHub.
- Doppelte Einträge: `dropImportedDuplicates` (`src/model/tv.js`) behält pro Übertragung
  (gleiche Startzeit, gleicher Kanal) nur den Eintrag mit dem besten Rang
  (`getSourceRank`): Hand-Eintrag vor Speed-Go-Import vor anderen Importen (z. B.
  twitch-egf). Der Hand-Eintrag bleibt, weil er Bretter/Partien trägt und nicht
  verschwindet, wenn der Import den Termin vergisst.
- Speed-Go-Importer (`tools/speedgo.py`, `--source speedgo` in `tools/update_events.py`,
  23.11.2026): liest speedgochampionship.com/bracket (robots.txt geprüft: nur
  Cloudflare-Kommentare, keine Regeln). Kommende Begegnungen mit Datum ("Sunday · 29. 11.
  6pm CET", Jahr aus der Saisonangabe im Seitenkopf, über Neujahr) -> Einträge
  `speedgo-<datum>-<nachname>-<nachname>` auf dem EGF-Twitch-Kanal, 18 Uhr, 180 Min.,
  Runde aus der Bracket-Spalte. Beendete Begegnungen zeigen auf der Seite kein Datum mehr,
  nur Spieler + "online-go: G1 G2 ..."-Links: diese Partienummern bekommt der Eintrag
  derselben zwei Spieler (Nachnamen, Akzente egal) als `ogs_game_ids` - Hand-Eintrag
  zuerst, dann speedgo, dann andere Importe - nur wenn er noch keine hat. Ergebnisse werden
  NICHT übernommen (Spoiler). Ein Hand-Eintrag derselben Paarung am selben Tag verhindert
  den Import-Eintrag. Vergangene speedgo-Einträge bleiben 120 Tage.
  Kommende Begegnungen bekommen `ogs_players` (26.11.2026, Wunsch: Brett neben dem Stream
  auch vor dem ersten Partielink): die Seite nennt nur Klarnamen, die OGS-Konten stehen in
  `OGS_ACCOUNTS` (`tools/speedgo.py`, abgelesen aus den OGS-Partien der Bracket-Seiten 2025
  und 2026) und werden täglich aus den Partien gespielter Begegnungen der laufenden Saison
  ergänzt/überschrieben (`learn_ogs_accounts`, eine OGS-Anfrage pro Begegnung, 1 s Pause,
  OGS antwortet Serien mit 429). Gelernt wird nur per Ausschluss (ein Konto der Begegnung
  gehört einem bekannten Spieler), nie geraten; ein bekannter Spieler reicht der App
  (`pickOgsGameId`). Spieler wechseln Konten zwischen Saisons (Jabarin, Kachanovskyi). 0 gefundene
  Begegnungen -> Abbruch ohne Schreiben. Läuft täglich im Workflow (letzter Import-Schritt,
  `continue-on-error`, Fehler melden sich über das Fehler-Issue) und in
  `refresh_tv_events.py` (letzte Quelle). Tests: `tools/test_speedgo.py` mit künstlicher
  Seite `tools/testdata/speedgo-bracket-sample.html`.
- Link-Check (`tools/check_links.py`) überspringt `*.test.js` (erfundene Test-URLs). Bekannte
  Restfunde (23.11.2026): Platzhalter `online-go.com/game/…` in `BroadcastCard.js` und
  go-bundesliga.de (antwortet automatischen Abrufen mit 403).
- `src/ui/tv/TvSourceBadge.js` — Badge "KGS"/"OGS" an jedem Brett der TV-Brettliste
  (`GameList` mit `showSource`) und im Kopf von `TvGamePanel`. Watch bleibt ohne Badge.
- `src/ui/tv/TvGamePanel.js` — KGS-/OGS-Brett mit lokaler BoardNav und denselben
  Beobachter-Komponenten wie GameScreen (GamePlayersInfo, GameInfo, UserList, GameChat,
  ChatMessageBar, GameMoreMenu); Zurückspulen bleibt bei Live-Updates erhalten,
  "letzter Zug" kehrt zum automatischen Folgen zurück. OGS-Chat ist anonym read-only
  (live über die Echtzeit-Verbindung, sonst erst nach Partieende aus dem SGF); `game.sgfUrl` gibt GameMoreMenu die
  quellenneutrale SGF-URL (bei OGS erst nach Partieende gesetzt).
- `public/tv/events.json` — Event-Daten (fetch beim Öffnen des TV-Tabs).
- Nav-Punkt "tv": types.js (NavOption) + index.js (isValidNav) + meta/Nav.js + Main.js.
- Stream-Öffnen aus dem Chat: dispatch `TV_OPEN_STREAM` {url} → nav "tv" → TvScreen zeigt
  Zwei-Klick-Platzhalter; Embed-Builder in `src/ui/tv/StreamEmbed.js`.
- Dev-Harness `#tv-dev` gab es nur in der alten App (mit ihr entfernt). Zum Ansehen eines
  Live-Zustands: Dev-Server einer Kopie (git worktree) mit einem erfundenen laufenden Event
  in `public/tv/events.json`, Kalender dort lokal statt von GitHub laden.
  `public/tv/demo.sgf` bleibt Test-Fixture für `sgf_url`.

## TV-Quellen-Grundsatz (Live / Watch / TV-Kalender)

Policy, von dir als "Stufe 1" bezeichnet:

- **Watch** (bestehend, unverändert) bleibt für ALLE laufenden KGS-Partien reserviert
  — wie vor diesem Fork.
- **TV → Live** ist NICHT "irgendeine starke Partie", sondern ausschließlich für
  Übertragungen:
  (a) KGS-Partien mit `game.event === true` (offiziell übertragene Turnierpartien),
  (b) Kalender-Events (Phase 3), die gerade live sind.
  Alle anderen aktiven KGS-Partien gehören nur in "Watch".
- **Sehenswert-Regel (17.11.2026, ersetzt "nur mit Videokanal" vom 13.11.):** Ein
  Kalender-Event erscheint unter Live, wenn es gerade läuft UND etwas zu sehen ist:
  Videokanal ODER zugeordnetes Brett (`kgs_room`/`kgs_players`/`ogs_game_id`/
  `ogs_players`) — `isWatchable` in `src/model/tv.js`. Große Turniere ohne Stream
  stehen also mit ihren Brettern unter Live ("Brett öffnen" statt "Stream laden");
  gibt es einen Stream, läuft er daneben. Ein Event ohne Video und ohne Brett bleibt
  nur im Kalender.
- **TvSource-Interface:** Implementiert sind `KgsTvSource` und `OgsTvSource`.
  OGS liefert ausschließlich Bretter zu expliziten `ogs_game_id`- oder
  `ogs_players`-Feldern im Kalender, niemals eine Rangliste beliebiger laufender
  OGS-Partien. `IgsTvSource` (Pandanet/IGS)
  ist absichtlich BLOCKIERT — `/igs-bridge` in `goTV_local.py` antwortet 501, bis die
  IGS-Nutzungsbedingungen geprüft sind (Kontakt laut Pandanet-FAQ:
  `developer@pandanet-igs.com`).

### Umsetzungsstand
- [x] Schritt 1: `event`-Flag ist im KGS-Protokoll vorhanden und wird bereits
      eingelesen (verifiziert, nicht neu gebaut).
- [x] Schritt 2: Live-Filter auf `game.event === true` + Kalender-Live.
      `KgsTvSource.getLiveBroadcasts` (`src/model/TvSource.js`), `TvScreen.js`
      zeigt nur noch `broadcasts` — kein "alle aktiven Partien"-Fallback mehr,
      "Dan only"-Filter nirgends mehr im Code (verifiziert per grep, nicht nur
      behauptet).
- [x] Schritt 3: Leerzustand "Gerade keine Übertragung" + nächstes Kalender-Event
      + "Zum Kalender"-Button, wenn nichts live ist (`TvScreen.js:124-141`).
- [x] Schritt 4: Stream neben dem Brett via `kgs_room`/`kgs_players`
      (`tv.js` `getLiveEventForGame`, von `TvSource` genutzt).
- [x] Schritt 5: "Nachspielen"-Vorschlag nach Partieende
      (`GameReplaySuggestion.js` + `GameScreen.js:347`, an `isGameOverNode`).
- [x] `TvSource`-Interface mit `KgsTvSource` als eigene Abstraktion
      herausgelöst (`src/model/TvSource.js`, `kgsTvSource`) — `TvScreen` liest
      nicht mehr direkt auf KgsClient-Daten.

## Roadmap

- [x] Phase 0 — Lauffähig: yarn via corepack, dart-sass, NODE_OPTIONS; Login-Screen + Build grün
- [x] Phase 1 — Bestandsaufnahme (Abschnitt "Bestand")
- [x] Phase 2 — Go TV: Live-Top-Partien (Rang-Sortierung/"Dan only") — ersetzt durch
      den TV-Quellen-Grundsatz oben (Live = Übertragungen mit Videokanal)
- [x] Phase 3 — Turnierkalender
- [x] Phase 4 — Stream-Links im Chat
- [x] Phase 5 — Nachspielen (SGF-Replay) (Commit be3f25d)
- [x] Phase 6 — nur Dokumentation (siehe "Offene Roadmap" unten)
- [x] Desktop-Paket (GNOME): lokaler Server, Proxy-Korrektur, DNS-Rebinding-Guard,
      Launcher/Icon/.desktop, install.sh/uninstall.sh
      (Commits 05c4082, 9f9dc18, 86a901e, 41fed13, 1959ce5, 98655e7, 38cab76)
- [x] TV-Quellen-Grundsatz, Schritte 1-5 (siehe Abschnitt oben)
- [x] events.json Schema v2: `channel`-Feld, Live-Kanal-Embeds (415b1d7), Archiv nach
      14 Tagen (41d7f58), Platzhalter entfernt (19697b1), Remote-Fetch von GitHub mit
      1h-Cache + lokalem Fallback (edceeaf); dazu `channels[]` (f3fcbea), `region`
      (b0f404c), `kgs_room`/`kgs_players` (8285331), `duration_minutes` (379b73a)
- [x] OGS-Bretter für Kalender-Übertragungen: `ogs_game_id`, anonymer REST-Adapter,
      Live-Polling aus `gamedata` (Züge, Uhren), OGS-Partiechat nach Partieende,
      Quellen-Badge KGS/OGS, Wiederverwendung von BoardContainer/TvGamePanel
- [x] App-Name + Icon: GoTV (Repo ajiai-labs/GoTV, Icon `desktop/icons/gotv.svg`)

## Bestand (Phase 1)

### Wie kommen Spiellisten an?
- KgsClient pollt per XHR-Long-Polling die KGS-JSON-API (`GET _apiUrl`), Nachrichten →
  `AppActions.onReceiveServerMessages` → `AppStore.dispatch` → `handleMessage`
  (Router in `src/model/index.js`) → `handleGameMessage` (`src/model/game/message.js`).
- Nach `LOGIN_SUCCESS` sendet `AppActions.onLoginSuccess` `GLOBAL_LIST_JOIN_REQUEST`
  für "ACTIVES" und "CHALLENGES".
- Antworten `GAME_LIST` / `GLOBAL_GAMES_JOIN` / `ROOM_JOIN` mit `msg.games` →
  `parseGameChannel` je Spiel → `gamesById`. `handleGameMessage` baut daraus
  `activeGames` (type ≠ challenge, kein deletedTime) und `challenges`, sortiert via
  `sortGames` (`display.js`: Event zuerst, nicht-adjourned zuerst, dann nach Rank).
- Spieler landen zusätzlich in `usersByName` (`parseUser` → `rankVal` via
  `parseRankVal`: "3d"→3, "5k"→-5, "1p"→11, "?"→-9999). Dan: rankVal 1–9, Pro: 11+.

### Wie wird eine Partie beobachtet?
- `WatchScreen` zeigt `GameList` (activeGames, gefiltert) — Klick → `actions.onJoinGame(game.id)`.
- `onJoinGame`: dispatch `GAME_JOIN` + `WATCH_GAME {gameId}`, nav → "watch",
  sendet `JOIN_REQUEST {channelId}`. KGS liefert dann `GAME_JOIN`/`GAME_UPDATE`/
  `GAME_STATE` mit `sgfEvents`; `parseGameChannel` baut den `tree` (`parseSgfEvents`),
  `computeGameNodeStates` rechnet Brett/Gefangene/Markup pro Knoten.
- `watchGameId` → `GameScreen` (`BoardContainer` liest `tree.computedState[tree.currentNode]`,
  `BoardNav` navigiert `currentNode`).

### Was macht playback.js?
- Nur Stub: verarbeitet `PLAYBACK_ADD` (Feld `playbacks` im AppState), Rest TODO
  (PLAYBACK_DATA, SETUP, SEEK, ERROR, DELETE). KGS-Server-Playback ist also NICHT
  implementiert. Für Phase 5 wird stattdessen der lokale GameTree genutzt:
  SGF parsen → GameTree bauen → Board rendern — ohne Server.

### Kann das Brett einen Spielbaum ohne Server-Verbindung anzeigen?
- Ja. `Board`/`BoardContainer` lesen ausschließlich `game.tree` (computedState,
  currentNode, currentLine). Ein Objekt `{tree}` genügt — kein Netzwerk nötig.
  Voraussetzungen: `tree.nodes` als GameNode-Map, rootNode/activeNode/currentNode/
  currentLine gesetzt, `computedState` via `computeGameNodeStates(tree, nodeId)`.
  `BoardNav` bringt bereits Slider (rc-slider), vor/zurück, Pfeiltasten, Zugnummer.
  ABER: `GameScreen` selbst braucht currentUser + actions (Server) — fürs Replay
  wird eine eigene View gebaut, die BoardContainer + BoardNav direkt nutzt.

### Wo hängt man einen neuen Navigationspunkt "TV" ein?
1. `NavOption` in `src/model/types.js` um `"tv"` erweitern.
2. `isValidNav` in `src/model/index.js` um `"tv"` erweitern (URL-Sync).
3. Tab in `src/ui/meta/Nav.js` (Muster: MainNav-item + A onClick → `actions.onChangeNav("tv")`).
4. Content-Branch in `src/ui/Main.js` (neuer Screen `TvScreen`).
5. Nav-URL-Sync läuft automatisch über `AppActions.onChangeNav` (history push) und
   `App._syncNav`/`isValidNav`.

## Bekannte Altlasten

- `app/src/lib/util/offline.ts` (übernommene Registrierung von `gotv-sw.js`) wird nicht mehr
  benutzt; die Web-Version nutzt `app/src/service-worker.ts`. Entfernen nur nach Rückfrage.
- `UnderConstructionModal` / `onShowUnderConstruction` hat seit 25.11.2026 nur noch einen
  Aufrufer (Rengo/Simul-Herausforderungen in `onSelectChallenge`).

## Offene Roadmap (alte "Phase 6" der TV-Planung, nur dokumentiert)

- [ ] **(a) events.json von GitHub laden:** Community pflegt Events per PR,
  App lädt `raw.githubusercontent.com/<org>/<repo>/main/tv/events.json`
  (CORS-fähig). Vorab klären: Repo-Besitzer, Review-Prozess, Fallback
  auf das lokale `public/tv/events.json`, wenn der Fetch fehlschlägt.
  Ergänzung: ein erster, konkreter Umsetzungsvorschlag liegt bereits vor
  (events.json Schema v2, siehe Roadmap oben) — Repo-Besitzer/Review-Prozess
  sind noch offen.
- [ ] **(b) YouTube Data API — automatische Erkennung von Live-Übertragungen:**
  Live-Streams bekannter Go-Kanäle automatisch im Kalender anzeigen.
  Vorab klären: API-Key (wer betreibt ihn? Server-seitig nötig, Key gehört
  NICHT in den Client), Quota (10k Units/Tag Default), Datenschutz
  (welche Daten werden abgefragt und wo verarbeitet?).
- [x] **(c) KataGo-Analyse:** umgesetzt im Browser (WebGPU/WASM, kein
  Backend-Dienst), nur beim Nachspielen - siehe "KataGo im Browser" oben.

## Nächste Schritte (Stand 24.11.2026, vom Nutzer so abgelegt)

Erledigt am 23.11.: Ko-Regel bei eigenen Zügen, Varianten dauerhaft speichern + SGF-Export,
Gesamtauswertung der Partie mit KataGo, Speed-Go-Importer, Sicherungsdatei "Meine Daten",
Offline-Nutzung der Web-Version (siehe oben). Offen, in dieser Reihenfolge:

Kein eigener Server vorhanden (Nutzer, 24.11.2026). Deshalb NICHT weiterverfolgt:
- Erinnerungen bei geschlossener App (Web-Push braucht einen Server, der sendet).
- Echte Erkennung laufender YouTube-Sendungen (API-Schlüssel gehört auf einen Server).
  Einzige serverlose Möglichkeit, falls gewünscht: ein geplanter GitHub-Actions-Lauf mit
  dem Schlüssel als Repository-Secret, der angekündigte Sendungen der Kanäle (mit
  `video_id`) in events.json schreibt - nur so oft wie der Lauf, also kein Live-Status
  in Echtzeit. Braucht einen YouTube-API-Schlüssel vom Nutzer.

Bewusst so gelassen (Nutzer, 24.11.2026, vormittags - am Abend ersetzt durch die Tauri-Desktop-Apps, siehe oben): kein AppImage/.deb - die Desktop-App läuft
über `desktop/install.sh`, andere nutzen die Web-Version (GitHub Pages). Damit entfallen
auch Vite-Umstieg und Einreich-Formular als offene Punkte (wieder aufgreifen nur auf
ausdrücklichen Wunsch). Erledigt aus dem externen Feedback: cmdtest-Hinweis.

**Umbau auf Svelte 5 (Entscheidung 24.11.2026):** Plan in `docs/umbau-svelte.md` - neue App
in `app/` (SvelteKit + TypeScript + Vite), eigenes modernes Design (kein CGoban-/Shin-KGS-
Nachbau), Logik wird übernommen, die alte App läuft bis zum Umschalten weiter. Vor dem Bau der
Oberfläche gibt der Nutzer einen Design-Entwurf frei (Phase 2a).
Stand 24.11.2026: Phasen 0 und 1 fertig; Phase 2a als Entwurf gebaut (Commit 1ca80f7) und
online unter https://ajiai-labs.github.io/GoTV/neu/ (CI legt `app/` mit
`BASE_PATH=/GoTV/neu` neben die alte Web-Version, `gotv-sw.js` lässt `/neu/` aus). Zwei
Designs "Modern" und "Oldschool" in Einstellungen umschaltbar; GoTV-Logo
(`desktop/icons/gotv.svg`) oben links auf jeder Seite (Wunsch des Nutzers). Details in
`docs/umbau-svelte.md` ("Phase 2a – Stand"). Vom Nutzer freigegeben (24.11.2026).
Phasen 2b-5 am 24.11.2026 umgesetzt - Stand und Aufbau in `docs/umbau-svelte.md`
("Phasen 2b–5 – Stand"), Regeln für weitere Arbeit in `docs/neubau-regeln.md`. **Phase 6 am
25.11.2026 erledigt** (vom Nutzer bestätigt, Commit 3ae1f06): Web-Version = neue App unter
`/GoTV` (`/GoTV/neu/` und `/GoTV/tv` leiten dorthin), alte React-App, Root-`package.json`,
`yarn.lock`, Flow/ESLint-Konfig, `.travis.yml`, `server/`, alte `public/`-Dateien,
`app/src/lib/demo/` und `install.sh --alt` entfernt; der neue Service Worker löscht die alten
`gotv-app-*`-Caches. Imports aus `src/lib` als `#lib/...` mit Dateiendung (SvelteKit 3).

Offen bleibt außerdem:

1. **Weitere Brettquellen:** Fox hat keine offene Schnittstelle (Nutzer wartet auf
   Rückmeldung von Fox) - für FJ Dickhuts Fox-Partien fehlt das Brett neben dem Video.
   IGS bleibt blockiert, bis die Nutzungsbedingungen geklärt sind.

## Bewusst NICHT bauen (Entscheidungen des Nutzers)

- **Keine KataGo-Analyse laufender Partien** (Live, Beobachten, Übertragungen) - Nutzer,
  24.11.2026: damit könnte man betrügen (Beispiel Bundesliga: Partie läuft auf KGS, ein zweites
  Fenster mit GoTV zeigt den besseren Zug). KataGo gibt es nur beim Nachspielen beendeter Partien.
  Auch nicht "verzögert" oder als Option.
- **Spielern folgen nur auf KGS** (24.11.2026): der Nutzer spielt nicht auf OGS, OGS ist nur
  Quelle für Übertragungen.
- **Keine KGS-Aufzeichnungen/Vorlesungen** (25.11.2026): über die JSON-Schnittstelle kommen nur
  Züge und Markierungen, kein Ton (`START_PLAYBACK`, `PLAYBACK_DATA`), viele sind nur für
  KGS-Plus-Abonnenten. `playback.ts` bleibt ein Gerüst.

## Desktop-Apps Windows/macOS/Linux (Tauri 2, 24.11.2026)

Entscheidung des Nutzers: herunterladbare Desktop-Apps (ersetzt "kein AppImage" vom
24.11. vormittags). `desktop/tauri/`: `gotv-server` (Rust, Gegenstück zu goTV_local.py:
127.0.0.1, freier Port, Host-/Origin-Prüfung, `/json/access` ohne Origin zu KGS, Cookies ohne
Domain/Secure/SameSite für den lokalen http-Weg, 18 Tests gegen ein Fake-KGS, CI-Job
`desktop-server`) und `gotv-desktop` (Tauri-Fenster auf diesem Server). Frontend:
`VITE_API_URL=/json/access VITE_EVENTS_REMOTE_FIRST=true` (Kalender zuerst von GitHub, kein
Timer). Release: Tag `desktop-vX.Y.Z` pushen → `.github/workflows/desktop.yml` baut
Windows (.exe/.msi), macOS universal (.dmg), Linux (.AppImage/.deb), lädt sie zusätzlich mit
festen Namen hoch und veröffentlicht erst, wenn alle drei Builds grün sind. Fremd-Actions per
Commit-SHA gepinnt, Tauri-CLI exakt. Nicht signiert (Warnung beim ersten Start, Anleitung in
`desktop/tauri/README.md`). iPad: keine App möglich, Web-Version. Download-Bereich in der
Web-Version: `app/src/lib/ui/DesktopDownloads.svelte` (KGS-Seiten, Einstellungen), Links
`releases/latest/download/<fester Name>`. Lokale Rust-Werkzeuge nur per `nix shell
nixpkgs#cargo nixpkgs#rustc` (nichts global). Die Linux-Skriptinstallation (`install.sh`)
bleibt daneben bestehen.

## Sprachen, Teilen, Lieblingsräume, Home-Bildschirm (24.11.2026)

- Oberfläche Deutsch/Englisch: `app/src/lib/i18n/` (eigene kleine Schicht, `t()`, Typprüfung
  erzwingt gleiche Schlüssel), Sprache nach Browser, Wahl in Einstellungen (`gotv.language`).
- Nachspielen "Link kopieren": öffentliche Web-Adresse aus `app/src/lib/publicUrl.ts`
  (beim Umschalten der Web-Version auf `/GoTV` anpassen), `?sgf=…&zug=N`.
- "Mit KataGo auswerten" nur nach Ende einer eigenen KGS-Partie (`?katago=1`), nie während.
- Lieblingsräume (`gotv.favoriteRooms`), nach jeder Anmeldung betreten.
- Web-Version auf iPad/iPhone: Hinweis "Zum Home-Bildschirm", Web-App-Manifest.
- Externe Analyse (24.11.2026, `docs/analyse-prompt-neubau.md`) - behobene Befunde: leere
  KGS-Antwort stoppte den Empfang (auch alte App), Automatch über zwei Antworten,
  Verzögerung spoilerte beim Einstieg, YouTube-@handle blockierte das OGS-Brett,
  Offline-Caches beider Apps löschten sich gegenseitig, zweiter Klick auf Beobachten.
- Kinomodus: Nachspielbrett wächst mit der Trennkante; Partie-Ansicht mit eigener Trennkante.

## Spielern folgen (nur KGS, 24.11.2026)

Stern "Folgen" im KGS-Profil (`UserDetailsModal`), Liste "Gefolgte Spieler" auf Live und
(sobald jemand gefolgt wird) auf Beobachten: spielt gerade gegen X [Rang] · Zug N mit
"Ansehen", sonst "gerade keine Partie". `app/src/lib/model/FollowedPlayers.ts` (Namen ohne
Groß/Klein, `gotv.followedPlayers`, in "Meine Daten" vereinigt), reaktiv in
`app/src/lib/ui/user/followed.svelte.ts`. `FollowWatcher` im Layout meldet per
Browser-Benachrichtigung neue Partien gefolgter Spieler - gleicher Schalter und dieselbe
Erlaubnis wie die Erinnerungen in "Mein GoTV"; Partien, die bei der Anmeldung schon laufen oder
eines gerade gefolgten Spielers, nur in der Liste. Grundlage: KGS-Liste laufender Partien
(`activeGames`), keine zusätzlichen Anfragen; private Partien stehen dort nicht. Nicht in der
Web-Version (dort kein KGS).

## Automatische Gegnerwahl (KGS-Automatch, 24.11.2026)

Neu in GoTV (gab es in Shin KGS nicht), Vorbild CGoban: Spielen-Seite, Schalter
"Automatische Gegnerwahl" und Fenster "Autowahleinstellungen" (Gegnerwahl: Mensch, Bot,
Gegner ohne Rang, Max. Rangunterschied; Spielart: Gewertet, Frei; Spielgeschwindigkeit:
Mittel, Schnell, Blitz). `app/src/lib/model/automatch.ts`, Aktionen `onSetAutomatchPrefs`,
`onStartAutomatch`, `onCancelAutomatch`, `onAutomatchGameJoined` in AppActions, Zustand
`automatchEnabled` aus `AUTOMATCH_STATUS`. Protokoll laut gokgs.com/json/upstream.html:
`AUTOMATCH_SET_PREFS`, `AUTOMATCH_CREATE`, `AUTOMATCH_CANCEL`; die Einstellungen gehen so
zurück, wie KGS sie in `AUTOMATCH_PREFS` geschickt hat (die Doku schreibt das Rangfeld
"estiamtedRank"). Wie KGS einen gefundenen Gegner meldet, sagt die Doku nicht: GoTV öffnet
jede Partie, der KGS den Nutzer während der Suche als Spieler beitreten lässt (`GAME_JOIN`),
wie eine angenommene Herausforderung. NOCH NICHT an einer echten Sitzung geprüft.

## Offene Entscheidungen (Produkt, Stand heute)

- **Wöchentlicher Event-Scanner:** Idee, die Quellen EGF-Twitch-Zeitplan, KGS-Events
  und Profi-Turnierseiten wöchentlich automatisch zu prüfen und einen PR mit neuen
  Events auf den Fork zu öffnen. Braucht Schreibzugriff (PR-Rechte) auf den Fork —
  noch nicht eingerichtet, noch keine Entscheidung.
- **Belegte, aber nicht als gestreamt bestätigte Turniere (Winter):** Hungarian Open
  Budapest (21.–22.11.), Berliner Kranich (28.–29.11.), Velika Gorica (12.–13.12.),
  Grand Prix Żołędowo (5.–6.12.). Keine Video-ID/Stream-URL eingetragen, solange eine
  Übertragung nicht bestätigt ist (kein Eintrag aus dem Gedächtnis).

## Spielen: Leiste, Töne, Archiv, Gegenvorschläge (25.11.2026)

- **Keine Menüleiste bei offenem Brett** (Wunsch: wie das eigene Partiefenster in CGoban):
  eigene Partie, Beobachten und geladenes Nachspielen blenden die obere Leiste aus
  (`boardOpen` in `app/src/routes/+layout.svelte`); stattdessen kleines GoTV-Logo
  (`app/src/lib/ui/HomeLink.svelte`) vor „Zurück“ - auch während der eigenen Partie der Weg
  zurück. Nachspielen hat ein eigenes „Zurück“ (zur Herkunftsseite, sonst zu den Listen;
  `app.closeReplay`).
- **Töne beim Spielen** (`app/src/lib/sound/gameSounds.ts`, Web Audio, keine Tondateien;
  Einstellungen „Töne beim Spielen“, `gotv.sounds`, alles an): Steinklick bei jedem Zug der
  eigenen Partie (`GameScreen`), Klang bei Partiebeginn (`playGameStart` in AppActions bei
  `CHALLENGE_FINAL` als Spieler, Automatch, fortgesetzter Partie), Piepton für jede der letzten
  10 Sekunden auf der eigenen laufenden Uhr (`GameClock announce`, letzte 3 höher), Ding-Dong bei
  einer Chatnachricht an mich (26.11.2026, `model/chatSound.ts`: private Nachricht oder Chat in
  der eigenen laufenden Partie, nie eigene Nachrichten, Räume oder beobachtete Partien; Schalter
  „Chatnachricht“; ersetzt das alte `two_tone_03b.mp3`, die Datei liegt ungenutzt). Wunsch:
  hören, dass es weitergeht, auch beim Kochen. Nicht in der Web-Version (kein KGS).
- **Nicht beendete Partien fortsetzen** (Spielen): statt „Noch nicht verfügbar“ lädt ein
  Dialog die Partie per `ROOM_LOAD_GAME` (nicht privat) in einen Raum;
  `AppActions.onLoadedGameJoined` öffnet den folgenden `GAME_JOIN` (30 s nach der Anfrage, wir
  sind Spieler, keine Besprechung) als eigene Partie. `LOAD_FAILED` → `loadFailed` im Zustand,
  Hinweis mit „Erneut versuchen“.
- **Archivpartien in GoTV nachspielen** (Spielerprofil): „In GoTV nachspielen“ lädt privat als
  KGS-Besprechung und öffnet sie in Nachspielen (`app.openArchiveReplay`), KataGo per Schalter;
  „Zurück“ verlässt die Besprechung bei KGS wieder. „Partie laden“ (KGS-Besprechung) bleibt.
- **Gegenvorschläge**: ändert der Ersteller einer Herausforderung die Bedingungen
  (`CHALLENGE_PROPOSAL` ≠ unser Vorschlag), schloss GoTV die Herausforderung bisher stumm.
  Jetzt `counterProposal` an der Herausforderung, Anzeige mit hervorgehobenen Änderungen,
  „Annehmen“ (`onAcceptCounterProposal`, `CHALLENGE_ACCEPT`) / „Ablehnen“ (verlässt sie).
- Alle drei KGS-Abläufe (Fortsetzen, Archiv, Gegenvorschlag) sind nach der Protokoll-Doku
  gebaut, aber NOCH NICHT an einer echten KGS-Sitzung geprüft - wie die Automatik-Gegnerwahl.
- Desktop-Downloads aktualisieren sich NICHT von selbst: neue Version nur per Tag
  `desktop-vX.Y.Z` (Nutzer fragen, ein Release ist öffentlich).

## Fortsetzen, Verlassen-Warnung, Update-Hinweis (25.11.2026, abends)

- "Nicht beendete Partien" (Spielen) zeigt jetzt ALLE nicht beendeten Partien des eigenen
  Archivs wie CGoban "Fortsetzen" (vorher nur `inPlay`, und jede Änderung der Partielisten
  löschte die Einträge wieder): `getUnfinishedGames` in `model/game/message.ts`; offene
  Partien (Gegner wartet, `inPlay`) zuerst und fett.
- Eigene laufende Partie verlassen fragt nach (wie CGoban): Zurück zur Partie / Aufgeben /
  Verlassen (`GameScreen`).
- Desktop-Apps (Tauri): Update-Hinweis beim Start + "Über GoTV" in den Einstellungen
  (Version, "Nach Updates suchen"); `lib/desktopUpdate.ts`, `lib/ui/update/`. GitHub-API
  `releases/latest`, Tag `desktop-v…`. Download über `POST /desktop/open-download/<Datei>`
  im gotv-server (nur die fünf festen Dateinamen, öffnet den System-Browser). Bewusst
  KEIN globales Abfangen von Navigationen (`on_navigation` trifft auf macOS/Linux auch
  Iframes, also YouTube/Twitch). Kein Tauri-Updater-Plugin (bräuchte Signaturschlüssel).
  Wirkt erst ab dem nächsten Release (0.2.0 hat den Hinweis noch nicht).

## Mehrere Fenster, eine KGS-Verbindung (26.11.2026)

Anlass: Video des Nutzers mit drei Tabs (Spielen, Beobachten, Chat). Jeder Tab stellte die
gespeicherte Anmeldung wieder her und pollte DIESELBE KGS-Sitzung (gemeinsames Cookie) - jede
KGS-Nachricht kam nur in einem Tab an. Wunsch: Partien in eigenen Fenstern wie CGoban; Fenster,
die schon offen sind, kommen nach vorn statt doppelt.

- `app/src/lib/windowLink.ts`: das erste Fenster hält die Verbindung (Web Lock
  `gotv-kgs-connection`, endet mit dem Fenster), weitere Fenster sind "follower": Snapshot des
  Zustands über `BroadcastChannel('gotv-kgs-link')`, danach dieselben Nachrichten (Folgenummer,
  bei Lücke neuer Snapshot) durch denselben Reducer (`AppStore.setOnDispatch`/`replaceState`).
  Aktionen eines Followers gehen als `call` an den Besitzer, nur die Partie-Aktionen in
  `FORWARDED_ACTIONS` (nichts, was das Hauptfenster umschaltet). Schließt der Besitzer, übernimmt
  ein wartender Follower mit seinem gespiegelten Zustand und pollt weiter. Ohne Web Locks /
  BroadcastChannel und in Tests (`MODE === 'test'`) ist jedes Fenster Besitzer wie vorher.
- Ein zweiter Tab zeigt auf KGS-Seiten "KGS läuft in einem anderen GoTV-Fenster" (`KgsGate`);
  Live/Kalender/Kanäle/Nachspielen gehen normal. Follower zeigen keine Profil-Dialoge,
  Erinnerungen, Folgen-Meldungen, Postfach- oder Update-Hinweise (nur das Hauptfenster).
- Partiefenster `/partie?id=N` (`routes/partie`, `lib/gameWindows.ts`): Klick auf eine Partie
  (Beobachten, Gefolgte Spieler, Raumchat, eigene laufende Partie auf Spielen) öffnet sie per
  `window.open(url, 'gotv-partie-N')`; ein schon offenes Fenster kommt nach vorn
  (`app.watchGame`). Blockiert der Browser, zeigt das Hauptfenster die Partie wie bisher.
  "Eigenes Fenster" im Partiekopf verschiebt eine angezeigte Partie (`app.moveGameToWindow`,
  `onShowGameElsewhere`). Eine eigene Partie, die ohne Klick beginnt (Automatch,
  angenommene Herausforderung, fortgesetzte Partie: `playGameId` wechselt), versucht GoTV
  ebenfalls ins eigene Fenster zu schieben (`app.moveNewOwnGameOut`, nicht beim Wiederherstellen
  nach Neuladen); blockiert der Browser das Fenster ohne Klick, bleibt sie im Hauptfenster. Schließen
  eines Fensters verlässt eine beobachtete Partie bei KGS, die eigene läuft weiter.
  Einstellung "Partien in eigenem Fenster öffnen" (`gotv.gameWindows`, Vorgabe an).
- Tauri (`gotv-desktop/src/main.rs`): `on_new_window` macht aus window.open auf den lokalen
  Server ein weiteres App-Fenster (`window_features` = verwandte Webview, gemeinsamer Speicher);
  andere Adressen (Links aus Stream-Playern) gehen in den System-Browser. Wirkt erst ab dem
  nächsten Desktop-Release. Die Skript-Installation (Chromium `--app`) öffnet Pop-ups selbst.
- Brettübersicht `/bretter` (`model/team.ts`, Wunsch 26.11.2026, Go-Bundesliga): ein eigenes,
  ruhiges Fenster mit bis zu 4 festen Brettplätzen (`gotv.team`), getrennt vom eigenen
  Partiefenster (Nutzer: Teambretter neben dem eigenen Brett lenken ab - keine Leiste im
  Partiefenster). Partien kommen hinein über Beobachten (Haken "Partien in die Brettübersicht
  holen", `gotv.boardsMode`: jeder Klick in der Liste landet dort; ist die Übersicht voll,
  öffnet die Partie trotzdem im eigenen Fenster mit deutlichem Hinweis - ein Klick darf nie
  nichts tun, Befund des Nutzers 26.11.2026; Bretter mit Partien einer früheren KGS-Sitzung
  gelten als frei und zeigen "nicht mehr da"), "Zur Brettübersicht" im
  Mehr-Menü einer beobachteten Partie und im Spielerprofil (laufende Partie des Spielers,
  `findRunningGames`). Klick auf ein Brett vergrößert es im selben Fenster (gemerkt in
  `gotv.teamView`), Esc/"Alle Bretter" zurück, "Eigenes Fenster" trennt es ab, "×" nimmt es vom
  Brett. Die Bretter füllen das Fenster (1 allein, 2 nebeneinander bzw. im hohen Fenster
  untereinander, ab 3 zwei mal zwei; quadratisch per `container-type: size`). Das vergrößerte
  Brett hat den Partiechat daneben zum Mitlesen und Schreiben (`ui/game/BoardChat.svelte`,
  Wunsch des Nutzers); die Übersicht zeigt nur Stellungen. Keine Analyse (Absprachen während der
  Partie verboten, DGoB-Bundesliga-Turnierordnung § 3). Neue Züge holen das Fenster nie nach vorn.
  Die eigene laufende Partie steht (abschaltbar: "Eigene Partie zeigen", `gotv.boardsOwnGame`)
  als erstes Brett mit Rahmen in der Übersicht, nur als Vorschau: Klick holt das eigene
  Partiefenster nach vorn, gespielt wird nur dort (Nutzer: das separate Fenster kann mehr).
  Fenster werden per Name erst leer geöffnet und dann geladen (`openNamed`; Tauri lässt dafür
  `about:blank` als lokales Fenster zu). Ist ein Fenster des Namens schon offen, wird es
  geschlossen und frisch geöffnet: unter Wayland (GNOME, Rechner des Nutzers) tut
  `window.focus()` auf ein anderes Fenster stillschweigend nichts - der Klick wirkte wie tot
  (Befund 26.11.2026, ein verstecktes altes Brettübersicht-Fenster). Partie- und
  Brettübersicht-Seite treten einer Partie wieder bei, sobald KGS die Mitgliedschaft beendet
  (das ersetzte Fenster verlässt beobachtete Partien beim Schließen). Eine Aufstellung per Namenseingabe hat der Nutzer abgelehnt
  ("die Fenster holt man sich über Beobachten oder das Profil"). Für Turnierübertragungen
  (mehrere Bretter) später dieselbe Steuerung - noch nicht gebaut.
- NOCH NICHT an einer echten KGS-Sitzung mit mehreren Fenstern geprüft.

## Steinoptik (26.11.2026)

Weiß wie Muschelsteine (gedämpftes Elfenbein statt Reinweiß, feine Wachstumslinien, 8 Varianten,
Nachbarn nie gleich), Schwarz wie matter Schiefer; Weiß 2 % kleiner wie bei echten Go-Sets (helle
Steine wirken größer). Vom Nutzer aus drei Entwürfen gewählt, gilt für beide Designs.
`app/src/lib/ui/board/stoneLook.ts`, gezeichnet in `Board.svelte` (Linien einmal in `<defs>`,
pro Stein ein `<use>`; Schiefer-Korn als Muster-Kachel, nicht als Filter pro Stein).
README-Screenshots `docs/screenshots/app/nachspielen-katago.png` und `einstellungen.png` am
26.11.2026 neu aufgenommen (Playwright gegen den Dev-Server auf Port 5199, 1280x800,
`gotv.design` per localStorage); `live.png`, `kalender.png`, `kanaele-classic.png` zeigen keine
Steine und sind unverändert. README um die Funktionen vom 25./26.11. ergänzt.

## CGoban-Funktionen aus den Videos des Nutzers (25.11.2026, abends)

- Beobachten, "Mehr": "Ergebnis schätzen" (`model/scoreEstimate.ts`: Zufallspartien mit
  Atari-Regel, tote Gruppen nach mittlerem Besitz, geschlossene Gebiete exakt - KEINE KI;
  nur beim Beobachten, nicht in der eigenen laufenden Partie), "Lokal betrachten"
  (`app.openLocalCopy`: Kopie auf Nachspielen ab dem aktuellen Zug; KataGo gesperrt,
  solange die Partie auf KGS läuft - `KataGoPanel blocked`), "Spiel kopieren in …"
  (`ROOM_CLONE_GAME`, die Kopie öffnet sich unter Beobachten).
- Konto: Nachrichten (Postfach `MESSAGES`, "Gelesen – löschen" = `MESSAGE_DELETE`,
  "Nachricht hinterlassen" = `MESSAGE_CREATE`), Freunde/Ignorierliste/Fanliste
  (`FRIEND_ADD`/`FRIEND_REMOVE`, buddy/censored/fan; Liste aus `LOGIN_SUCCESS.friends`),
  "Keine Unterhaltungen" (`gotv.noChats`; neue Privatchats werden mit `CONVO_NO_CHATS`
  abgelehnt und geschlossen), Server-Statistik (`REQUEST_SERVER_STATS`).
  Modell: `model/community.ts`. Chat von Spielern auf der Ignorierliste blendet GoTV aus.
  Spielerprofil: Knöpfe Freund/Fan/Ignorieren, "Nachricht hinterlassen" bei Offline.
  Die Fanliste von KGS ist getrennt von GoTVs "Spielern folgen" (lokal).
- KGS-Brett immer "ans Fenster angepasst" (Nutzer, 25.11.2026): die Wahl "Mit Scrollen
  vergrößern" (Brett über die Fensterhöhe, seitlich scrollen) ist gestrichen - beim Spielen
  muss das ganze Brett sichtbar sein, CGoban hat das auch nicht. Größe nur über die
  Trennkante. Ein alter Wert `gotv.gameBoardMode` wird ignoriert.
- Chat, Raumliste: "Neuen Raum erstellen" (`CREATE_ROOM_REQUEST`, nur TEMPORARY).
- Nicht gebaut: "Nachricht des Tages" (die JSON-Schnittstelle hat dafür keine Nachricht),
  KGS-Plus-Vorlesungen und KGS-AI (Entscheidungen oben).
- Alle neuen KGS-Abläufe sind nach der Protokoll-Doku gebaut, aber NOCH NICHT an einer
  echten KGS-Sitzung geprüft.
