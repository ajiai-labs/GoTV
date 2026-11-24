import {
	getFollowedGames,
	isFollowed,
	loadFollowedPlayers,
	mergeFollowed,
	saveFollowedPlayers,
	toggleFollowed
} from './FollowedPlayers';
import type { GameChannel } from './types';

function game(id: number, black: string, white: string, extra: Partial<GameChannel> = {}) {
	return {
		id,
		type: 'ranked',
		players: { black: { name: black, rank: '1d' }, white: { name: white, rank: '2d' } },
		...extra
	} as GameChannel;
}

describe('FollowedPlayers', () => {
	beforeEach(() => localStorage.clear());

	it('follows and unfollows players, names case-insensitive', () => {
		let names = toggleFollowed([], 'Arndt');
		expect(isFollowed(names, 'arndt')).toBe(true);
		names = toggleFollowed(names, 'ARNDT');
		expect(names).toEqual([]);
	});

	it('remembers the list in this browser and survives broken entries', () => {
		saveFollowedPlayers(['arndt', 'sandora']);
		expect(loadFollowedPlayers()).toEqual(['arndt', 'sandora']);
		localStorage.setItem('gotv.followedPlayers', '{kaputt');
		expect(loadFollowedPlayers()).toEqual([]);
	});

	it('finds running games of followed players with the opponent', () => {
		const games = [
			game(1, 'arndt', 'jirik'),
			game(2, 'a', 'b'),
			game(3, 'Sandora', 'x', { over: true }),
			game(4, 'pem', 'sandora', { type: 'challenge' } as Partial<GameChannel>)
		];
		const found = getFollowedGames(games, ['ARNDT', 'sandora']);
		expect(found).toHaveLength(1);
		expect(found[0]).toMatchObject({ name: 'arndt', opponent: { name: 'jirik' } });
		expect(found[0].game.id).toBe(1);
	});

	it('merges two lists without duplicates', () => {
		expect(mergeFollowed(['arndt', 'pem'], ['PEM', 'jirik', 3])).toEqual(['arndt', 'pem', 'jirik']);
	});
});
