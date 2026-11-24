import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { language } from '#lib/i18n/index.svelte.ts';
import Page from './+page.svelte';

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
});
