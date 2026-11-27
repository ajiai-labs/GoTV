import { describe, expect, it, vi } from 'vitest';

const sounds = vi.hoisted(() => ({ playGameStart: vi.fn() }));
vi.mock('../sound/gameSounds', () => ({ playGameStart: sounds.playGameStart }));
import { AppActions } from './AppActions';
import { AppStore } from './AppStore';
import { getInitialState, handleMessage } from './index';
import type { KgsClient } from './KgsClient';
import type { AppState } from './types';

const ME = { name: 'andy1975', rank: '1d', flags: {} };
const ANNA = { name: 'anna', rank: '2d', flags: {} };

function setup() {
	const state = {
		...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
		initialized: true,
		currentUser: ME
	} as AppState;
	const store = new AppStore(handleMessage, state);
	const sendMessage = vi.fn();
	const client = { sendMessage } as unknown as KgsClient;
	const history = { location: { pathname: '/spielen' }, push: vi.fn(), replace: vi.fn() };
	const actions = new AppActions(store, client, history);
	return { store, sendMessage, history, actions };
}

function gameJoin(channelId: number, gameType: string, players: object) {
	return { type: 'GAME_JOIN', channelId, gameType, players, sgfEvents: [], users: [] };
}

describe('loading a game from the archive', () => {
	it('asks KGS to load it into the room', () => {
		const { sendMessage, actions } = setup();
		actions.onLoadGame('2026-11-20T18:00:00.000Z', 5, false);
		expect(sendMessage).toHaveBeenCalledWith({
			type: 'ROOM_LOAD_GAME',
			channelId: 5,
			private: false,
			timestamp: '2026-11-20T18:00:00.000Z'
		});
	});

	it('opens our own unfinished game on Spielen when KGS brings it', () => {
		const { store, history, actions } = setup();
		actions.onLoadGame('2026-11-20T18:00:00.000Z', 5, false);
		actions.onReceiveServerMessages([gameJoin(910, 'ranked', { white: ME, black: ANNA })]);
		expect(store.getState().playGameId).toBe(910);
		expect(history.push).toHaveBeenCalledWith('/play');
		// The chime, so you hear it away from the screen.
		expect(sounds.playGameStart).toHaveBeenCalled();
	});

	it('leaves a loaded review to whoever asked for it', () => {
		const { store, actions } = setup();
		actions.onLoadGame('2026-11-20T18:00:00.000Z', 5, true);
		actions.onReceiveServerMessages([
			{
				...gameJoin(911, 'review', { owner: ME }),
				gameSummary: { gameType: 'review', timestamp: '2026-11-25T08:00:00.000Z', players: {} }
			}
		]);
		expect(store.getState().playGameId).toBeNull();
		expect(store.getState().reviewGameId).toBe(911);
	});

	it('shows the review of an own game, not Spielen (we are white in it)', () => {
		const { store, history, actions } = setup();
		actions.onLoadGame('2026-11-20T18:00:00.000Z', 5, true);
		const players = { owner: ME, white: ME, black: ANNA };
		actions.onReceiveServerMessages([
			{
				...gameJoin(912, 'review', players),
				gameSummary: { gameType: 'review', timestamp: '2026-11-25T08:00:00.000Z', players }
			}
		]);
		actions.onJoinGame(912); // what UserGameSummary does with reviewGameId
		expect(store.getState().playGameId).toBeNull();
		expect(store.getState().watchGameId).toBe(912);
		expect(history.push).not.toHaveBeenCalledWith('/play');
	});

	it('does not take over games joined without a load request', () => {
		const { store, actions } = setup();
		actions.onReceiveServerMessages([gameJoin(912, 'ranked', { white: ME, black: ANNA })]);
		expect(store.getState().playGameId).toBeNull();
	});

	it('remembers when KGS cannot load the game, until the next try', () => {
		const { store, actions } = setup();
		actions.onLoadGame('2026-11-20T18:00:00.000Z', 5, false);
		actions.onReceiveServerMessages([
			{ type: 'LOAD_FAILED', channelId: 5, gameSummary: { timestamp: '2026-11-20T18:00:00.000Z' } }
		]);
		expect(store.getState().loadFailed).toBe('2026-11-20T18:00:00.000Z');
		actions.onLoadGame('2026-11-20T18:00:00.000Z', 5, false);
		expect(store.getState().loadFailed).toBeNull();
	});
});

describe('copying a watched game into a room', () => {
	it('asks KGS to clone it and opens the copy on Beobachten', () => {
		const { store, sendMessage, history, actions } = setup();
		actions.onCloneGame(5, 700);
		expect(sendMessage).toHaveBeenCalledWith({
			type: 'ROOM_CLONE_GAME',
			channelId: 5,
			gameChannelId: 700
		});
		actions.onReceiveServerMessages([gameJoin(912, 'review', { owner: ME })]);
		expect(store.getState().watchGameId).toBe(912);
		expect(history.push).toHaveBeenCalledWith('/watch');
	});

	it('ignores a game join that is no copy', () => {
		const { store, actions } = setup();
		actions.onCloneGame(5, 700);
		actions.onReceiveServerMessages([gameJoin(913, 'free', { white: ANNA, black: ME })]);
		expect(store.getState().watchGameId).not.toBe(913);
	});
});
