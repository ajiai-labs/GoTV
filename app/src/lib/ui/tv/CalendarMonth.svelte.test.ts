import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CalendarMonth from './CalendarMonth.svelte';
import CalendarView from './CalendarView.svelte';
import { ogsTvSource } from '#lib/model/OgsTvSource.ts';
import type { TvEvent } from '#lib/model/tv.ts';

const NOW = new Date(2026, 10, 17, 12).getTime(); // 17 November 2026

function event(
	id: string,
	date_start: string,
	date_end?: string,
	extra: Partial<TvEvent> = {}
): TvEvent {
	return {
		id,
		name: id,
		date_start,
		date_end,
		platform: 'other',
		stream_url: 'https://example.org',
		...extra
	};
}

const EVENTS = [
	event('Kranich', '2026-11-21', '2026-11-22'),
	event('Speed Go', '2026-11-22', undefined, { platform: 'twitch' }),
	event('Dezember-Cup', '2026-12-05')
];

function day(key: string): HTMLElement {
	const cell = document.querySelector<HTMLElement>(`[data-day="${key}"]`);
	if (!cell) throw new Error('no day ' + key);
	return cell;
}

function barsOf(key: string): Array<HTMLElement> {
	return Array.from(day(key).querySelectorAll<HTMLElement>('.CalendarMonth-bar'));
}

beforeEach(() => {
	window.localStorage.clear();
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe('CalendarMonth', () => {
	it('shows the month with today marked and tournaments as bars', async () => {
		await render(CalendarMonth, { props: { events: EVENTS, now: NOW } });
		await expect.element(page.getByRole('heading', { name: 'November 2026' })).toBeVisible();
		expect(document.querySelectorAll('.CalendarMonth-day')).toHaveLength(42);
		expect(day('2026-11-17').getAttribute('aria-current')).toBe('date');
		expect(day('2026-11-21').textContent).toContain('Kranich');
		const sunday = barsOf('2026-11-22');
		expect(sunday).toHaveLength(2);
		// Kranich runs on from Saturday: no name again, but the same row.
		expect(sunday[0].classList.contains('CalendarMonth-bar-end')).toBe(true);
		expect(sunday[1].textContent?.trim()).toBe('Speed Go');
		expect(sunday[1].classList.contains('CalendarMonth-bar-video')).toBe(true);
		await expect.element(page.getByText('Keine Turniere an diesem Tag.')).toBeVisible();
		await expect.element(page.getByText('mit Stream', { exact: true })).toBeVisible();
		await expect.element(page.getByText('▶ Partien zum Nachspielen')).toBeVisible();
	});

	it('lists the tournaments of the day you click', async () => {
		await render(CalendarMonth, { props: { events: EVENTS, now: NOW } });
		day('2026-11-22').click();
		await expect
			.element(page.getByRole('heading', { name: 'Sonntag, 22. November 2026' }))
			.toBeVisible();
		expect(day('2026-11-22').getAttribute('aria-pressed')).toBe('true');
		const names = Array.from(document.querySelectorAll('.CalendarEvent-name')).map((node) =>
			node.textContent?.trim()
		);
		expect(names).toEqual(['Kranich', 'Speed Go']);
	});

	it('pages through the months and comes back with Heute', async () => {
		await render(CalendarMonth, { props: { events: EVENTS, now: NOW } });
		await page.getByRole('button', { name: 'Nächster Monat' }).click();
		await expect.element(page.getByRole('heading', { name: 'Dezember 2026' })).toBeVisible();
		expect(day('2026-12-05').textContent).toContain('Dezember-Cup');
		await page.getByRole('button', { name: 'Vorheriger Monat' }).click();
		await page.getByRole('button', { name: 'Vorheriger Monat' }).click();
		await expect.element(page.getByRole('heading', { name: 'Oktober 2026' })).toBeVisible();
		await page.getByRole('button', { name: 'Heute' }).click();
		await expect.element(page.getByRole('heading', { name: 'November 2026' })).toBeVisible();
	});

	it('marks tournaments with games and lists them when the day is picked', async () => {
		const fetchGames = vi.spyOn(ogsTvSource, 'fetchEventGames').mockResolvedValue([
			{
				id: 1,
				black: 'Ovsi',
				white: 'Surma',
				started: 0,
				sgfUrl: 'https://online-go.com/api/v1/games/1/sgf'
			}
		]);
		const onOpenReplay = vi.fn();
		const events = [
			event('Speed Go', '2026-11-15', undefined, {
				platform: 'twitch',
				ogs_players: ['Surma', 'Ovsi']
			}),
			event('Später', '2026-11-29', undefined, { ogs_players: ['a', 'b'] })
		];
		await render(CalendarMonth, { props: { events, now: NOW, onOpenReplay } });
		expect(barsOf('2026-11-15')[0].textContent?.trim()).toBe('▶ Speed Go');
		// Not begun yet: no games to replay, no marker.
		expect(barsOf('2026-11-29')[0].textContent?.trim()).toBe('Später');
		expect(fetchGames).not.toHaveBeenCalled();

		day('2026-11-15').click();
		const game = page.getByRole('button', { name: /G1/ });
		await expect.element(game).toBeVisible();
		expect(fetchGames).toHaveBeenCalledTimes(1);
		await game.click();
		expect(onOpenReplay).toHaveBeenCalledWith('https://online-go.com/api/v1/games/1/sgf');
	});

	it('says how many tournaments a full day hides', async () => {
		const many = ['a', 'b', 'c', 'd', 'e'].map((id) => event(id, '2026-11-20'));
		await render(CalendarMonth, { props: { events: many, now: NOW } });
		expect(barsOf('2026-11-20')).toHaveLength(3);
		expect(day('2026-11-20').querySelector('.CalendarMonth-more')?.textContent).toBe('+2 weitere');
	});

	it('stars favourite tournaments and toggles the star on the card', async () => {
		const onToggleFavorite = vi.fn();
		await render(CalendarMonth, {
			props: {
				events: EVENTS,
				now: NOW,
				favoriteEventIds: ['Speed Go'],
				onToggleFavorite
			}
		});
		expect(barsOf('2026-11-22')[1].textContent?.trim()).toBe('★ Speed Go');
		day('2026-11-22').click();
		await page.getByRole('button', { name: 'Kranich zu Mein GoTV hinzufügen' }).click();
		expect(onToggleFavorite).toHaveBeenCalledWith('Kranich');
		await expect
			.element(page.getByRole('button', { name: 'Speed Go aus Mein GoTV entfernen' }))
			.toBeVisible();
	});
});

describe('CalendarView', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(NOW);
	});

	it('opens as a month sheet and remembers a switch to the list', async () => {
		const first = await render(CalendarView, { props: { events: EVENTS } });
		await expect.element(page.getByRole('heading', { name: 'November 2026' })).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Monat' }))
			.toHaveAttribute('aria-pressed', 'true');

		await page.getByRole('button', { name: 'Liste' }).click();
		expect(document.querySelector('.CalendarMonth')).toBeNull();
		expect(window.localStorage.getItem('gotv.calendarView')).toBe('list');
		await first.unmount();

		await render(CalendarView, { props: { events: EVENTS } });
		await expect
			.element(page.getByRole('button', { name: 'Liste' }))
			.toHaveAttribute('aria-pressed', 'true');
		expect(document.querySelector('.CalendarMonth')).toBeNull();
	});

	it('groups the list by region and keeps the archive apart', async () => {
		window.localStorage.setItem('gotv.calendarView', 'list');
		const events = [
			event('Kranich', '2026-11-21', '2026-11-22', { region: 'de' }),
			event('Korea Cup', '2026-11-25', undefined, { region: 'intl' }),
			// Over 14 days ago, kept for its recording.
			event('Altes Finale', '2026-10-01', undefined, {
				region: 'intl',
				video_id: 'abcdefghijk'
			}),
			// Invalid entry: skipped.
			{ id: 'kaputt' } as unknown as TvEvent
		];
		await render(CalendarView, { props: { events } });
		await expect.element(page.getByRole('heading', { name: 'Deutschland' })).toBeVisible();
		const titles = Array.from(document.querySelectorAll('.CalendarView-group-title')).map((node) =>
			node.textContent?.trim()
		);
		expect(titles).toEqual(['Deutschland', 'International', 'Archiv · International']);
		const international = page.getByRole('region', { name: 'International', exact: true });
		await expect.element(international.getByText('Korea Cup')).toBeVisible();
		await expect
			.element(
				page.getByRole('region', { name: 'Archiv · International' }).getByText('Altes Finale')
			)
			.toBeVisible();
	});

	it('says when the calendar is empty', async () => {
		window.localStorage.setItem('gotv.calendarView', 'list');
		await render(CalendarView, { props: { events: [] } });
		await expect.element(page.getByText('Keine Events im Kalender.')).toBeVisible();
	});
});
