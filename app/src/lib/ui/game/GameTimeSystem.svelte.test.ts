import { describe, expect, it } from 'vitest';
import { language } from '#lib/i18n/index.svelte.ts';
import { formatDurationDe, formatTimeSystemDe } from './GameTimeSystem.svelte';

describe('time system in words', () => {
	it('says durations as people do', () => {
		expect(formatDurationDe(30)).toBe('30 Sek.');
		expect(formatDurationDe(600)).toBe('10 Min.');
		expect(formatDurationDe(90)).toBe('1:30 Min.');
		expect(formatDurationDe(3600)).toBe('1 Std.');
	});

	it('writes every KGS time system readably', () => {
		const base = { size: 19, komi: 6.5 };
		expect(
			formatTimeSystemDe({
				...base,
				timeSystem: 'byo_yomi',
				mainTime: 1800,
				byoYomiTime: 30,
				byoYomiPeriods: 5
			})
		).toBe('30 Min. + 5×30 Sek.');
		expect(
			formatTimeSystemDe({
				...base,
				timeSystem: 'byo_yomi',
				mainTime: 0,
				byoYomiTime: 20,
				byoYomiPeriods: 1
			})
		).toBe('1×20 Sek.');
		expect(formatTimeSystemDe({ ...base, timeSystem: 'absolute', mainTime: 1200 })).toBe(
			'20 Min. absolut'
		);
		expect(
			formatTimeSystemDe({
				...base,
				timeSystem: 'canadian',
				mainTime: 600,
				byoYomiTime: 300,
				byoYomiStones: 25
			})
		).toBe('10 Min. + 25 Steine in 5 Min.');
		expect(formatTimeSystemDe({ ...base, timeSystem: 'none' })).toBe('Ohne Zeitlimit');
		language.current = 'en';
		expect(
			formatTimeSystemDe({
				...base,
				timeSystem: 'byo_yomi',
				mainTime: 1800,
				byoYomiTime: 30,
				byoYomiPeriods: 5
			})
		).toBe('30 min + 5×30 s');
		language.current = 'de';
	});
});
