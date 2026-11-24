import {
	formatChannelSchedule,
	getChannelKind,
	getChannelsOnAir,
	getGermanClock,
	getNextAirTime,
	groupChannels,
	isChannelOnAir,
	validateChannelSchedule
} from './tvChannels';
import { validateTvChannel } from './tv';
const BASE = {
	id: 'jupptube-youtube',
	name: 'JuppTube',
	platform: 'youtube',
	url: 'https://www.youtube.com/@JuppTube',
	channel_id: 'UCtIzNu7cS3h9DqOckBXU5wg'
};
const SUNDAY_MORNING = {
	...BASE,
	kind: 'player',
	schedule: [
		{
			weekday: 7,
			time: '10:30',
			duration_minutes: 150
		}
	]
};
describe('validateChannelSchedule', () => {
	it('accepts weekly slots and fills in the default length', () => {
		expect(
			validateChannelSchedule([
				{
					weekday: 7,
					time: '10:30',
					duration_minutes: 150
				},
				{
					weekday: 5,
					time: '15:45'
				}
			])
		).toEqual([
			{
				weekday: 7,
				time: '10:30',
				duration_minutes: 150
			},
			{
				weekday: 5,
				time: '15:45',
				duration_minutes: 120
			}
		]);
	});
	it('treats a missing schedule as no fixed air times', () => {
		expect(validateChannelSchedule(undefined)).toEqual([]);
		expect(validateChannelSchedule(null)).toEqual([]);
	});
	it('rejects malformed slots', () => {
		expect(validateChannelSchedule('sonntags')).toBe(null);
		expect(
			validateChannelSchedule([
				{
					weekday: 0,
					time: '10:30'
				}
			])
		).toBe(null);
		expect(
			validateChannelSchedule([
				{
					weekday: 7,
					time: '25:00'
				}
			])
		).toBe(null);
		expect(
			validateChannelSchedule([
				{
					weekday: 7,
					time: '9:30'
				}
			])
		).toBe(null);
		expect(
			validateChannelSchedule([
				{
					weekday: 7,
					time: '10:30',
					duration_minutes: -5
				}
			])
		).toBe(null);
	});
});
describe('validateTvChannel with kind and schedule', () => {
	it('keeps kind and schedule', () => {
		const channel = validateTvChannel(SUNDAY_MORNING);
		expect(channel.kind).toBe('player');
		expect(channel.schedule).toEqual(SUNDAY_MORNING.schedule);
	});
	it('leaves both out when the entry has none', () => {
		const channel = validateTvChannel(BASE);
		expect(channel.kind).toBe(undefined);
		expect(channel.schedule).toBe(undefined);
		expect(getChannelKind(channel)).toBe('organization');
	});
	it('skips a channel with an unknown kind or a broken schedule', () => {
		expect(validateTvChannel({ ...BASE, kind: 'streamer' })).toBe(null);
		expect(
			validateTvChannel({
				...BASE,
				schedule: [
					{
						weekday: 9
					}
				]
			})
		).toBe(null);
	});
});
describe('getGermanClock', () => {
	it('reads weekday and minute in German time (winter and summer)', () => {
		// Sunday 22.11.2026, 09:30 UTC = 10:30 CET.
		expect(getGermanClock(new Date('2026-11-22T09:30:00Z'))).toEqual({
			weekday: 7,
			minute: 630
		});
		// Sunday 05.07.2026, 08:30 UTC = 10:30 CEST.
		expect(getGermanClock(new Date('2026-07-05T08:30:00Z'))).toEqual({
			weekday: 7,
			minute: 630
		});
	});
});
describe('isChannelOnAir', () => {
	const channel = validateTvChannel(SUNDAY_MORNING);
	it("is on air from the start for the slot's length", () => {
		expect(isChannelOnAir(channel, new Date('2026-11-22T09:29:00Z'))).toBe(false);
		expect(isChannelOnAir(channel, new Date('2026-11-22T09:30:00Z'))).toBe(true);
		expect(isChannelOnAir(channel, new Date('2026-11-22T11:59:00Z'))).toBe(true);
		expect(isChannelOnAir(channel, new Date('2026-11-22T12:00:00Z'))).toBe(false);
	});
	it('is never on air on another weekday or without a schedule', () => {
		expect(isChannelOnAir(channel, new Date('2026-11-21T09:30:00Z'))).toBe(false);
		expect(isChannelOnAir(validateTvChannel(BASE), new Date('2026-11-22T09:30:00Z'))).toBe(false);
	});
	it('carries a slot past midnight into the next day', () => {
		const late = validateTvChannel({
			...BASE,
			schedule: [
				{
					weekday: 7,
					time: '23:00',
					duration_minutes: 120
				}
			]
		});
		// Monday 23.11.2026, 00:30 CET.
		expect(isChannelOnAir(late, new Date('2026-11-22T23:30:00Z'))).toBe(true);
		// Monday 23.11.2026, 01:00 CET - over.
		expect(isChannelOnAir(late, new Date('2026-11-23T00:00:00Z'))).toBe(false);
	});
});
describe('formatChannelSchedule', () => {
	it('lists the air times by weekday', () => {
		const channel = validateTvChannel({
			...BASE,
			schedule: [
				{
					weekday: 7,
					time: '10:30'
				},
				{
					weekday: 5,
					time: '15:45'
				}
			]
		});
		expect(formatChannelSchedule(channel)).toBe('freitags 15:45 Uhr · sonntags 10:30 Uhr');
		expect(formatChannelSchedule(validateTvChannel(BASE))).toBe(null);
	});
});
describe('groupChannels', () => {
	it('separates players from federations and puts channels on air first', () => {
		const egf = validateTvChannel({ ...BASE, id: 'egf', name: 'EGF' });
		const dojang = validateTvChannel({ ...BASE, id: 'dojang', name: 'Dojang', kind: 'player' });
		const jupp = validateTvChannel(SUNDAY_MORNING);
		const now = new Date('2026-11-22T10:00:00Z');
		const groups = groupChannels([egf, dojang, jupp], now);
		expect(groups.player.map((c) => c.id)).toEqual(['jupptube-youtube', 'dojang']);
		expect(groups.organization.map((c) => c.id)).toEqual(['egf']);
		expect(getChannelsOnAir([egf, dojang, jupp], now).map((c) => c.id)).toEqual([
			'jupptube-youtube'
		]);
	});
});
describe('getNextAirTime', () => {
	const channel = validateTvChannel(SUNDAY_MORNING);
	it('returns the running air time', () => {
		const next = getNextAirTime(channel, new Date('2026-11-22T10:00:00Z'));
		expect(next.start.toISOString()).toBe('2026-11-22T09:30:00.000Z');
		expect(next.end.toISOString()).toBe('2026-11-22T12:00:00.000Z');
	});
	it("returns next week's air time once this one is over", () => {
		const next = getNextAirTime(channel, new Date('2026-11-22T12:00:00Z'));
		expect(next.start.toISOString()).toBe('2026-11-29T09:30:00.000Z');
	});
	it('follows German summer time', () => {
		// Saturday 28.03.2026; summer time starts on Sunday 29.03.
		const next = getNextAirTime(channel, new Date('2026-03-28T12:00:00Z'));
		expect(next.start.toISOString()).toBe('2026-03-29T08:30:00.000Z');
	});
	it('has no air time without a schedule', () => {
		expect(getNextAirTime(validateTvChannel(BASE), new Date('2026-11-22T10:00:00Z'))).toBe(null);
	});
});
