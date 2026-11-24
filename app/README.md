# GoTV – new app (Svelte 5 + TypeScript)

The new frontend of GoTV, built step by step next to the current app in the
repository root. Plan and phases: [`../docs/umbau-svelte.md`](../docs/umbau-svelte.md).

```bash
cd app
npm install
npm run dev          # development server
npm run check        # TypeScript / Svelte check
npm run lint         # Prettier + ESLint
npm test             # unit tests (Node) + component tests (Chromium)
BASE_PATH=/GoTV npm run build   # static build as for GitHub Pages
```

Component tests run in real browsers. Locally Chromium (`npx playwright install
chromium` once); the CI also runs them in WebKit, Safari's engine, because GoTV has
to work on the iPad. Choose browsers with `TEST_BROWSERS=chromium,webkit`.

## Designs

Two designs, chosen under Einstellungen and remembered in the browser
(`gotv.design`): **Modern** and **Oldschool**. All colours, fonts and spacing are CSS
variables in `src/app.css` (`:root[data-design='…']`); `src/app.html` applies the
saved design before the first paint. Components only read these variables, plus a
few `:global([data-design='oldschool'])` rules where the oldschool layout differs.

- `src/lib/ui/design.svelte.ts` - current design, switching, storage
- `src/lib/ui/Board.svelte` - the Go board as SVG (both looks)
- `src/lib/ui/PlayerBar.svelte`, `src/lib/ui/WinCurve.svelte`
- `src/lib/demo/` - sample data for the draft (EM 2026 final, real dates)

Imports from `src/lib` use `#lib/...` with the file extension
(`#lib/model/sgf.ts`, `#lib/ui/Board.svelte`), as SvelteKit 3 expects.

## Preview on GitHub Pages

The CI builds this app with `BASE_PATH=/GoTV/neu` next to the current web version:
https://ajiai-labs.github.io/GoTV/neu/. Pages are prerendered one file per route, so
reloading a sub-page works on GitHub Pages.

## Structure

- `src/lib/model/`, `src/lib/util/` - the logic of the old app in TypeScript (unchanged
  behaviour, with its tests).
- `src/lib/app.svelte.ts` - the running app: store, KGS connection, actions, navigation.
- `src/lib/config.ts` - build settings (`VITE_API_URL`, `VITE_GUEST_ONLY`, base path).
- `src/lib/ui/` - components: `game/`, `chat/`, `user/`, `tv/`, the board and shared parts.
- `src/routes/` - one page per area: Live (`/`), Kalender, Kanäle, Nachspielen,
  Beobachten, Spielen, Chat, Suche, Konto, Einstellungen.
- `src/service-worker.ts` - offline support of the web version.

Rules for changing or adding screens: [`../docs/neubau-regeln.md`](../docs/neubau-regeln.md).

## Builds

| Target                                  | Command                                                  |
| --------------------------------------- | -------------------------------------------------------- |
| Development (KGS through the dev proxy) | `npm run dev`                                            |
| Desktop app                             | `sh ../desktop/install.sh` (`VITE_API_URL=/json/access`) |
| Web preview (CI)                        | `BASE_PATH=/GoTV/neu npm run build`                      |
| Web version after the switch-over       | `VITE_GUEST_ONLY=true BASE_PATH=/GoTV npm run build`     |
