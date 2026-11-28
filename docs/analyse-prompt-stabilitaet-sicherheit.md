# Analyse-Prompt: Stabilität, Bugs und Sicherheit (Stand 28.11.2026)

Für einen zweiten Agenten, der GoTV unabhängig prüft. Kopierbar ab der Linie. Wunsch des
Nutzers: „Analyse nach Bugs, Sicherheit und Stabilität – besonders wichtig ist, dass die App
stabil funktioniert.“ Für den Sicherheitsteil ist der Skill `security-audit`
(`~/.claude/skills/security-audit/`) vorgesehen.

---

Du prüfst die GoTV-App im Repo `~/Projekte/aktiv/shinkgs` (Branch `feature/go-tv`). GoTV ist eine
Svelte-5-/TypeScript-App (`app/`) mit vollständigem KGS-Client, Go-TV (Übertragungen, Kalender,
Kanäle, Nachspielen mit KataGo im Browser), einem lokalen Python-Server für die
Linux-Skriptinstallation (`desktop/goTV_local.py`, `desktop/script_update.py`), Tauri-Desktop-Apps
(`desktop/tauri/`: Rust-Server `gotv-server`, Fenster `gotv-desktop`) und Python-Importern, die
täglich per GitHub Actions `public/tv/events.json` aus fremden Quellen schreiben (`tools/`).

Lies zuerst `AGENTS.md` (ganz – sie beschreibt jede Entscheidung und jeden bekannten Fallstrick),
`docs/neubau-regeln.md` und `README.md`. Die frühere Prüfung `docs/analyse-prompt-fenster.md` und
die Abschnitte „Prüfbericht …“ in AGENTS.md zeigen, was schon gefunden und behoben wurde – melde
das nicht noch einmal, prüfe aber, ob die Behebung hält.

**Auftrag:** Nur prüfen und berichten. Nichts ändern, nichts committen, nichts pushen, kein
Release, keine Tags. Antworte auf Deutsch.

**Ausführung und Grenzen:**

- Keine Anmeldung bei echtem KGS, OGS oder anderen Diensten mit echten Konten, keine Anfragen an
  Live-Dienste über das hinaus, was zum Lesen öffentlicher Doku nötig ist. Für KGS-Abläufe gibt es
  das Übungs-KGS `tools/fake_kgs.py` (Optionen `--strict`: meldet ab wie KGS bei unbekannten
  Kanälen, `--review-delay`: langsamer Server) – nur auf einem freien Port (nicht 3000, nicht
  8788/8799, wenn dort GoTV läuft).
- Den Ordner `build-desktop/` nicht neu bauen und den laufenden GoTV-Server nicht beenden: die
  installierte App des Nutzers läuft darauf. Für eigene Builds eine Kopie in einem
  Scratch-Verzeichnis.
- Tests laufen so wie in der CI: `cd app && npm run check && npm run lint && npm test && npm run
  build`, dazu `python3 -m unittest tools.test_update_events tools.test_check_links
  tools.test_refresh_tv_events tools.test_speedgo tools.test_fake_kgs tools.test_script_update
  tools.test_youtube_videos`. Melde, wenn etwas davon rot ist oder flackert (mehrmals laufen
  lassen; ein Test, der nur unter Last scheitert, ist ein Befund).

## Teil A – Sicherheit (Skill `security-audit`, voller Audit)

Lade den Skill `security-audit` und arbeite im **Full audit mode** (alle Phasen, Bericht nach
`report-schema.json`, Ausgabe außerhalb des Repos unter `~/security-audit-skill/gotv/run-<N>`).
Halte dich an seine Sandbox-Regeln. Vertrauensgrenzen, die GoTV wirklich hat:

1. **Lokaler Python-Server** (`desktop/goTV_local.py`): bindet an 127.0.0.1; DNS-Rebinding-Schutz
   (`_request_allowed`: Host und Origin), Pfad-Durchgriff beim Ausliefern von `build-desktop/`,
   KGS-Proxy `/json/access` (Cookies, Header-Filter, Long-Polling ohne Timeout – Ressourcen?).
   **Neu und heikel:** `/desktop/script-update` (`script_update.py`) führt auf POST `git fetch`,
   `git pull --ff-only` und `sh desktop/install.sh` aus und startet den Server per `os.execv` neu.
   Prüfe: Kann eine fremde Webseite (CSRF, DNS-Rebinding, Weiterleitung), eine eingebettete
   Seite (YouTube-/Twitch-Iframe) oder ein anderer lokaler Nutzer das auslösen? Reichen Origin-
   Pflicht und Kopfzeile `X-GoTV-Update`? Was passiert bei parallelen Anfragen, bei einem Repo
   ohne Upstream, mit lokalen Änderungen, bei hängendem `npm ci`, bei Neustart mitten in einer
   KGS-Verbindung? Kann der Inhalt des Fehlerprotokolls (Ausgabe von git/npm) in der Seite Schaden
   anrichten?
2. **Tauri** (`desktop/tauri/gotv-server`, `gotv-desktop/src/main.rs`): dieselben Fragen für den
   Rust-Server (Host-/Origin-Prüfung, freier Port, Cookies ohne Domain/Secure), dazu
   `/desktop/open-download/<Datei>` (nur feste Dateinamen?), `on_new_window` (welche Adressen
   werden App-Fenster, welche gehen in den System-Browser, `about:blank`).
3. **Inhalte aus fremden Quellen in der Oberfläche** – mögliches XSS oder Link-Missbrauch: KGS
   (Chat, Raumbeschreibungen, Profile, Partienamen, Kommentare/Tags, SGF-Kommentare),
   OGS (Partiechat über WebSocket, SGF), `events.json` (Namen, Notizen, `stream_url`,
   `results_url`, `winner`, Videotitel aus YouTube-Feeds), hochgeladene/eingefügte SGF-Dateien,
   Links im Chat (`util/urls.ts`, „Stream öffnen“). Sucht gezielt nach `{@html`, `innerHTML`,
   `href` mit fremden Werten (`javascript:`), `target=_blank` ohne `rel`, Iframe-Quellen
   (nur `youtube-nocookie.com/embed` und `player.twitch.tv` mit `parent=` erlaubt).
4. **Importer und Lieferkette** (`tools/update_events.py`, `speedgo.py`, `youtube_videos.py`,
   `.github/workflows/*.yml`): Fremde HTML-/XML-/ICS-/JSON-Daten werden ungeprüft in
   `events.json` geschrieben und automatisch auf `master` committet – was kann eine manipulierte
   Quelle (DGoB, EGF, Speed-Go-Seite, YouTube-Feed, Twitch-iCalendar) dort hineinbringen, und
   was macht die App daraus? XML-Parser (XXE, Entity-Expansion), Regex auf großem HTML (ReDoS),
   Rechte der Workflows (`permissions`), gepinnte Actions, Release-Workflow `desktop.yml`.
5. **Speicher und Daten im Browser**: was in `localStorage` liegt (KGS-Zugangsdaten?
   `gotv.kgsChannels`, Backup „Meine Daten“ – enthält die Sicherungsdatei Geheimnisse?),
   `BroadcastChannel`/Web Locks zwischen Fenstern (`windowLink.ts`), Service Worker der
   Web-Version (`app/src/service-worker.ts`: was wird gecacht, kann ein alter/fremder Stand
   hängen bleiben?).
6. **Datenschutz-Zusagen der App prüfen**: Zwei-Klick-Lösung (vor dem Klick kein Request an
   YouTube/Twitch – auch keine Vorschaubilder), keine Anfragen an Dritte ohne Grund,
   KI-Trainings-Vorbehalt (`app/src/app.html`, „Über GoTV“) vorhanden.

Melde nur Befunde mit echter Grenzverletzung (wer greift an, was erreicht er). „Gleicher Nutzer
schadet sich selbst“ ist kein Befund.

## Teil B – Bugs und Stabilität (Schwerpunkt des Nutzers)

Die KGS-Verbindung ist die oberste Priorität: KGS beendet die GANZE Sitzung („Internal error …
Unknown channel“), wenn es eine Anfrage für einen Kanal bekommt, den es nicht kennt, und eine
abgebrochene Sitzung kostet den Nutzer eine laufende Partie.

1. **KGS-Verbindung**: `model/KgsClient.ts` (eine Abrufschleife pro Sitzung, Wiederholungen,
   5xx/4xx, Nicht-JSON), `model/channelGuard.ts` (das eine Tor für JOIN/UNJOIN, Wiederherstellung
   nach F5), `AppActions.ts` (`onViewGame`/`onUnviewGame`, `_joinForViews`, `onLeaveGame`,
   Besprechungen `_reviewPending`, Archiv laden `_loadRequestedGame`). Suche jeden Weg zu einer
   Anfrage für einen unbekannten oder geschlossenen Kanal, zu doppelten Anfragen, zu Anfragen
   nach Abmeldung. Spiele mit `tools/fake_kgs.py --strict` (und `--review-delay 12`) Abläufe
   durch: Partie beobachten, Fenster schließen/öffnen, F5, Brettübersicht mit 6 Brettern,
   eigene Partie mit Aufgeben, Besprechung bearbeiten, Archivpartie laden, „Jetzt auf KGS“ →
   „In die Brettübersicht“.
2. **Mehrere Fenster** (`windowLink.ts`, `gameWindows.ts`, `routes/partie`, `routes/bretter`):
   Besitzerwechsel, Lücken in der Nachrichtenfolge, Aktionen aus Follower-Fenstern, die still
   ins Leere laufen, Fenster, die nach Abmeldung offen bleiben.
3. **Laufzeit und Speicher**: Timer, `setInterval`, Abrufe und Event-Listener, die beim Verlassen
   einer Seite oder beim Schließen eines Dialogs nicht enden (KataGo-Worker, OGS-WebSocket,
   OGS-Polling, Uhren, Update-Abfrage `ScriptUpdate`, Kanal-/Kalender-Refresh). Verhalten nach
   Stunden: wächst `gamesById`, der Chat, der Spielbaum, der Verzögerungspuffer (`DelayBuffer`)?
   Lange Partielisten (über 500 Partien unter Beobachten mit Filtern), Ergebnis schätzen auf
   19×19 (`model/scoreEstimate.ts`, blockiert es die Oberfläche?).
4. **Fehlerpfade**: Was sieht der Nutzer, wenn KGS, OGS, GitHub (events.json), YouTube-Feeds oder
   der lokale Server nicht antworten oder Unsinn liefern? Gibt es weiße Seiten, hängende
   Spinner, Knöpfe ohne Wirkung, unbehandelte Promise-Ablehnungen, Fehler, die eine ganze Seite
   abstürzen lassen (Svelte-Fehler in einer Liste mit doppelten Schlüsseln, `each_key_duplicate`)?
5. **Neue Funktionen vom 27./28.11.2026** besonders prüfen (git log ab `bd97cd2`): Besprechungen
   bearbeiten (`model/game/review.ts`, `ReviewTools.svelte`), Ergebnis schätzen überall außer in
   der eigenen laufenden Partie (`GameMoreMenu`, `SgfReplayView`, `TvGamePanel`), Update-Knopf
   der Skriptinstallation, Steinklick (Aufnahmen, `sound/gameSounds.ts`), Uhr im Byo-Yomi
   (`GameClock.svelte`: stimmt die Annahme „KGS schickt `periodsLeft` 0 in der Hauptzeit“?),
   Ranggraph, „Jetzt auf KGS“ (`getKgsNowGroups`), Regeln aus Listeneinträgen
   (`parseFlatRules`: Regelwerk als Text darf das Regelobjekt nicht ersetzen), Filter unter
   Beobachten (`model/game/filter.ts`), Turnierarchiv als ZIP (`util/zip.ts`,
   `model/tournamentArchive.ts`: ZIP-Format, Dateinamen, große Turniere), Twitch-/YouTube-/
   Sieger-Importe.
6. **Regeln des Nutzers, die nie verletzt werden dürfen** (AGENTS.md „Bewusst NICHT bauen“): keine
   KataGo-Analyse laufender Partien (auch nicht über Umwege wie „Lokal betrachten“, SGF-Export
   oder Link einer laufenden Partie), keine Hilfe in der Brettübersicht für laufende Partien
   außer „Ergebnis schätzen“, nur offizielle Embed-Player, KGS-Plus/Vorlesungen nicht. Finde
   jeden Weg, der eine davon umgeht.
7. **Testlücken**: wichtige Abläufe ohne Test, Tests, die nur Attrappen prüfen, Tests, die von
   Zeit oder Last abhängen.

## Bericht

Eine Liste, nach Schwere geordnet (kritisch / hoch / mittel / niedrig). Je Befund: Titel, Datei
und Zeile, was passiert (konkrete Schritte oder Eingaben), warum es ein Fehler ist, Beleg
(Test-Ausgabe, Übungs-KGS-Protokoll, Codestelle), kleinster sinnvoller Fix als Vorschlag – ohne
ihn einzubauen. Trenne **bestätigt** (nachgestellt) von **Verdacht** (nur aus dem Code gelesen).
Teil A zusätzlich als Bericht des Skills im Ausgabeordner. Am Ende: was du nicht prüfen konntest
und warum (z. B. echte KGS-Sitzung, macOS/Windows-WebViews).
