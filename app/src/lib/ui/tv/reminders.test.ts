import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateTvEvent } from '#lib/model/tv.ts';
import type { TvEvent } from '#lib/model/tv.ts';
import { checkReminders } from './reminders.ts';

const EVENT = validateTvEvent({
	id: 'speed-go',
	name: 'Speed Go',
	date_start: '2026-11-29',
	start: '2026-11-29T18:00:00+01:00',
	platform: 'twitch',
	stream_url: 'https://www.twitch.tv/europeangofederation'
}) as TvEvent;

// 5 minutes before the start.
const NOW = new Date('2026-11-29T16:55:00Z');

describe('checkReminders', () => {
	let shown: Array<{ title: string; options: NotificationOptions }>;

	beforeEach(() => {
		window.localStorage.clear();
		shown = [];
		class FakeNotification {
			static permission = 'granted';
			constructor(title: string, options: NotificationOptions) {
				shown.push({ title, options });
			}
		}
		vi.stubGlobal('Notification', FakeNotification);
		window.localStorage.setItem(
			'gotv.favorites',
			JSON.stringify({ channels: [], events: ['speed-go'] })
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		window.localStorage.clear();
	});

	it('does nothing while reminders are off', () => {
		expect(checkReminders([], [EVENT], NOW)).toEqual([]);
		expect(shown).toEqual([]);
	});

	it('announces a starred tournament 10 minutes before, once', () => {
		window.localStorage.setItem('gotv.reminders', '1');
		expect(checkReminders([], [EVENT], NOW)).toHaveLength(1);
		expect(shown).toHaveLength(1);
		expect(shown[0].title).toBe('GoTV: Speed Go');
		expect(shown[0].options.body).toMatch(/^Beginnt um \d\d:\d\d Uhr$/);
		expect(JSON.parse(window.localStorage.getItem('gotv.notified') ?? '[]')).toHaveLength(1);
		expect(checkReminders([], [EVENT], NOW)).toEqual([]);
		expect(shown).toHaveLength(1);
	});
});
