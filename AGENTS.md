# GoTV (hervorgegangen aus ShinKGS)

Eigenständiges Projekt `diebugger-tech/GoTV`, hervorgegangen aus jkk/shinkgs (React 16,
Flow, react-scripts 3.4.1, SCSS); die Fork-Verbindung hat der Nutzer am 24.11.2026 gelöst
("Leave fork network"). `LICENSE.txt` (MIT, Justin Kramer) bleibt für den übernommenen Code.
Web-Client für den KGS Go Server über die JSON-API, erweitert zu "GoTV" — drei Bausteine:

1. **Live:** starke Partien, die gerade auf KGS laufen, prominent anzeigen und beobachten.
2. **Kalender:** Turniere mit Übertragung (YouTube/Twitch), Stream direkt in der App.
3. **Nachspielen:** SGF einer Profipartie laden und Zug für Zug auf dem ShinKGS-Brett durchgehen.

Referenz-Logik (Rust, funktioniert bereits): `~/Projekte/aktiv/Tiger-s-Mouth`
Nur LOGIK und Datenschemata übernehmen, portiert nach JavaScript/Flow im ShinKGS-Stil.
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
- Nach jedem Schritt: `yarn lint && yarn flow && CI=true yarn build` müssen grün sein
  (mit `CI=true` zählen Build-Warnungen als Fehler - wie in der GitHub-CI), dazu die
  App-Tests und die Python-Tool-Tests.
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

## Setup (exakt, einmalig — Node 24 via Nix)

Node kommt aus dem Nix-Store (read-only), yarn fehlt systemweit. Einmalig ausführen:

```bash
corepack prepare yarn@1.22.22 --activate
printf 'exec corepack yarn "$@"\n' > ~/.local/bin/yarn && chmod +x ~/.local/bin/yarn
cd ~/Projekte/aktiv/shinkgs && yarn install
```

- Der Shim in `~/.local/bin/yarn` hat **kein Shebang** (kein `!` — zsh History Expansion);
  zsh/sh führen die Datei bei ENOEXEC selbst aus.
- `packageManager: yarn@1.22.22` in package.json → corepack wählt die Version.

## Befehle

| Befehl | Zweck |
|---|---|
| `yarn start` | Dev-Server (Port 3000) |
| `PORT=3100 yarn start` | Port 3000 belegt → anderer Port |
| `CI=true yarn start` | nicht-interaktiver Kontext ohne TTY (sonst beendet sich start.js beim stdin-Ende) |
| `yarn build` | Production-Build (Web) → `build/` |
| `yarn lint` | eslint src/ |
| `yarn flow` | flow check |
| `yarn test` | react-scripts test --env=jsdom |
| `http://localhost:3100/#tv-dev` | Dev-Harness: kompletter TV-Flow ohne KGS-Login (nur Development) |
| `desktop/install.sh` | Desktop-App bauen + installieren (siehe Desktop-Abschnitt) |
| `yarn build:pages` | Web-Version für GitHub Pages: `PUBLIC_URL=/GoTV`, `REACT_APP_GUEST_ONLY=true` (nur Gast-TV, kein Login), `404.html` = `index.html` |

Gate nach jedem Schritt: `yarn lint && yarn flow && CI=true yarn build` plus Tests (siehe Regeln oben)

## Build-Kette — bekannte Punkte

- react-scripts 3.4.1 (webpack 4) braucht auf Node 17+ `NODE_OPTIONS=--openssl-legacy-provider`
  (md4-Hash). Ist in den start/build-Scripts bereits eingebaut (cross-env).
- node-sass 4.14.1 → `sass` (dart-sass) 1.77.8 ersetzt (baut nicht auf Node 24).
  SCSS in `src/css/` kompiliert **unverändert**. dart-sass meldet Deprecation-Warnings
  (Slash-Division, mixed declarations, z.B. `_board.scss:73-74`) — unschädlich, bewusst
  nicht angefasst (minimal-invasiv).
- Kein React-/react-scripts-Upgrade in Phase 0.
- `BUILD_PATH` wird von react-scripts 3.4.1 ignoriert: die Desktop-Variante baut mit
  eigener `REACT_APP_API_URL` und verschiebt danach `build/` → `build-desktop/`
  (siehe `desktop/install.sh`). Ein späterer einfacher `yarn build` erzeugt `build/`
  neu mit der Standard-Env und lässt `build-desktop/` unberührt — beide Konfigurationen
  nicht verwechseln.

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
- CI + Web-Version (`.github/workflows/ci.yml`, 23.11.2026): jeder Push/PR führt Lint,
  Flow, App-Tests, Python-Tool-Tests und Build aus (plus Harness-Grep). Auf master wird
  danach `yarn build:pages` nach https://diebugger-tech.github.io/GoTV/ veröffentlicht
  (fürs Tablet: Seite öffnen, "Zum Startbildschirm"). Dort gibt es nur das Gast-TV
  (`GUEST_ONLY` in `App.js`): KGS lässt Anfragen nur von seiner eigenen Webseite zu, die
  Desktop-App braucht dafür ihren lokalen Proxy. Die History bleibt unter `/GoTV`
  (basename), `404.html` fängt Unterpfade ab. Tägliche Bot-Commits (GITHUB_TOKEN) starten
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
  den Import-Eintrag. Vergangene speedgo-Einträge bleiben 120 Tage. 0 gefundene
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
- Dev-Harness: `src/index.js` enthält einen NODE_ENV-gegateten Block (`#tv-dev`), der den
  TV-Tab mit simulierten Daten rendert (6 Fake-Partien inkl. einer Event-Vorlesung, die
  NICHT unter Live erscheinen darf; Übertragung mit Brett, Übertragung nur mit Stream,
  Turnierseite ohne Video; Chat-Messages mit Stream-Links, Replay). Zusätzlich lädt das
  Event `dev-today-ogs` die historische OGS-Partie 2 real und anonym für den API-/UI-Test;
  `dev-today-ogs-players` folgt per `ogs_players` der heutigen Partie eines OGS-Bots.
  `TvScreen` nimmt dafür optional rohe `events` (wie `CalendarView`). Er wird im Production-Build von terser
  weggefaltet — nach jedem Build prüfen:
  `grep -rl "GO-TV-DEV-HARNESS" build/` darf nichts finden. Deshalb auch
  `GENERATE_SOURCEMAP=false` im build-Script (sonst stünde der Quelltext in den .map-Dateien).
  `public/tv/demo.sgf` ist die Demo-Fixture für den Harness und `sgf_url`.

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
- [x] App-Name + Icon: GoTV (Repo diebugger-tech/GoTV, Icon `desktop/icons/gotv.svg`)

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

- `src/App.test.js` crasht in jsdom (indexedDB fehlt) — vorbestehend, nicht Teil des Gates;
  neue Tests gezielt laufen lassen: `CI=true yarn test --watchAll=false --testPathPattern="src/(model|util)"`.
- Dev-Server ohne TTY beendet sich nach dem Banner still (start.js: stdin-Ende) →
  Hintergrundstart nur mit `CI=true`.
- Port 3000 ist auf diesem Rechner dauerhaft fremdbelegt (firecrawl-mcp, 13.11.2026)
  → Dev-Server mit `PORT=3100` (oder einem anderen freien Port).
- Production-Build ohne Sourcemaps (`GENERATE_SOURCEMAP=false`) — nötig, damit der
  Dev-Harness-Quelltext nicht über sourcesContent im Build landet.

## Offene Roadmap (Phase 6, nur dokumentiert)

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

Bewusst so gelassen (Nutzer, 24.11.2026): kein AppImage/.deb - die Desktop-App läuft
über `desktop/install.sh`, andere nutzen die Web-Version (GitHub Pages). Damit entfallen
auch Vite-Umstieg und Einreich-Formular als offene Punkte (wieder aufgreifen nur auf
ausdrücklichen Wunsch). Erledigt aus dem externen Feedback: cmdtest-Hinweis.

Offen bleibt nur:

1. **Weitere Brettquellen:** Fox hat keine offene Schnittstelle (Nutzer wartet auf
   Rückmeldung von Fox) - für FJ Dickhuts Fox-Partien fehlt das Brett neben dem Video.
   IGS bleibt blockiert, bis die Nutzungsbedingungen geklärt sind.

## Offene Entscheidungen (Produkt, Stand heute)

- **Wöchentlicher Event-Scanner:** Idee, die Quellen EGF-Twitch-Zeitplan, KGS-Events
  und Profi-Turnierseiten wöchentlich automatisch zu prüfen und einen PR mit neuen
  Events auf den Fork zu öffnen. Braucht Schreibzugriff (PR-Rechte) auf den Fork —
  noch nicht eingerichtet, noch keine Entscheidung.
- **Belegte, aber nicht als gestreamt bestätigte Turniere (Winter):** Hungarian Open
  Budapest (21.–22.11.), Berliner Kranich (28.–29.11.), Velika Gorica (12.–13.12.),
  Grand Prix Żołędowo (5.–6.12.). Keine Video-ID/Stream-URL eingetragen, solange eine
  Übertragung nicht bestätigt ist (kein Eintrag aus dem Gedächtnis).
