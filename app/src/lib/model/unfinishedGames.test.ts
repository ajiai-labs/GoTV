import { describe, expect, it } from 'vitest';
import { getInitialState, handleMessage } from './index';
import type { AppState, KgsMessage } from './types';

// Own unfinished games for "Fortsetzen" on Spielen: every unfinished game of
// the own archive (as CGoban lists them), not only those running right now.
const ME = { name: 'andy1975', rank: '1d', flags: {} };

function loggedIn(): AppState {
	return {
		...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
		initialized: true,
		currentUser: ME
	} as AppState;
}

function summary(timestamp: string, opponent: string, extra: object = {}) {
	return {
		gameType: 'ranked',
		timestamp,
		size: 19,
		komi: 6.5,
		players: { white: { name: opponent, rank: '2d' }, black: ME },
		...extra
	};
}

const ARCHIVE = {
	type: 'ARCHIVE_JOIN',
	channelId: 77,
	user: ME,
	games: [
		summary('2026-06-29T18:00:00.000Z', 'thirdstep', { score: 'UNFINISHED' }),
		summary('2026-09-16T18:00:00.000Z', 'guiguistar', { score: 'UNFINISHED', inPlay: true }),
		summary('2026-11-19T18:00:00.000Z', 'frisboi', { score: 3.5 })
	]
} as KgsMessage;

function run(state: AppState, ...msgs: Array<KgsMessage>): AppState {
	return msgs.reduce(handleMessage, state);
}

function names(state: AppState): Array<string> {
	return state.unfinishedGames.map((ug) =>
		ug.type === 'summary' ? ug.game.players.white!.name : `channel:${ug.game.id}`
	);
}

describe('own unfinished games', () => {
	it('lists every unfinished game of the archive, the open one first', () => {
		const state = run(loggedIn(), ARCHIVE);
		// guiguistar's game is open on KGS (opponent waiting), thirdstep's is not.
		expect(names(state)).toEqual(['guiguistar', 'thirdstep']);
	});

	it('keeps them when the list of running games changes', () => {
		const state = run(loggedIn(), ARCHIVE, {
			type: 'GLOBAL_GAMES_JOIN',
			channelId: 3,
			games: [
				{
					channelId: 500,
					gameType: 'free',
					players: { white: { name: 'x', rank: '3k' }, black: { name: 'y', rank: '4k' } }
				}
			]
		} as KgsMessage);
		expect(names(state)).toEqual(['guiguistar', 'thirdstep']);
	});
});
