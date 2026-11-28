import { describe, expect, it } from 'vitest';
import { parseFlatRules, parseGameChannel } from './parse';

// A game list entry as KGS sends it: the rules are fields of the channel.
const ENTRY = {
	channelId: 7,
	gameType: 'ranked',
	roomId: 1,
	moveNum: 12,
	size: 13,
	komi: 0,
	handicap: 2,
	players: { white: { name: 'anna', rank: '2d' }, black: { name: 'bert', rank: '1k' } }
};

describe('rules of a game list entry', () => {
	it('keeps size and handicap with komi 0 (they used to be dropped)', () => {
		const game = parseGameChannel(null, ENTRY);
		expect(game.rules).toEqual({ size: 13, komi: 0, handicap: 2 });
	});

	it('takes the time system and the rule set, if KGS sends them', () => {
		const rules = parseFlatRules({
			...ENTRY,
			rules: 'chinese',
			timeSystem: 'byo_yomi',
			mainTime: 1800,
			byoYomiTime: 30,
			byoYomiPeriods: 5
		});
		expect(rules).toEqual({
			size: 13,
			komi: 0,
			handicap: 2,
			rules: 'chinese',
			timeSystem: 'byo_yomi',
			mainTime: 1800,
			byoYomiTime: 30,
			byoYomiPeriods: 5
		});
		// The rule set as text never replaces the rules object.
		const game = parseGameChannel(null, { ...ENTRY, rules: 'chinese', timeSystem: 'absolute' });
		expect(game.rules).toMatchObject({ size: 13, rules: 'chinese', timeSystem: 'absolute' });
	});

	it('keeps the time of a joined game when the list sends the entry again', () => {
		const joined = parseGameChannel(null, ENTRY);
		joined.rules = { ...joined.rules!, timeSystem: 'byo_yomi', mainTime: 600 };
		const again = parseGameChannel(joined, { ...ENTRY, moveNum: 13 });
		expect(again.rules).toMatchObject({ size: 13, timeSystem: 'byo_yomi', mainTime: 600 });
	});

	it('leaves entries without rules alone', () => {
		expect(parseFlatRules({ channelId: 1, gameType: 'challenge' })).toBeNull();
	});
});
