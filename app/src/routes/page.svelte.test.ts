import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { app } from '#lib/app.svelte.ts';
import type { AppActions } from '#lib/model/AppActions.ts';
import { getInitialState } from '#lib/model/appState.ts';

const mocked = vi.hoisted(() => ({
	events: [] as Array<Record<string, unknown>>,
	channels: [] as Array<Record<string, unknown>>
}));

// events.json without the network: the raw entries, validated as usual.
vi.mock('#lib/model/tv.ts', async (importOriginal) => {
	const original = await importOriginal<typeof import('#lib/model/tv.ts')>();
	return {
		...original,
		fetchTvEvents: () =>
			Promise.resolve(mocked.events.map((raw) => original.validateTvEvent(raw)).filter(Boolean)),
		fetchTvChannels: () =>
			Promise.resolve(mocked.channels.map((raw) => original.validateTvChannel(raw)).filter(Boolean))
	};
});

const { default: Page } = await import('./+page.svelte');

const LOGGED_OUT = { status: 'loggedOut', network: 'online', retryTimes: 0 } as const;

function isoDay(offsetDays: number): string {
	const date = new Date();
	date.setDate(date.getDate() + offsetDays);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

describe('Live', () => {
	beforeEach(() => {
		window.localStorage.clear();
		mocked.events = [];
		mocked.channels = [];
		app.state = getInitialState(LOGGED_OUT);
		app._actions = null;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		window.localStorage.clear();
		app._actions = null;
	});

	it('shows the next event, the way to the calendar and the example when nothing runs', async () => {
		mocked.events = [
			{
				id: 'cup',
				name: 'Herbstpokal',
				date_start: isoDay(3),
				platform: 'twitch',
				stream_url: 'https://www.twitch.tv/somechannel'
			}
		];
		await render(Page);
		await expect
			.element(page.getByRole('heading', { name: 'Gerade keine Übertragung.' }))
			.toBeVisible();
		await expect.element(page.getByText(/Nächstes Event:/)).toBeVisible();
		await expect.element(page.getByText('Herbstpokal', { exact: true })).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Zum Kalender' })).toBeVisible();
		await expect.element(page.getByRole('heading', { name: 'GoTV ausprobieren' })).toBeVisible();
		await expect
			.element(page.getByText('Beispiel · Aufzeichnung, keine Live-Partie'))
			.toBeVisible();
		await expect.element(page.getByRole('heading', { name: 'Mein GoTV' })).toBeVisible();
		await expect.element(page.getByRole('heading', { name: 'Meine Daten' })).toBeVisible();
		// Nothing external before a click.
		expect(document.querySelector('iframe')).toBeNull();
	});

	it('shows a running broadcast with the stream behind a click, without a login', async () => {
		mocked.events = [
			{
				id: 'cup',
				name: 'Herbstpokal',
				date_start: isoDay(0),
				platform: 'twitch',
				stream_url: 'https://www.twitch.tv/somechannel'
			}
		];
		await render(Page);
		await expect.element(page.getByRole('heading', { name: 'Läuft gerade' })).toBeVisible();
		await expect.element(page.getByRole('heading', { name: /Herbstpokal$/ })).toBeVisible();
		await expect.element(page.getByText('Kein KGS-Brett – nur Stream')).toBeVisible();
		expect(document.body.textContent).not.toContain('GoTV ausprobieren');
		expect(document.querySelector('iframe')).toBeNull();
		await page.getByRole('button', { name: 'Stream laden' }).click();
		await expect.element(page.getByTitle('Herbstpokal')).toBeVisible();
		expect(document.querySelector('iframe')?.src).toContain('player.twitch.tv');
		await expect.element(page.getByRole('button', { name: 'Übertragung schließen' })).toBeVisible();
		await page.getByRole('button', { name: 'Übertragung schließen' }).click();
		await expect.poll(() => document.querySelector('iframe')).toBeNull();
	});

	it('points to the channels on air and stars a broadcast for Mein GoTV', async () => {
		mocked.events = [
			{
				id: 'cup',
				name: 'Herbstpokal',
				date_start: isoDay(0),
				platform: 'twitch',
				stream_url: 'https://www.twitch.tv/somechannel'
			}
		];
		await render(Page);
		await page.getByRole('button', { name: 'Herbstpokal zu Mein GoTV hinzufügen' }).click();
		expect(JSON.parse(window.localStorage.getItem('gotv.favorites') ?? '{}')).toEqual({
			channels: [],
			events: ['cup']
		});
		await expect.element(page.getByRole('link', { name: /Herbstpokal\s*Turnier/ })).toBeVisible();
	});

	it('shows the stream opened from the chat as a two-click embed and closes it', async () => {
		const onCloseTvStream = vi.fn();
		app._actions = { onCloseTvStream } as unknown as AppActions;
		app.state = {
			...getInitialState(LOGGED_OUT),
			tvStreamUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
		};
		await render(Page);
		await expect.element(page.getByRole('heading', { name: 'Stream aus dem Chat' })).toBeVisible();
		await expect
			.element(page.getByText('Diesem Stream ist kein KGS-Brett zugeordnet.'))
			.toBeVisible();
		expect(document.querySelector('iframe')).toBeNull();
		const opened = page.getByRole('region', { name: 'Stream aus dem Chat' });
		await opened.getByRole('button', { name: 'Stream laden' }).click();
		await expect
			.poll(() => document.querySelector('iframe')?.src)
			.toContain('youtube-nocookie.com/embed/');
		await page.getByRole('button', { name: 'Stream schließen' }).click();
		expect(onCloseTvStream).toHaveBeenCalled();
	});
});
