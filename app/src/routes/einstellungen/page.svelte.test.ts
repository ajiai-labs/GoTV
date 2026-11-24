import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { language } from '#lib/i18n/index.svelte.ts';
import Page from './+page.svelte';
import { navOrder } from '#lib/ui/navOrder.svelte.ts';

describe('Einstellungen', () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	afterEach(() => {
		window.localStorage.clear();
		document.documentElement.lang = 'de';
	});

	it('switches the language at once and remembers it', async () => {
		await render(Page);
		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent('Einstellungen');
		await expect.element(page.getByText('Modern dunkel')).toBeVisible();

		await page.getByText('English', { exact: true }).click();

		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('Settings');
		await expect.element(page.getByText('Modern dark')).toBeVisible();
		await expect.element(page.getByRole('radio', { name: 'English' })).toBeChecked();
		expect(language.current).toBe('en');
		expect(window.localStorage.getItem('gotv.language')).toBe('en');
		expect(document.documentElement.lang).toBe('en');
		expect(document.title).toBe('Settings – GoTV');

		await page.getByText('Deutsch', { exact: true }).click();

		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent('Einstellungen');
		expect(window.localStorage.getItem('gotv.language')).toBe('de');
		expect(document.documentElement.lang).toBe('de');
	});

	it('switches the menu order and remembers it', async () => {
		localStorage.removeItem('gotv.navOrder');
		navOrder.set('gotv');
		await render(Page);
		await page.getByText('Wie ein KGS-Programm', { exact: false }).click();
		expect(navOrder.current).toBe('kgs');
		expect(localStorage.getItem('gotv.navOrder')).toBe('kgs');
		await page.getByText('Übertragungen zuerst, dann KGS.').click();
		expect(localStorage.getItem('gotv.navOrder')).toBe('gotv');
	});

	it('chooses whether the KGS board fits the window or scrolls and remembers the choice', async () => {
		const view = await render(Page);
		const fit = page.getByText('Ans Fenster anpassen', { exact: true });
		const scroll = page.getByText('Mit Scrollen vergrößern', { exact: true });
		await expect
			.element(page.getByRole('radio', { name: /Mit Scrollen vergrößern/ }))
			.toBeChecked();
		await fit.click();
		expect(localStorage.getItem('gotv.gameBoardMode')).toBe('fit');
		await view.unmount();
		await render(Page);
		await expect.element(page.getByRole('radio', { name: /Ans Fenster anpassen/ })).toBeChecked();
		await scroll.click();
		expect(localStorage.getItem('gotv.gameBoardMode')).toBe('scroll');
	});
});
