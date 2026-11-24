import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ChannelsView from './ChannelsView.svelte';
import { getGermanClock } from '#lib/model/tvChannels.ts';
import type { TvChannel } from '#lib/model/tv.ts';

const NOW = Date.now();
const TODAY = getGermanClock(new Date(NOW)).weekday;
const OTHER_DAY = (TODAY % 7) + 1;

const JUPPTUBE: TvChannel = {
	id: 'jupptube',
	name: 'JuppTube',
	platform: 'youtube',
	url: 'https://www.youtube.com/@jupptube',
	channel_id: 'UCabcdefghijklmnopqrstuv',
	kind: 'player',
	// All day today: on air whenever the test runs.
	schedule: [{ weekday: TODAY, time: '00:00', duration_minutes: 24 * 60 }]
};

const EGF: TvChannel = {
	id: 'egf',
	name: 'EGF',
	platform: 'twitch',
	url: 'https://www.twitch.tv/europeangofederation',
	channel_id: 'europeangofederation',
	notes: 'Turniere der Europäischen Go-Föderation'
};

const PLAYER: TvChannel = {
	id: 'player',
	name: 'Zweiter Spieler',
	platform: 'youtube',
	url: 'https://www.youtube.com/@zweiter',
	channel_id: 'UCzyxwvutsrqponmlkjihgfe',
	kind: 'player',
	schedule: [{ weekday: OTHER_DAY, time: '19:00', duration_minutes: 60 }]
};

const CHANNELS = [PLAYER, JUPPTUBE, EGF];

function groupTitles(): Array<string | undefined> {
	return Array.from(document.querySelectorAll('.ChannelsView-group-title')).map((node) =>
		node.textContent?.trim()
	);
}

describe('ChannelsView', () => {
	it('shows the week plan with today and the running air time marked', async () => {
		await render(ChannelsView, { status: 'ready', channels: CHANNELS, now: NOW });
		await expect.element(page.getByRole('heading', { name: /Wochenplan/ })).toBeVisible();
		const today = page.getByRole('listitem', { name: /\(heute\)/ });
		await expect.element(today).toBeVisible();
		expect(today.element().textContent).toMatch(/00:00 JuppTube/);
		expect(today.element().querySelector('.ChannelWeek-entry-now')).not.toBeNull();
		const days = document.querySelectorAll('.ChannelWeek-day');
		expect(days).toHaveLength(7);
		expect(days[OTHER_DAY - 1].textContent).toContain('19:00');
		expect(days[OTHER_DAY - 1].querySelector('.ChannelWeek-entry-now')).toBeNull();
	});

	it('lists players apart from federations, the one on air first', async () => {
		await render(ChannelsView, { status: 'ready', channels: CHANNELS, now: NOW });
		expect(groupTitles()).toEqual(['Spieler', 'Verbände und Turniere']);
		const players = Array.from(
			document.querySelectorAll('.ChannelsView-group-player .ChannelCard-name')
		).map((node) => node.textContent?.trim());
		expect(players).toEqual(['JuppTube', 'Zweiter Spieler']);
		await expect.element(page.getByText('läuft gerade (geplant)')).toBeVisible();
		await expect
			.element(page.getByText(/Feste Sendezeit: .* 19:00 Uhr \(deutsche Zeit\)/))
			.toBeVisible();
	});

	it('puts starred channels on top and toggles the star', async () => {
		const onToggleFavorite = vi.fn();
		await render(ChannelsView, {
			status: 'ready',
			channels: CHANNELS,
			now: NOW,
			favoriteIds: ['egf'],
			onToggleFavorite
		});
		expect(groupTitles()).toEqual(['★ Favoriten', 'Spieler']);
		const favorites = page.getByRole('region', { name: '★ Favoriten' });
		await expect.element(favorites.getByRole('heading', { name: /EGF$/ })).toBeVisible();
		await page.getByRole('button', { name: 'JuppTube zu Mein GoTV hinzufügen' }).click();
		expect(onToggleFavorite).toHaveBeenCalledWith('jupptube');
	});

	it('links to the platform, embeds after a click and offers the Twitch chat', async () => {
		await render(ChannelsView, { status: 'ready', channels: [EGF], now: NOW });
		const open = page.getByRole('link', { name: 'Auf Twitch öffnen (mit Chat)' });
		await expect
			.element(open)
			.toHaveAttribute('href', 'https://www.twitch.tv/europeangofederation');
		await expect.element(open).toHaveAttribute('rel', 'noopener noreferrer');
		// No air times: no week plan.
		expect(document.querySelector('.ChannelWeek')).toBeNull();
		expect(document.querySelector('iframe')).toBeNull();
		await page.getByRole('button', { name: 'Stream laden' }).click();
		await expect.element(page.getByTitle('EGF', { exact: true })).toBeInTheDocument();
		await page.getByRole('button', { name: 'Twitch-Chat anzeigen' }).click();
		const chat = page.getByTitle('Chat: EGF');
		await expect.element(chat).toBeInTheDocument();
		expect(chat.element().getAttribute('src')).toContain(
			'twitch.tv/embed/europeangofederation/chat'
		);
	});

	it('says so when the roster cannot be loaded and retries', async () => {
		const onRetry = vi.fn();
		await render(ChannelsView, { status: 'error', channels: [], now: NOW, onRetry });
		await expect.element(page.getByText(/Kanäle konnten nicht geladen werden/)).toBeVisible();
		await page.getByRole('button', { name: 'Erneut versuchen' }).click();
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it('names an empty roster', async () => {
		await render(ChannelsView, { status: 'ready', channels: [], now: NOW });
		await expect.element(page.getByText('Keine Kanäle eingetragen.')).toBeVisible();
	});
});
