# Regeln für den Nachbau der Oberfläche (Svelte 5, `app/`)

Seit 25.11.2026 ist die alte React-App entfernt (Phase 6); ihre Dateien stehen in der
Git-History vor Commit 3ae1f06 (`git show 3ae1f06^:src/ui/<Datei>`). Die Regeln gelten weiter
für jede Arbeit an der Oberfläche in `app/`.

Gilt für jeden, der eine Seite oder einen Baustein der alten React-App (`src/ui/`) in der
neuen App (`app/`) nachbaut. Plan: `docs/umbau-svelte.md`.

## Ziel: 1:1 wie vorher, nur im neuen Design

- Jede Funktion, jeder Knopf, jeder Zustand (laden, leer, Fehler) der alten Komponente
  kommt mit. Erst die alte Datei vollständig lesen, dann nachbauen. Nichts weglassen, nichts
  dazuerfinden.
- Logik nicht neu schreiben: sie liegt schon als TypeScript in `app/src/lib/model/` und
  `app/src/lib/util/` (gleiche Dateinamen wie in `src/model/`, `src/util/`). Importieren,
  nicht kopieren. Fehlt eine reine Hilfsfunktion, die in der alten UI-Datei steckte, kommt sie
  in die neue Komponente.
- Texte zweisprachig: nie direkt ins Markup schreiben, sondern `t('bereich.schluessel', {…})`
  aus `#lib/i18n/index.svelte.ts`; den deutschen Text in `app/src/lib/i18n/de/<bereich>.ts`,
  den englischen in `en/<bereich>.ts` (die Typprüfung meldet fehlende Schlüssel). Deutsch:
  kurz, sachlich, Aktivsätze, Knöpfe sagen, was passiert. Daten (Namen, Notizen, Chat) nicht
  übersetzen. Datumsangaben mit `locale()` statt fest `'de-DE'`.
- Keine KGS-Logos, kein Branding, das GoTV als offiziellen KGS-Client ausgibt.
- Streams nur über die offiziellen Embed-Player, Iframe erst nach Klick (Zwei-Klick), sonst
  "Extern öffnen" mit `target="_blank" rel="noopener noreferrer"`.

## Technik

- Svelte 5 mit Runes (`$state`, `$derived`, `$props`, `$effect`), TypeScript, keine
  Klassenkomponenten, kein Store-Paket.
- App-Zustand und Aktionen: `import { app } from '#lib/app.svelte.ts'`.
  `app.state` ist der komplette alte AppState (reaktiv, nie verändern), `app.actions` die alten
  AppActions (`app.actions.onJoinGame(id)` usw.). Wo die alte Komponente `props.actions.onX`
  oder Felder aus `appState` bekam, liest die neue sie direkt aus `app`.
- Seitenwechsel, die in der alten App ein TV-Reiter waren: `app.openReplay(sgfUrl)` öffnet
  `/nachspielen?sgf=...` (statt `onOpenReplay` im TvScreen), `app.suggestGameReplay(game)`
  öffnet eine beendete KGS-Partie dort (statt `actions.onSuggestGameReplay`).
  `app.actions.onOpenTvStream(url)` öffnet Live mit dem Stream (unverändert).
- Imports aus `src/lib` immer als `#lib/...` MIT Dateiendung: `#lib/model/types.ts`,
  `#lib/ui/Board.svelte`, `#lib/app.svelte.ts`.
- Seiten-Links: `import { resolve } from '$app/paths'`, `href={resolve('/kalender')}`.
- Vorhandene Bausteine benutzen:
  - `#lib/ui/Board.svelte` - Brett (SVG). Props: `board`, `markup` (BoardMarkup aus
    computedState), `lastMove`, `labels`, `coordinates`, `label` (Text für Screenreader),
    `ghost` ('black'|'white'|null, Vorschaustein beim Spielen),
    `onpoint(point, color, mark)`.
  - `#lib/ui/BoardNav.svelte` - Zugleiste (`bind:move`, `total`, `latest`).
  - `#lib/ui/PlayerBar.svelte`, `#lib/ui/WinCurve.svelte`, `#lib/ui/Modal.svelte`
    (`title`, `onclose`, Kinder), `#lib/ui/Spinner.svelte`, `#lib/ui/UnseenBadge.svelte`,
    `#lib/ui/UserName.svelte` (`user`, `extraIcons`), `#lib/ui/KgsGate.svelte` (umschließt
    jede KGS-Seite: Anmeldung, Web-Hinweis).
- Design: nur die CSS-Variablen aus `app/src/app.css` (`--bg`, `--surface`, `--ink`,
  `--ink-soft`, `--rule`, `--accent`, `--accent-ink`, `--accent-soft`, `--live`,
  `--radius-s/m/pill`, `--gap`, ...) und die Klassen `.panel`, `.panel-title`, `.button`,
  `.button-primary`, `.muted`. Beide Designs müssen gut aussehen: wo "Oldschool" anders
  aussehen soll, `:global([data-design='oldschool']) .x { ... }` im Komponenten-Stil.
  Vorbild für Look und Aufbau: die Entwurfsseiten `app/src/routes/+page.svelte`,
  `nachspielen/+page.svelte`, `kalender/+page.svelte`.
- iPad und Handy: funktioniert ab 360 px Breite, Querformat iPad (1180x820) ohne
  Scrollen in der Hauptansicht, Bedienung per Touch (keine Hover-only-Funktionen).
- Barrierefreiheit: echte `<button>`/`<a>`, Beschriftungen, sichtbarer Fokus.

## Prüfen, bevor du fertig meldest

```bash
cd app
npx prettier --write <deine Dateien>
npm run check      # 0 Fehler, 0 Warnungen in DEINEN Dateien
npx eslint <deine Dateien>
npm test           # alle grün
```

- Komponententests (`*.svelte.test.ts`, laufen im echten Browser) für das Wichtigste
  jeder Seite: zeigt Daten an, Knöpfe rufen die richtige Aktion. Muster:
  `app/src/routes/page.svelte.test.ts`, `app/src/lib/ui/BoardNav.svelte.test.ts`.
  Für Seiten mit App-Zustand: `app.state` vor dem Rendern setzen
  (`app.state = {...getInitialState(...), ...}`) und `app._actions` durch ein Objekt mit
  `vi.fn()` ersetzen.
- Andere Helfer arbeiten gleichzeitig in anderen Dateien. Nur die eigenen Dateien anfassen.
  Fehler in fremden Dateien ignorieren und im Bericht nennen. Nicht committen, nicht pushen.
- Bericht am Ende: neue Dateien, was 1:1 übernommen ist, was bewusst anders ist und warum,
  was offen bleibt.
