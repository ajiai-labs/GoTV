import { KgsTvSource, IgsTvSource } from './TvSource';
describe('KgsTvSource', () => {
	const source = new KgsTvSource();
	it('delegates getLiveGames to the event-game filter', () => {
		const games = [
			{
				id: 1,
				type: 'ranked',
				over: false,
				event: true,
				players: {
					black: {
						name: 'a'
					},
					white: {
						name: 'b'
					}
				}
			},
			{
				id: 2,
				type: 'ranked',
				over: false,
				event: false,
				players: {
					black: {
						name: 'a'
					},
					white: {
						name: 'b'
					}
				}
			}
		];
		expect(source.getLiveGames(games).map((g) => g.id)).toEqual([1]);
	});
	it("delegates getLiveEvents to the calendar's live bucket", () => {
		const events = [
			{
				id: 'today',
				name: 'Today',
				date_start: '2026-06-15',
				platform: 'youtube',
				stream_url: 'https://www.youtube.com/@x'
			}
		];
		const now = new Date('2026-06-15T12:00:00');
		expect(source.getLiveEvents(events, now).map((e) => e.id)).toEqual(['today']);
	});
	it('delegates getLiveEventForGame to the explicit kgs_players match', () => {
		const game = {
			id: 1,
			type: 'ranked',
			event: true,
			players: {
				black: {
					name: 'a'
				},
				white: {
					name: 'b'
				}
			}
		};
		const events = [
			{
				id: 'e1',
				name: 'Only Live Event',
				date_start: '2026-06-15',
				platform: 'youtube',
				stream_url: 'https://www.youtube.com/@x',
				kgs_players: ['A']
			}
		];
		const now = new Date('2026-06-15T12:00:00');
		expect(source.getLiveEventForGame(game, events, {}, now).id).toBe('e1');
	});
	it('delegates getLiveBroadcasts', () => {
		const games = [
			{
				id: 1,
				type: 'tournament',
				over: false,
				event: true,
				players: {
					black: {
						name: 'a'
					},
					white: {
						name: 'b'
					}
				}
			}
		];
		const events = [
			{
				id: 'e1',
				name: 'Cup',
				date_start: '2026-06-15',
				platform: 'twitch',
				stream_url: 'https://www.twitch.tv/somechannel',
				kgs_players: ['b']
			}
		];
		const now = new Date('2026-06-15T12:00:00');
		const broadcasts = source.getLiveBroadcasts(games, events, {}, now);
		expect(broadcasts.map((b) => [b.event.id, b.games.map((g) => g.id)])).toEqual([['e1', [1]]]);
	});
});
describe('IgsTvSource', () => {
	const source = new IgsTvSource();
	it('blocks getLiveGames', () => {
		expect(() => source.getLiveGames([])).toThrow(/blocked/);
	});
	it('blocks getLiveEvents', () => {
		expect(() => source.getLiveEvents([], new Date())).toThrow(/blocked/);
	});
	it('blocks getLiveEventForGame', () => {
		expect(() => source.getLiveEventForGame({}, [], {}, new Date())).toThrow(/blocked/);
	});
	it('blocks getLiveBroadcasts', () => {
		expect(() => source.getLiveBroadcasts([], [], {}, new Date())).toThrow(/blocked/);
	});
});
