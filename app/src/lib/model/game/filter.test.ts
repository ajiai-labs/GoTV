import { describe, expect, it } from 'vitest';
import { filterGames, hasKnownSpeed } from './filter';
import type { GameChannel, GameRules, Index, Room, User } from '../types';

const user = (name: string, rankVal: number, robot = false): User =>
	({ name, rank: '', rankVal, flags: robot ? { robot: true } : {} }) as User;

function game(id: number, extra: Partial<GameChannel> & { rules?: GameRules } = {}): GameChannel {
	return {
		id,
		type: 'ranked',
		roomId: 1,
		moveNum: 100,
		players: { white: user('w' + id, 1), black: user('b' + id, 0) },
		rules: { size: 19, komi: 6.5 },
		...extra
	} as GameChannel;
}

const rooms = {
	1: { id: 1, name: 'English Game Room' },
	2: { id: 2, name: 'Deutsche Ecke' }
} as unknown as Index<Room>;
const ids = (games: Array<GameChannel>) => games.map((g) => g.id);

describe('game list filter', () => {
	const games = [
		game(1, { rules: { size: 9, komi: 6.5 }, moveNum: 12, observers: 3 }),
		game(2, {
			type: 'tournament',
			roomId: 2,
			moveNum: 150,
			observers: 40,
			players: { white: user('Lukan', 7), black: user('anna', 5) }
		}),
		game(3, {
			event: true,
			moveNum: 5,
			rules: {
				size: 19,
				komi: 6.5,
				timeSystem: 'byo_yomi',
				mainTime: 60,
				byoYomiTime: 20,
				byoYomiPeriods: 1
			}
		}),
		game(4, { players: { white: user('GnuBot', 3, true), black: user('bert', -2) }, observers: 1 }),
		game(5, { rules: { size: 13, komi: 0.5, handicap: 2 } })
	];

	it('filters by board size, tournaments, bots and pace', () => {
		expect(ids(filterGames(games, { size: 9 }))).toEqual([1]);
		expect(ids(filterGames(games, { size: 13 }))).toEqual([5]);
		expect(ids(filterGames(games, { tournamentOnly: true }))).toEqual([2, 3]);
		expect(ids(filterGames(games, { excludeBots: true }))).toEqual([1, 2, 3, 5]);
		// Only games with a known time system have a pace.
		expect(ids(filterGames(games, { speed: 'veryFast' }))).toEqual([3]);
		expect(hasKnownSpeed(games)).toBe(true);
		expect(hasKnownSpeed([game(9)])).toBe(false);
	});

	it('finds players, rooms and game names in any case', () => {
		expect(ids(filterGames(games, { query: 'luk' }))).toEqual([2]);
		expect(ids(filterGames(games, { query: 'deutsche' }, rooms))).toEqual([2]);
		expect(ids(filterGames(games, { query: '  GNU ' }))).toEqual([4]);
	});

	it('sorts by strength, observers or fewest moves', () => {
		expect(ids(filterGames(games, { sort: 'strength' })).slice(0, 2)).toEqual([2, 4]);
		expect(ids(filterGames(games, { sort: 'observers' })).slice(0, 2)).toEqual([2, 1]);
		expect(ids(filterGames(games, { sort: 'new' })).slice(0, 2)).toEqual([3, 1]);
		// Without a sort the KGS order stays.
		expect(ids(filterGames(games, {}))).toEqual([1, 2, 3, 4, 5]);
	});
});
