import { getDueReminders, getMyGoTvItems, getReminderKey } from './MyGoTv';
import { validateTvChannel, validateTvEvent } from './tv';
const JUPP = validateTvChannel({
	id: 'jupptube',
	name: 'JuppTube',
	platform: 'youtube',
	url: 'https://www.youtube.com/@JuppTube',
	channel_id: 'UCtIzNu7cS3h9DqOckBXU5wg',
	kind: 'player',
	schedule: [
		{
			weekday: 7,
			time: '10:30',
			duration_minutes: 150
		}
	]
});
const EGF = validateTvChannel({
	id: 'egf',
	name: 'EGF',
	platform: 'twitch',
	url: 'https://www.twitch.tv/europeangofederation',
	channel_id: 'europeangofederation'
});
const SPEED_GO = validateTvEvent({
	id: 'speed-go',
	name: 'Speed Go',
	date_start: '2026-11-29',
	start: '2026-11-29T18:00:00+01:00',
	platform: 'twitch',
	stream_url: 'https://www.twitch.tv/europeangofederation'
});
const OVER = validateTvEvent({
	id: 'over',
	name: 'Vorbei',
	date_start: '2026-11-01',
	start: '2026-11-01T18:00:00+01:00',
	platform: 'twitch',
	stream_url: 'https://www.twitch.tv/europeangofederation'
});
const ALL = {
	channels: ['jupptube', 'egf'],
	events: ['speed-go', 'over']
};
describe('getMyGoTvItems', () => {
	it('puts what runs first, then the next start, then unknown times', () => {
		// Sunday 29.11.2026, 11:00 German time: JuppTube is on air.
		const items = getMyGoTvItems(
			ALL,
			[EGF, JUPP],
			[SPEED_GO, OVER],
			new Date('2026-11-29T10:00:00Z')
		);
		expect(items.map((item) => [item.id, item.status, item.planned])).toEqual([
			['jupptube', 'now', true],
			['speed-go', 'next', false],
			['egf', 'none', true]
		]);
	});
	it('only lists starred entries', () => {
		const items = getMyGoTvItems(
			{
				channels: ['egf'],
				events: []
			},
			[EGF, JUPP],
			[SPEED_GO],
			new Date('2026-11-29T10:00:00Z')
		);
		expect(items.map((item) => item.id)).toEqual(['egf']);
	});
});
describe('getDueReminders', () => {
	const items = (now) => getMyGoTvItems(ALL, [JUPP], [SPEED_GO], now);

	it('reminds ten minutes before a start, once', () => {
		// Sunday 29.11.2026, 10:25 German time.
		const now = new Date('2026-11-29T09:25:00Z');
		const due = getDueReminders(items(now), now, []);
		expect(due.map((item) => item.id)).toEqual(['jupptube']);
		expect(getDueReminders(items(now), now, [getReminderKey(due[0])])).toEqual([]);
	});
	it('stays quiet earlier', () => {
		const now = new Date('2026-11-29T09:00:00Z');
		expect(getDueReminders(items(now), now, [])).toEqual([]);
	});
	it('reminds before a tournament with a start time', () => {
		const now = new Date('2026-11-29T16:52:00Z'); // 17:52 German time

		expect(getDueReminders(items(now), now, []).map((item) => item.id)).toEqual(['speed-go']);
	});
});
describe('getDueReminders for whole-day tournaments', () => {
	it('gives a tournament without a start time no reminder', () => {
		const allDay = validateTvEvent({
			id: 'kranich',
			name: 'Kranich',
			date_start: '2026-11-28',
			date_end: '2026-11-29',
			platform: 'other',
			stream_url: 'https://example.org'
		});
		const now = new Date('2026-11-27T22:55:00Z');
		const items = getMyGoTvItems(
			{
				channels: [],
				events: ['kranich']
			},
			[],
			[allDay],
			now
		);
		expect(items[0].timed).toBe(false);
		expect(getDueReminders(items, now, [])).toEqual([]);
	});
});
