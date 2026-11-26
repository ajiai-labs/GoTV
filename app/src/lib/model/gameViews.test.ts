// One KGS subscription per game for all windows (review 26.11.2026): KGS
// logs the whole connection out on a request for a channel it does not know,
// so joins and unjoins must be exact.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppActions } from './AppActions';
import { AppStore } from './AppStore';
import { getInitialState, handleMessage } from './index';
import type { KgsClient } from './KgsClient';
import type { AppState, GameChannel } from './types';

const ME = { name: 'andy1975', rank: '1d', flags: {} };

function game(id: number): GameChannel {
	return {
		id,
		type: 'ranked',
		players: { white: { name: 'anna' }, black: { name: 'bert' } }
	} as unknown as GameChannel;
}

function setup(listed: Array<number> = [42]) {
	const state = {
		...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
		initialized: true,
		currentUser: ME,
		gamesById: { 42: game(42), 43: game(43) },
		activeGames: listed.map(game)
	} as AppState;
	const store = new AppStore(handleMessage, state);
	const sendMessage = vi.fn();
	const client = { sendMessage } as unknown as KgsClient;
	const history = { location: { pathname: '/beobachten' }, push: vi.fn(), replace: vi.fn() };
	const actions = new AppActions(store, client, history);
	const sent = (type: string) =>
		sendMessage.mock.calls.filter(([msg]) => msg.type === type).map(([msg]) => msg.channelId);
	return { store, actions, sent };
}

describe('game views', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('keeps the overview live when a game window of the same game closes', () => {
		const { actions, sent } = setup();
		actions.onViewGame(42, 'bretter');
		actions.onViewGame(42, 'partie'); // the same game in its own window
		expect(sent('JOIN_REQUEST')).toEqual([42]); // joined once
		// The game window closes: its close button and pagehide.
		actions.onLeaveGame(42);
		actions.onUnviewGame(42, 'partie');
		vi.advanceTimersByTime(10_000);
		expect(sent('UNJOIN_REQUEST')).toEqual([]);
		// The last board is taken off: exactly one unjoin.
		actions.onUnviewGame(42, 'bretter');
		actions.onUnviewGame(42, 'bretter');
		vi.advanceTimersByTime(10_000);
		expect(sent('UNJOIN_REQUEST')).toEqual([42]);
	});

	it('keeps the game joined when its window is opened afresh', () => {
		const { actions, sent } = setup();
		actions.onViewGame(42, 'old');
		actions.onUnviewGame(42, 'old'); // closed ...
		vi.advanceTimersByTime(500);
		actions.onViewGame(42, 'new'); // ... and opened again
		vi.advanceTimersByTime(10_000);
		expect(sent('UNJOIN_REQUEST')).toEqual([]);
		expect(sent('JOIN_REQUEST')).toEqual([42]);
	});

	it('never asks KGS for a game it no longer lists', () => {
		const { actions, sent } = setup([42]);
		actions.onViewGame(43, 'bretter'); // finished, no longer in the list
		expect(sent('JOIN_REQUEST')).toEqual([]);
		actions.onUnviewGame(43, 'bretter');
		vi.advanceTimersByTime(10_000);
		expect(sent('UNJOIN_REQUEST')).toEqual([]); // not joined: nothing to leave
	});
});
