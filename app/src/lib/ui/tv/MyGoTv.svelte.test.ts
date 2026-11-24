import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { validateTvChannel, validateTvEvent } from '#lib/model/tv.ts';
import type { TvChannel, TvEvent } from '#lib/model/tv.ts';
import type { TvFavorites } from '#lib/model/TvFavorites.ts';
import MyGoTv from './MyGoTv.svelte';

const JUPP = validateTvChannel({
	id: 'jupptube',
	name: 'JuppTube',
	platform: 'youtube',
	url: 'https://www.youtube.com/@JuppTube',
	channel_id: 'UCtIzNu7cS3h9DqOckBXU5wg',
	kind: 'player',
	schedule: [{ weekday: 7, time: '10:30', duration_minutes: 150 }]
}) as TvChannel;

const SPEED_GO = validateTvEvent({
	id: 'speed-go',
	name: 'Speed Go',
	date_start: '2026-11-29',
	start: '2026-11-29T18:00:00+01:00',
	platform: 'twitch',
	stream_url: 'https://www.twitch.tv/europeangofederation'
}) as TvEvent;

// Sunday 29.11.2026, 11:00 in Germany: JuppTube is on air.
const NOW = new Date('2026-11-29T10:00:00Z').getTime();

function renderMyGoTv(favorites: TvFavorites, notificationPermission: string | null = 'default') {
	const onToggleReminders = vi.fn();
	// "events" is also a render option: the props go in explicitly.
	return render(MyGoTv, {
		props: {
			favorites,
			channels: [JUPP],
			events: [SPEED_GO],
			now: NOW,
			remindersEnabled: false,
			notificationPermission,
			onToggleReminders
		}
	}).then(() => onToggleReminders);
}

describe('MyGoTv', () => {
	it('lists starred channels and tournaments, the running one first', async () => {
		const onToggleReminders = await renderMyGoTv({
			channels: ['jupptube'],
			events: ['speed-go']
		});
		const rows = document.querySelectorAll('.MyGoTv-item');
		expect(rows).toHaveLength(2);
		expect(rows[0].textContent).toContain('JuppTube');
		expect(rows[0].textContent).toContain('läuft gerade (geplant)');
		expect(rows[1].textContent).toContain('Speed Go');
		expect(rows[1].textContent).toContain('Turnier');
		expect(rows[0].getAttribute('href')).toMatch(/\/kanaele$/);
		expect(rows[1].getAttribute('href')).toMatch(/\/kalender$/);
		await page.getByRole('checkbox', { name: /10 Min. vorher erinnern/ }).click();
		expect(onToggleReminders).toHaveBeenCalled();
	});

	it('explains the stars while nothing is starred', async () => {
		await renderMyGoTv({ channels: [], events: [] });
		await expect.element(page.getByText(/Markiere Kanäle und Turniere/)).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Zu den Kanälen' })).toBeVisible();
		expect(document.querySelector('input[type="checkbox"]')).toBeNull();
	});

	it('says when the browser blocks reminders and hides the switch without notifications', async () => {
		await renderMyGoTv({ channels: ['jupptube'], events: [] }, 'denied');
		await expect.element(page.getByText('Erinnerungen sind im Browser blockiert')).toBeVisible();
		expect(document.querySelector('input[type="checkbox"]')).toBeNull();
	});
});
