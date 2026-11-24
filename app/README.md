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
