## 2026-11-13 · DGoB-Import · Claude Opus 5.5
- Im aktuellen Datenbestand trägt jedes Event mit der Kategorie "online-turnier" auch "go-bundesliga" (0 Events mit online-turnier ohne go-bundesliga in der Live-Stichprobe) — tools/update_events.py:279 (DGOB_CATEGORIES). Aufgefallen beim Verifizieren der categories-Filterung gegen die echte API: "online-turnier" trägt im Moment nichts Eigenes zur Treffermenge bei, nur go-bundesliga und deutsche-meisterschaft liefern tatsächlich unterschiedliche Events.

## 28.11.2026 – wackelnder Test unter Last

`app/src/lib/ui/user/UserDetailsModal.svelte.test.ts` „shows the details of another user and starts
a chat“ scheiterte einmal im vollen `npm test`, einzeln zweimal grün, im nächsten vollen Lauf grün.
Ursache nicht untersucht (vermutlich Zeitgrenze unter Last, wie zuvor `ScriptUpdate`).
