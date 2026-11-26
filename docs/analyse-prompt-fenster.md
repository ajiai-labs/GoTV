# Analyse-Prompt: Fenster, Brettübersicht, Töne (Stand 26.11.2026)

Für einen zweiten Agenten, der die Arbeit vom 26.11.2026 unabhängig prüft. Kopierbar ab der
Linie.

---

Du prüfst die GoTV-App im Repo `~/Projekte/aktiv/shinkgs` (Branch `feature/go-tv`, Svelte 5 +
TypeScript in `app/`, Tauri-Desktop in `desktop/tauri/`). Lies zuerst `AGENTS.md`, besonders die
Abschnitte „Mehrere Fenster, eine KGS-Verbindung“, „Steinoptik“, „Spielen: Leiste, Töne …“ und
„Bewusst NICHT bauen“, dazu `docs/neubau-regeln.md`.

**Auftrag:** Nur prüfen und berichten, nichts ändern, nichts committen, nichts pushen. Antworte
auf Deutsch.

**Umfang:** die Commits `0d3fb37..HEAD` (`git log --oneline 6b7bf4e..HEAD`). Schwerpunkt:

1. **Eine KGS-Verbindung für alle Fenster** – `app/src/lib/windowLink.ts`, `app/src/lib/app.svelte.ts`
   (`startOwner`, `startFollower`, `serveFollowers`), `AppStore.setOnDispatch/replaceState`.
   Prüfe: Reihenfolge und Lücken (`FollowerFeed`), Übernahme, wenn das Besitzer-Fenster schließt,
   was ein Follower-Fenster tun darf (`FORWARDED_ACTIONS`), ob irgendeine Aktion im Follower still
   ins Leere läuft, obwohl die Oberfläche einen Knopf dafür zeigt (z. B. im Spielerprofil eines
   Partiefensters).
2. **KGS-Abos pro Partie** – `AppActions.onViewGame/onUnviewGame/_joinForViews/_releaseGame`,
   `onLeaveGame`, `routes/partie/+page.svelte`, `routes/bretter/+page.svelte`. KGS meldet die
   GANZE Sitzung ab („Internal error … Unknown channel N“), sobald es `JOIN_REQUEST` oder
   `UNJOIN_REQUEST` für einen Kanal bekommt, den es nicht kennt. Suche jeden Weg, auf dem GoTV
   trotzdem so eine Anfrage schicken kann: doppelte Abmeldung, Abmeldung nach `UNJOIN`/`CLOSE`
   vom Server, Anmeldung für beendete oder aus der Liste entfernte Partien, Wettläufe beim
   Schließen und frisch Öffnen eines Fensters (3-s-Verzögerung), Abmelden/Anmelden,
   Neuladen (F5), Übernahme durch einen Follower (geht die Liste der Ansichten verloren?).
   Auch `TvGameSubscriptions`, `onCloseUserDetail`, Räume und `closeReplay` gegenprüfen.
3. **Partiefenster und Brettübersicht** – `app/src/lib/gameWindows.ts` (`openNamed`,
   `openGameWindow`, `openBoardsWindow`, `bringToBoards`, Modus-Haken), `model/team.ts`,
   `routes/beobachten`, `UserDetailsModal` („Zur Brettübersicht“), `GameMoreMenu`.
   Unter Wayland holt `window.focus()` kein anderes Fenster nach vorn; deshalb wird ein offenes
   Fenster geschlossen und neu geöffnet. Prüfe: Kann ein Klick je „nichts“ tun? Öffnen sich je
   zwei Fenster? Kommen alte Bretter zurück? Verhalten bei voller Übersicht (4 Bretter), bei
   Partien einer früheren Sitzung (`app.isLiveGame`), bei Pop-up-Sperre, nach Abmeldung.
   Beobachtung aus dem Nutzervideo (21:53): ein Partiefenster zeigte kurz ein leeres Brett, und
   die Brettübersicht zeigte am Ende nur einen Hinweistext – klären, ob das ein Ladezustand oder
   ein Fehler ist.
4. **Eigene Partie** – `app.moveNewOwnGameOut`, `GameScreen` (`inWindow`, `onBack`,
   „Eigenes Fenster“, Verlassen-Warnung), Vorschau „Deine Partie“ in der Brettübersicht. Die eigene
   laufende Partie darf nie ungewollt bei KGS verlassen werden.
5. **Brettgröße** – `GameScreen.svelte`: Trennkante speichert den Anteil der Seitenspalte
   (`gotv.gameSideShare`). Prüfe Fenstergrößen von 900 px bis 2560 px Breite, hohe und flache
   Fenster, ob das Brett immer ganz sichtbar ist und mit dem Fenster wächst (Vorbild CGoban).
6. **Töne** – `sound/gameSounds.ts`, `model/chatSound.ts` (`isChatForMe`, `commentAuthor` für
   den Partiechat als COMMENT in `GAME_UPDATE`). Kein Ton für eigene Nachrichten, beobachtete
   Partien oder die Brettübersicht; Steinklick nur in der eigenen laufenden Partie.
7. **Netz** – `KgsClient`: 5xx gilt als Netzfehler mit Wiederholung, 4xx als verlorene Sitzung.
   Passt das zu dem, was KGS und der lokale Proxy (`desktop/goTV_local.py`, `gotv-server`)
   tatsächlich liefern?
8. **Tauri** – `desktop/tauri/gotv-desktop/src/main.rs` (`on_new_window`, `about:blank`, externe
   Links in den System-Browser). Funktioniert das Öffnen per Name samt Wiederfinden eines offenen
   Fensters in WebKitGTK, WKWebView und WebView2 so wie in Chromium?
9. **Nebenbei** – Speed-Go-Importer (`tools/speedgo.py`: `OGS_ACCOUNTS`, `learn_ogs_accounts`),
   Steinoptik (`ui/board/stoneLook.ts`, Leistung bei vielen Steinen und in der Brettübersicht).

**Regeln, die nicht verletzt werden dürfen:** keine KataGo-Analyse laufender Partien (auch
nicht in Brettübersicht oder Partiefenster), keine Hilfe von außen in Mannschaftskämpfen
(keine Analysewerkzeuge in der Brettübersicht), Streams nur über offizielle Embed-Player, keine
Co-Authored-By-Zeilen.

**Prüfen darfst du:** Code lesen, `cd app && npm run check && npm run lint && npm test && npm run
build`, die Python-Tests (`python3 -m unittest tools.test_update_events tools.test_check_links
tools.test_refresh_tv_events tools.test_speedgo`), eigene Wegwerf-Tests oder Playwright gegen
einen Dev-Server auf Port 5199 (`npx vite dev --port 5199`; Port 3000 ist belegt). Lege
Wegwerf-Dateien nur außerhalb des Repos ab. KEINE Anmeldung bei KGS oder OGS und keine Anfragen an
echte Dienste ohne Rückfrage beim Nutzer.

**Ergebnis:** eine Liste von Befunden, die schwersten zuerst. Pro Befund:
- Schwere: kritisch (Sitzungsabbruch, Datenverlust, Regelverstoß) / hoch (Funktion kaputt) /
  mittel / niedrig
- Datei und Zeile
- Wie es zum Fehler kommt (konkrete Schritte oder Nachrichtenfolge)
- Beleg (Testausgabe, Codestelle, Reproduktion) – nichts behaupten, was nicht geprüft ist;
  Vermutungen als Vermutung kennzeichnen
- Vorschlag, wie es zu beheben wäre (nur beschreiben, nicht umsetzen)

Zum Schluss: was ausdrücklich geprüft und in Ordnung ist, und was du nicht prüfen konntest
(z. B. echte KGS-Sitzung, Tauri-Pakete auf Windows/macOS).
