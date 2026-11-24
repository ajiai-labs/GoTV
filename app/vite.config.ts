import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

// GitHub Pages serves the web version under /GoTV; the desktop server and the
// development server serve it at the root. BASE_PATH="/GoTV" for Pages builds.
const base = (process.env.BASE_PATH ?? '') as '' | `/${string}`;

// Component tests run in real browsers: Chromium, and WebKit (Safari's engine,
// as on the iPad) wherever its system libraries are installed (the CI does).
const browsers = (process.env.TEST_BROWSERS ?? 'chromium').split(',').map((browser) => ({
	browser: browser.trim() as 'chromium' | 'webkit' | 'firefox',
	headless: true
}));

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// A single-page app: every path falls back to index.html, so /tv,
			// /watch etc. work on GitHub Pages (404.html) and behind the desktop
			// server's SPA fallback.
			adapter: adapter({ fallback: 'index.html' }),
			paths: { base }
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: browsers
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					// Logic tests (taken over from the old app's Jest suite): a
					// browser-like DOM for localStorage, window, Blob and FileReader.
					name: 'unit',
					environment: 'jsdom',
					globals: true,
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
