import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ScriptUpdateBanner from './ScriptUpdateBanner.svelte';

const target = {
	describe: 'desktop-v0.4.1-45-gd0aa26e',
	commit: 'd0aa26e',
	date: '2026-11-28T13:10:00Z'
};

function service(behind: number) {
	return vi.fn((url: string) =>
		Promise.resolve(
			new Response(
				JSON.stringify({
					state: 'idle',
					error: null,
					behind,
					dirty: false,
					restart: false,
					log: [],
					current: null,
					target,
					phase: null,
					restarting: false,
					changes: ['feat(app): a', 'feat(app): b', 'fix(app): c', 'docs: d']
				}),
				{ status: 200 }
			)
		).then((response) => {
			void url;
			return response;
		})
	);
}

describe('ScriptUpdateBanner', () => {
	afterEach(() => localStorage.removeItem('gotv.scriptUpdateDismissed'));

	it('says in one line that an update is there, and goes away with ×', async () => {
		const fetchFn = service(3);
		await render(ScriptUpdateBanner, { fetchFn: fetchFn as typeof fetch, playing: false });
		await expect.element(page.getByText(/Update verfügbar: GoTV 0\.4\.1\+45/)).toBeVisible();
		await expect.element(page.getByText(/2 neue Funktionen, 1 Fehler behoben/)).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Zu „Über GoTV“' })).toBeVisible();
		// The main window asks the service to look on GitHub.
		expect(fetchFn.mock.calls[0][0]).toMatch(/\/check$/);
		await page.getByRole('button', { name: 'Später' }).click();
		await expect.element(page.getByRole('complementary')).not.toBeInTheDocument();
		expect(localStorage.getItem('gotv.scriptUpdateDismissed')).toBe('d0aa26e');
	});

	it('stays short during your own game', async () => {
		await render(ScriptUpdateBanner, { fetchFn: service(3) as typeof fetch, playing: true });
		await expect.element(page.getByText(/aktualisiere nach deiner Partie/)).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Zu „Über GoTV“' }))
			.not.toBeInTheDocument();
		await expect.element(page.getByText('Was ist neu')).not.toBeInTheDocument();
	});

	it('only reads the last answer in other windows, and is silent without news', async () => {
		const fetchFn = service(0);
		await render(ScriptUpdateBanner, {
			fetchFn: fetchFn as typeof fetch,
			playing: false,
			fetchesGitHub: false
		});
		await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled());
		expect(fetchFn.mock.calls[0][0]).toMatch(/script-update$/);
		await expect.element(page.getByRole('complementary')).not.toBeInTheDocument();
	});
});
