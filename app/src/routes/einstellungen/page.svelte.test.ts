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

	it('offers a soft tone per basic colour for every design and remembers it', async () => {
		await render(Page);
		// Warm paper is the default (28.11.2026).
		await expect.element(page.getByRole('radio', { name: 'Warmes Papier' })).toBeChecked();
		for (const name of ['Gelb', 'Rot', 'Blau', 'Grün (bisher)']) {
			await expect.element(page.getByText(name, { exact: true })).toBeVisible();
		}
		await page.getByText('Blau', { exact: true }).click();
		expect(document.documentElement.dataset.tone).toBe('blue');
		expect(localStorage.getItem('gotv.tone')).toBe('blue');
		// Every design combines with every tone (user, 28.11.2026).
		await page.getByText('Modern dunkel', { exact: true }).click();
		await expect.element(page.getByRole('radio', { name: 'Blau' })).toBeChecked();
		expect(document.documentElement.dataset.design).toBe('modern-dark');
		expect(document.documentElement.dataset.tone).toBe('blue');
		await page.getByText('Modern', { exact: true }).click();
		await page.getByText('Warmes Papier', { exact: true }).click();
	});

	it('has Classic in light and dark, the dark one with the Classic rules', async () => {
		await render(Page);
		await page.getByText('Classic dunkel', { exact: true }).click();
		expect(document.documentElement.dataset.design).toBe('oldschool');
		expect(document.documentElement.dataset.scheme).toBe('dark');
		expect(localStorage.getItem('gotv.design')).toBe('oldschool-dark');
		await page.getByText('Classic', { exact: true }).click();
		expect(document.documentElement.dataset.design).toBe('oldschool');
		expect(document.documentElement.dataset.scheme).toBeUndefined();
		await page.getByText('Modern', { exact: true }).click();
	});

	it('offers four variants of every sound and remembers the choice', async () => {
		await render(Page);
		const stones = page.getByRole('combobox', { name: 'Klang: Steinklick' });
		await expect.element(stones).toHaveValue('kaya');
		await stones.selectOptions('Dickes Brett');
		expect(localStorage.getItem('gotv.stoneSound')).toBe('thick');
		const start = page.getByRole('combobox', { name: 'Klang: Partiebeginn' });
		await expect.element(start).toHaveValue('gongChord');
		await start.selectOptions('Tiefer Gong');
		expect(localStorage.getItem('gotv.startSound')).toBe('deepGong');
		const countdown = page.getByRole('combobox', { name: 'Klang: Zeit läuft ab' });
		await expect.element(countdown).toHaveValue('ebowl');
		await countdown.selectOptions('Klangschale');
		expect(localStorage.getItem('gotv.countdownSound')).toBe('bowl');
		const messages = page.getByRole('combobox', { name: 'Klang: Chatnachricht' });
		await expect.element(messages).toHaveValue('dingDong');
		await messages.selectOptions('Tropfen');
		expect(localStorage.getItem('gotv.messageSound')).toBe('drop');
	});

	it('switches the sounds of an own game and remembers them', async () => {
		localStorage.removeItem('gotv.sounds');
		const view = await render(Page);
		const click = page.getByRole('checkbox', { name: /Steinklick/ });
		await expect.element(click).toBeChecked();
		await expect.element(page.getByRole('checkbox', { name: /Partiebeginn/ })).toBeChecked();
		await expect.element(page.getByRole('checkbox', { name: /Zeit läuft ab/ })).toBeChecked();
		await click.click();
		expect(JSON.parse(localStorage.getItem('gotv.sounds') ?? '{}')).toEqual({
			stones: false,
			gameStart: true,
			countdown: true,
			messages: true
		});
		await view.unmount();
		await render(Page);
		await expect.element(page.getByRole('checkbox', { name: /Steinklick/ })).not.toBeChecked();
	});

	it('shows all sound switches the same size, however long the text', async () => {
		await page.viewport(560, 800);
		await render(Page);
		const widths = page
			.getByRole('checkbox', { name: /Steinklick|Partiebeginn|Zeit läuft ab|Chatnachricht/ })
			.elements()
			.map((box) => box.getBoundingClientRect().width);
		expect(widths).toHaveLength(4);
		expect(new Set(widths).size).toBe(1);
		await page.viewport(414, 896);
	});
});
