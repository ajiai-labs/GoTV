import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CalendarEventCard from './CalendarEventCard.svelte';
import type { TvEvent } from '#lib/model/tv.ts';

const NOW = new Date(2026, 10, 22, 18, 30).getTime();

const SPEED_GO: TvEvent = {
	id: 'speedgo',
	name: 'Speed Go: Surma gegen Ovsiienko',
	date_start: '2026-11-22',
	start: new Date(2026, 10, 22, 18).toISOString(),
	duration_minutes: 180,
	platform: 'twitch',
	stream_url: 'https://www.twitch.tv/europeangofederation',
	channel: { platform: 'twitch', id: 'europeangofederation' },
	notes: 'Finale der Saison',
	ogs_players: ['mateusz.surma1995', 'OvsiienkoVsevolod']
};

describe('CalendarEventCard', () => {
	it('shows name, badge, notes and board status', async () => {
		await render(CalendarEventCard, { event: SPEED_GO, now: NOW });
		await expect
			.element(page.getByRole('heading', { name: 'Speed Go: Surma gegen Ovsiienko' }))
			.toBeVisible();
		await expect.element(page.getByText('Twitch', { exact: true })).toBeVisible();
		await expect.element(page.getByText('Finale der Saison')).toBeVisible();
		await expect.element(page.getByText('OGS-Zuordnung hinterlegt', { exact: true })).toBeVisible();
		// Without a star handler there is no star.
		expect(document.querySelector('.FavoriteStar')).toBeNull();
	});

	it('loads the stream only after a click and offers the chat in the live window', async () => {
		const onStreamLoad = vi.fn();
		await render(CalendarEventCard, { event: SPEED_GO, now: NOW, onStreamLoad });
		expect(document.querySelector('iframe')).toBeNull();
		await expect.element(page.getByRole('button', { name: 'Twitch-Chat anzeigen' })).toBeVisible();

		await page.getByRole('button', { name: 'Stream laden' }).click();
		expect(onStreamLoad).toHaveBeenCalledTimes(1);
		const frame = page.getByTitle('Speed Go: Surma gegen Ovsiienko', { exact: true });
		await expect.element(frame).toBeInTheDocument();
		expect(frame.element().getAttribute('src')).toContain('player.twitch.tv');
	});

	it('has no chat outside the live window and no player with showVideo false', async () => {
		const view = await render(CalendarEventCard, {
			event: SPEED_GO,
			now: new Date(2026, 10, 1).getTime()
		});
		await expect.element(page.getByRole('button', { name: 'Stream laden' })).toBeVisible();
		expect(document.querySelector('.StreamChat')).toBeNull();
		await view.rerender({ now: NOW, showVideo: false });
		await expect
			.element(page.getByRole('button', { name: 'Stream laden' }))
			.not.toBeInTheDocument();
		expect(document.querySelector('.StreamChat')).toBeNull();
	});

	it('counts linked boards', async () => {
		await render(CalendarEventCard, {
			event: SPEED_GO,
			now: NOW,
			boardCount: 1,
			ogsBoardCount: 2
		});
		await expect
			.element(page.getByText('Stream + 3 Bretter (KGS + OGS) · Live-Züge und Partiechat'))
			.toBeVisible();
	});

	it('toggles the star and opens a recorded SGF', async () => {
		const onToggleFavorite = vi.fn();
		const onOpenReplay = vi.fn();
		await render(CalendarEventCard, {
			event: { ...SPEED_GO, ogs_players: undefined, sgf_url: 'https://example.org/a.sgf' },
			now: NOW,
			favorite: true,
			onToggleFavorite,
			onOpenReplay
		});
		await page
			.getByRole('button', { name: 'Speed Go: Surma gegen Ovsiienko aus Mein GoTV entfernen' })
			.click();
		expect(onToggleFavorite).toHaveBeenCalledWith('speedgo');
		await expect.element(page.getByText('SGF-Brett zum Nachspielen verfügbar')).toBeVisible();
		await page.getByRole('button', { name: 'SGF nachspielen' }).click();
		expect(onOpenReplay).toHaveBeenCalledWith('https://example.org/a.sgf');
	});
});
