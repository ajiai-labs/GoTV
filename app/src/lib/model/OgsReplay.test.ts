import { getOgsSgfUrl, pickReplayGames, toReplayGame } from './OgsReplay';

function raw(id, black, white, started, extra = {}) {
	return {
		id,
		started,
		ended: '2026-11-22T20:00:00Z',
		annulled: false,
		outcome: 'Resignation',
		players: {
			black: {
				username: black
			},
			white: {
				username: white
			}
		},
		...extra
	};
}

describe('OGS replay games', () => {
	it('keeps finished games without their result', () => {
		const game = toReplayGame(raw(7, 'Surma', 'Ovsi', '2026-11-22T17:00:00Z'));
		expect(game).toEqual({
			id: 7,
			black: 'Surma',
			white: 'Ovsi',
			started: Date.parse('2026-11-22T17:00:00Z'),
			sgfUrl: 'https://online-go.com/api/v1/games/7/sgf'
		});
		expect(Object.keys(game)).not.toContain('outcome');
		expect(getOgsSgfUrl(5)).toBe('https://online-go.com/api/v1/games/5/sgf');
	});
	it('skips running, cancelled and annulled games', () => {
		expect(
			toReplayGame(
				raw(1, 'a', 'b', 'x', {
					ended: null
				})
			)
		).toBe(null);
		expect(
			toReplayGame(
				raw(2, 'a', 'b', 'x', {
					outcome: 'Cancellation'
				})
			)
		).toBe(null);
		expect(
			toReplayGame(
				raw(3, 'a', 'b', 'x', {
					annulled: true
				})
			)
		).toBe(null);
		expect(toReplayGame(null)).toBe(null);
		expect(
			toReplayGame({
				id: '4'
			})
		).toBe(null);
	});
	it('lists only games between the given players, in playing order', () => {
		const games = pickReplayGames(
			[
				raw(30, 'Surma', 'Ovsi', '2026-11-22T18:00:00Z'),
				raw(10, 'Ovsi', 'SURMA', '2026-11-22T17:00:00Z'),
				raw(20, 'Surma', 'Someone', '2026-11-22T17:30:00Z'),
				raw(5, 'Ovsi', 'Surma', '2026-11-22T16:50:00Z', {
					outcome: 'Cancellation',
					annulled: true
				})
			],
			['surma', 'Ovsi']
		);
		expect(games.map((game) => game.id)).toEqual([10, 30]);
		expect(pickReplayGames([raw(9, 'a', 'b', 'z')]).map((g) => g.id)).toEqual([9]);
	});
});
