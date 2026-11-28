import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DesktopUpdateBanner from './DesktopUpdateBanner.svelte';
import AboutGoTv from './AboutGoTv.svelte';
import { desktopUpdate } from './desktopUpdate.svelte.ts';

function github(tag: string) {
	return vi.fn((url: string, init?: RequestInit) => {
		if (url.startsWith('/desktop/open-download/') && init?.method === 'POST') {
			return Promise.resolve(new Response('OK', { status: 200 }));
		}
		return Promise.resolve(new Response(JSON.stringify({ tag_name: tag }), { status: 200 }));
	});
}

describe('desktop update notice', () => {
	beforeEach(() => {
		desktopUpdate.reset();
		localStorage.removeItem('gotv.updateDismissed');
	});
	afterEach(() => localStorage.removeItem('gotv.updateDismissed'));

	it('offers a newer version and opens its installer in the browser', async () => {
		const fetchFn = github('desktop-v0.3.0');
		await render(DesktopUpdateBanner, { version: '0.2.0', fetchFn: fetchFn as typeof fetch });
		await expect
			.element(page.getByRole('heading', { name: 'Neue Version 0.3.0 ist da' }))
			.toBeVisible();
		await expect.element(page.getByText('Du hast Version 0.2.0.', { exact: false })).toBeVisible();
		await page
			.getByRole('button', { name: /Herunterladen/ })
			.first()
			.click();
		await expect.element(page.getByText('Der Download wurde im Browser geöffnet.')).toBeVisible();
		expect(fetchFn.mock.calls.some(([url]) => url.startsWith('/desktop/open-download/'))).toBe(
			true
		);
	});

	it('stays hidden when GoTV is up to date or "Später" was chosen', async () => {
		const { unmount } = await render(DesktopUpdateBanner, {
			version: '0.3.0',
			fetchFn: github('desktop-v0.3.0') as typeof fetch
		});
		await expect.poll(() => desktopUpdate.status).toBe('upToDate');
		expect(page.getByRole('complementary').elements()).toHaveLength(0);
		await unmount();

		desktopUpdate.reset();
		await render(DesktopUpdateBanner, {
			version: '0.2.0',
			fetchFn: github('desktop-v0.3.0') as typeof fetch
		});
		await page.getByRole('button', { name: 'Später' }).click();
		await expect.poll(() => page.getByRole('complementary').elements().length).toBe(0);
		expect(localStorage.getItem('gotv.updateDismissed')).toBe('0.3.0');
	});

	it('never checks in the web version', async () => {
		const fetchFn = github('desktop-v9.0.0');
		await render(DesktopUpdateBanner, { version: null, fetchFn: fetchFn as typeof fetch });
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it('shows the version and checks on demand in the settings', async () => {
		await render(AboutGoTv, {
			version: '0.3.0',
			kind: 'desktop',
			fetchFn: github('desktop-v0.3.0') as typeof fetch
		});
		await expect.element(page.getByText('GoTV Desktop, Version 0.3.0')).toBeVisible();
		await page.getByRole('button', { name: 'Nach Updates suchen' }).click();
		await expect.element(page.getByText('Du hast die neueste Version.')).toBeVisible();
	});

	it('tells the web version it is always current', async () => {
		await render(AboutGoTv, { version: null, kind: 'web' });
		await expect.element(page.getByText(/immer auf dem neuesten Stand/)).toBeVisible();
		// The data comes from third parties - no AI training (28.11.2026).
		await expect.element(page.getByRole('heading', { name: 'Daten und Quellen' })).toBeVisible();
		await expect.element(page.getByText(/KI-Modellen .* nicht gestattet/)).toBeVisible();
	});
});
