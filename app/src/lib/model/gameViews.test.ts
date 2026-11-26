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

	it('never joins a game again after KGS closed it, on any path', () => {
		const { actions, sent } = setup();
		actions.onViewGame(42, 'partie');
		actions.onReceiveServerMessages([
			{
				type: 'GAME_JOIN',
				channelId: 42,
				gameType: 'ranked',
				players: {},
				sgfEvents: [],
				users: []
			}
		]);
		actions.onReceiveServerMessages([{ type: 'CLOSE', channelId: 42 }]);
		actions.onViewGame(42, 'bretter'); // another view
		actions.onJoinGame(42); // the Beobachten fallback
		actions.onLeaveGame(42);
		vi.advanceTimersByTime(10_000);
		expect(sent('JOIN_REQUEST')).toEqual([42]); // only the first, before CLOSE
		expect(sent('UNJOIN_REQUEST')).toEqual([]);
	});

	it('a timer of the old session does not unjoin after logging in again', () => {
		const { actions, sent } = setup();
		actions.onViewGame(42, 'partie');
		actions.onUnviewGame(42, 'partie'); // closed: release in 3 s
		actions.onReceiveServerMessages([{ type: 'LOGOUT' }]);
		actions.onReceiveServerMessages([
			{
				type: 'LOGIN_SUCCESS',
				you: { name: 'andy1975' },
				rooms: [],
				friends: [],
				subscriptions: []
			}
		]);
		vi.advanceTimersByTime(10_000);
		expect(sent('UNJOIN_REQUEST')).toEqual([]);
	});

	it('someone else getting a challenge never leaves my own running game', () => {
		const { store, actions, sent } = setup();
		actions.onReceiveServerMessages([
			{
				type: 'GAME_JOIN',
				channelId: 50,
				gameType: 'ranked',
				players: { white: ME, black: { name: 'anna' } },
				sgfEvents: [],
				users: []
			},
			{
				type: 'CHALLENGE_JOIN',
				channelId: 60,
				gameType: 'challenge',
				players: {},
				sgfEvents: [],
				users: []
			}
		]);
		expect(store.getState().channelMembership[50]).toBeTruthy();
		actions.onChallengeFinalized(
			{
				players: [
					{ role: 'white', name: 'bert' },
					{ role: 'black', name: 'carl' }
				]
			} as never,
			60,
			61
		);
		expect(sent('UNJOIN_REQUEST')).toEqual([60]); // only the challenge
	});

	it('joins again for a window that registered while its old window was leaving', () => {
		const { actions, sent } = setup();
		actions.onViewGame(42, 'old');
		actions.onReceiveServerMessages([
			{
				type: 'GAME_JOIN',
				channelId: 42,
				gameType: 'ranked',
				players: {},
				sgfEvents: [],
				users: []
			}
		]);
		actions.onUnviewGame(42, 'old');
		vi.advanceTimersByTime(3_500); // released
		expect(sent('UNJOIN_REQUEST')).toEqual([42]);
		actions.onViewGame(42, 'new'); // before KGS answered the unjoin
		actions.onReceiveServerMessages([{ type: 'UNJOIN', channelId: 42 }]);
		expect(sent('JOIN_REQUEST')).toEqual([42, 42]);
	});

	it('leaves a game when the user confirmed it, even while another window shows it', () => {
		const { actions, sent } = setup();
		actions.onViewGame(42, 'partie');
		actions.onReceiveServerMessages([
			{
				type: 'GAME_JOIN',
				channelId: 42,
				gameType: 'ranked',
				players: {},
				sgfEvents: [],
				users: []
			}
		]);
		actions.onLeaveGame(42); // just closing: stays joined for the view
		expect(sent('UNJOIN_REQUEST')).toEqual([]);
		actions.onLeaveGame(42, { explicit: true }); // "Verlassen" confirmed
		expect(sent('UNJOIN_REQUEST')).toEqual([42]);
	});
});
