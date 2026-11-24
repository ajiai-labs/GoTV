import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { TvEvent } from '#lib/model/tv.ts';
import { saveReplayMove, addReplayBookmark } from '#lib/model/ReplayProgress.ts';
import RecentReplays from './RecentReplays.svelte';
import * as recentModule from './RecentReplays.svelte';

// The helper lives in the component's module script (as in the old app).
const { getRecentReplayEvents } = recentModule as unknown as {
	getRecentReplayEvents: (events: Array<TvEvent>, now: number) => Array<TvEvent>;
};
import RecentlyReplayed from './RecentlyReplayed.svelte';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-24T12:00:00Z');

const sgfEvent: TvEvent = {
	id: 'finale',
	name: 'Finale mit SGF',
	date_start: '2026-11-20',
	platform: 'other',
	stream_url: 'https://example.org/finale',
	sgf_url: 'https://example.org/finale.sgf'
};
const ogsEvent: TvEvent = {
	id: 'speedgo',
	name: 'Speed Go',
	date_start: '2026-11-22',
	platform: 'twitch',
	stream_url: 'https://www.twitch.tv/europeangofederation',
	ogs_game_ids: [1, 2]
};
const oldEvent: TvEvent = {
	...sgfEvent,
	id: 'alt',
	name: 'Altes Turnier',
	date_start: '2026-01-02'
};
const futureEvent: TvEvent = {
	...sgfEvent,
	id: 'bald',
	name: 'Kommt noch',
	date_start: '2026-12-20'
};

describe('RecentReplays', () => {
	it('lists tournaments of the last months, newest first', () => {
		expect(
			getRecentReplayEvents([sgfEvent, oldEvent, futureEvent, ogsEvent], NOW).map((e) => e.id)
		).toEqual(['speedgo', 'finale']);
	});

	it('opens a recorded SGF and offers the OGS games', async () => {
		const onOpenReplay = vi.fn();
		await render(RecentReplays, {
			props: { events: [sgfEvent, ogsEvent], now: NOW, onOpenReplay }
		});
		await expect
			.element(page.getByRole('heading', { name: 'Turnierpartien der letzten 3 Monate' }))
			.toBeVisible();
		await expect.element(page.getByText('Speed Go', { exact: true })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Partien nachspielen' })).toBeVisible();
		await page.getByRole('button', { name: 'SGF nachspielen' }).click();
		expect(onOpenReplay).toHaveBeenCalledWith('https://example.org/finale.sgf');
	});

	it('says so when there is nothing to replay', async () => {
		await render(RecentReplays, { props: { events: [oldEvent], now: NOW, onOpenReplay: vi.fn() } });
		await expect
			.element(page.getByText('Keine Turnierpartien aus den letzten Monaten.'))
			.toBeVisible();
	});

	it('under Live shows only tournaments that just ended, or nothing', async () => {
		const { container } = await render(RecentReplays, {
			props: {
				events: [sgfEvent],
				now: NOW,
				onOpenReplay: vi.fn(),
				justEnded: true
			}
		});
		expect(container.textContent?.trim()).toBe('');
	});

	it('lists a tournament that ended within the last day under Live', async () => {
		const ended: TvEvent = { ...sgfEvent, date_start: '2026-11-23' };
		await render(RecentReplays, {
			props: {
				events: [ended],
				now: Date.parse('2026-11-24T06:00:00Z') + DAY / 4,
				onOpenReplay: vi.fn(),
				justEnded: true
			}
		});
		await expect
			.element(page.getByRole('heading', { name: 'Gerade zu Ende – Partien nachspielen' }))
			.toBeVisible();
	});
});

describe('RecentlyReplayed', () => {
	afterEach(() => window.localStorage.clear());

	it('shows nothing without remembered games', async () => {
		window.localStorage.clear();
		const { container } = await render(RecentlyReplayed, { onOpenReplay: vi.fn() });
		expect(container.textContent?.trim()).toBe('');
	});

	it('reopens a game where it was left', async () => {
		window.localStorage.clear();
		saveReplayMove('url:https://example.org/a.sgf', 42, 'Ann – Bob', 'https://example.org/a.sgf');
		addReplayBookmark('url:https://example.org/a.sgf', 40, 'hier');
		const onOpenReplay = vi.fn();
		await render(RecentlyReplayed, { onOpenReplay });
		const item = page.getByRole('button', { name: /Ann – Bob/ });
		await expect.element(item.getByText('weiter bei Zug 42 · 1 Lesezeichen')).toBeVisible();
		await item.click();
		expect(onOpenReplay).toHaveBeenCalledWith('https://example.org/a.sgf');
	});
});
