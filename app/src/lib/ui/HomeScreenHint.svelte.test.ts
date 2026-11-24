import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import HomeScreenHint from './HomeScreenHint.svelte';

const IPAD = {
	userAgent:
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
	maxTouchPoints: 5,
	standalone: false,
	displayStandalone: false
};

describe('HomeScreenHint', () => {
	beforeEach(() => window.localStorage.clear());
	afterEach(() => window.localStorage.clear());

	it('explains "Zum Home-Bildschirm" in Safari on the iPad and stays closed', async () => {
		const first = await render(HomeScreenHint, { guestOnly: true, device: IPAD });
		await expect.element(page.getByRole('complementary', { name: 'GoTV als App' })).toBeVisible();
		await expect.element(page.getByText(/„Zum Home-Bildschirm“/)).toBeVisible();
		await page.getByRole('button', { name: 'Hinweis schließen' }).click();
		await expect.element(page.getByText(/„Zum Home-Bildschirm“/)).not.toBeInTheDocument();
		expect(window.localStorage.getItem('gotv.homeHintDismissed')).toBe('1');
		await first.unmount();

		await render(HomeScreenHint, { guestOnly: true, device: IPAD });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(document.body.textContent).not.toContain('Zum Home-Bildschirm');
	});

	it('stays away when already on the home screen or outside the web version', async () => {
		const installed = await render(HomeScreenHint, {
			guestOnly: true,
			device: { ...IPAD, standalone: true }
		});
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(document.body.textContent).not.toContain('Zum Home-Bildschirm');
		await installed.unmount();

		await render(HomeScreenHint, { guestOnly: false, device: IPAD });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(document.body.textContent).not.toContain('Zum Home-Bildschirm');
	});

	it('fits a phone screen', async () => {
		await page.viewport(360, 740);
		await render(HomeScreenHint, { guestOnly: true, device: IPAD });
		const hint = page.getByRole('complementary', { name: 'GoTV als App' });
		await expect.element(hint).toBeVisible();
		const box = hint.element().getBoundingClientRect();
		expect(box.left).toBeGreaterThanOrEqual(0);
		expect(box.right).toBeLessThanOrEqual(360);
		await page.viewport(414, 896);
	});
});
