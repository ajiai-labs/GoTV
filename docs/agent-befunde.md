## 2026-11-13 · DGoB-Import · Claude Opus 5.5
- Im aktuellen Datenbestand trägt jedes Event mit der Kategorie "online-turnier" auch "go-bundesliga" (0 Events mit online-turnier ohne go-bundesliga in der Live-Stichprobe) — tools/update_events.py:279 (DGOB_CATEGORIES). Aufgefallen beim Verifizieren der categories-Filterung gegen die echte API: "online-turnier" trägt im Moment nichts Eigenes zur Treffermenge bei, nur go-bundesliga und deutsche-meisterschaft liefern tatsächlich unterschiedliche Events.

## 28.11.2026 – wackelnder Test unter Last

`app/src/lib/ui/user/UserDetailsModal.svelte.test.ts` „shows the details of another user and starts
a chat“ scheiterte einmal im vollen `npm test`, einzeln zweimal grün, im nächsten vollen Lauf grün.
Ursache nicht untersucht (vermutlich Zeitgrenze unter Last, wie zuvor `ScriptUpdate`).

## 28.11.2026 – Partie ohne GAME_JOIN zeigt ein fast leeres Brett

Beim Aufnehmen der README-Bilder (Übungs-KGS, Seitenwechsel per `page.goto` von `/konto` nach
`/bretter`): ein noch offener Abruf (GET) der alten Seite holte die Antwort auf die neue
JOIN_REQUEST ab, die Verbindung war schon zu (`BrokenPipeError` in `tools/fake_kgs.py` `_json`),
das `GAME_JOIN` für Partie 2102 ging verloren. Danach kam nur ein `GAME_UPDATE` mit einem Zug, und
die Brettübersicht zeigte ein Brett mit 1-2 Steinen bei „Zug 104“ - ohne Hinweis, dass der
Partiebaum fehlt. Zwei offene Fragen: (1) Verhält sich der echte KGS bei einem abgebrochenen
Long-Poll genauso (Nachrichten weg) - dann betrifft es F5 auch dort. (2) Baut `parseGameChannel`
aus einem `GAME_UPDATE` ohne vorheriges `GAME_JOIN` einen Baum, der wie eine echte Stellung
aussieht. Nicht untersucht, nichts geändert.

## 28.11.2026 – wackelnder Test in der CI

`app/src/lib/model/KgsClient.test.ts` „keeps trying while logged in, also after many failures“ lief
in der GitHub-CI (Lauf 46140104574, Commit d0aa26e) in die 5-s-Grenze; lokal grün, KgsClient war
nicht geändert. Lauf neu gestartet. Ursache nicht untersucht (vermutlich Zeitgrenze unter Last,
wie `ScriptUpdate` und `UserDetailsModal`).
