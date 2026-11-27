// "Mit Gegner besprechen" after an own game (27.11.2026): KGS turns the game
// into a review in a new channel (GAME_REVIEW) and closes the old one.
import { describe, expect, it, vi } from 'vitest';
import { AppActions } from './AppActions';
import { AppStore } from './AppStore';
import { getInitialState, handleMessage } from './index';
import type { KgsClient } from './KgsClient';
import type { AppState } from './types';

const ME = { name: 'andy1975', rank: '1d', flags: {} };
const ANNA = { name: 'anna', rank: '2d', flags: {} };

function setup(over = true) {
	const players = { white: ANNA, black: ME };
	const state = {
		...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
		initialized: true,
		currentUser: ME
	} as AppState;
	const store = new AppStore(handleMessage, state);
	const sendMessage = vi.fn(() => Promise.resolve());
	const client = { sendMessage } as unknown as KgsClient;
	const history = { location: { pathname: '/spielen' }, push: vi.fn(), replace: vi.fn() };
	const actions = new AppActions(store, client, history);
	actions.onReceiveServerMessages([
		{
			type: 'GAME_JOIN',
			channelId: 300,
			gameType: 'ranked',
			players,
			users: [],
			sgfEvents: [
				{ type: 'PROP_GROUP_ADDED', nodeId: 0, props: [{ name: 'RULES', size: 9 }] },
				{ type: 'CHILD_ADDED', nodeId: 0, childNodeId: 1 },
				{
					type: 'PROP_ADDED',
					nodeId: 1,
					prop: { name: 'MOVE', color: 'black', loc: { x: 2, y: 2 } }
				},
				{ type: 'ACTIVATED', nodeId: 1, prevNodeId: 0 }
			]
		},
		{ type: 'GAME_STATE', channelId: 300, over }
	]);
	store.dispatch({ type: 'PLAY_GAME', gameId: 300 });
	sendMessage.mockClear();
	return { store, sendMessage, history, actions };
}

describe('starting a review with the opponent', () => {
	it('asks KGS only for an own game that is over', () => {
		const { store, sendMessage, actions } = setup();
		actions.onStartReview(store.getState().gamesById[300]);
		expect(sendMessage).toHaveBeenCalledWith({ type: 'GAME_START_REVIEW', channelId: 300 });

		const running = setup(false);
		running.actions.onStartReview(running.store.getState().gamesById[300]);
		expect(running.sendMessage).not.toHaveBeenCalled();
	});

	it('follows the game into the review channel and never asks for the old one', () => {
		const { store, sendMessage, history, actions } = setup();
		actions.onReceiveServerMessages([
			{
				type: 'GAME_REVIEW',
				originalId: 300,
				review: {
					channelId: 301,
					gameType: 'review',
					players: { owner: ME, white: ANNA, black: ME }
				}
			},
			{ type: 'CLOSE', channelId: 300 }
		]);
		const state = store.getState();
		expect(state.movedGames).toEqual({ 300: 301 });
		expect(state.watchGameId).toBe(301);
		expect(state.playGameId).toBeNull();
		expect(state.gamesById[301].type).toBe('review');
		expect(state.gamesById[301].tree?.nodes[1]).toBeTruthy(); // the game's moves
		expect(state.channelMembership[301]).toBeTruthy();
		expect(history.push).toHaveBeenCalledWith('/watch');

		actions.onLeaveGame(300);
		actions.onViewGame(300, 'old-window');
		expect(
			sendMessage.mock.calls.filter(([msg]) => (msg as { channelId?: number }).channelId === 300)
		).toEqual([]);
	});
});
