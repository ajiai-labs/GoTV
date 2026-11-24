// Automatic opponent selection ("Automatische Gegnerwahl", KGS automatch):
// prefs and status from KGS, start/cancel, and opening the game KGS found.
import { AppActions } from './AppActions';
import { AppStore } from './AppStore';
import { getInitialState, handleMessage } from './index';
import { DEFAULT_AUTOMATCH_PREFS, automatchMessage } from './automatch';
import type { KgsClient } from './KgsClient';
import type { AppState } from './types';

const ME = { name: 'andy1975', rank: '1d', flags: {} };

function setup(patch: Partial<AppState> = {}) {
	const state = {
		...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
		initialized: true,
		currentUser: ME,
		...patch
	} as AppState;
	const store = new AppStore(handleMessage, state);
	const sendMessage = vi.fn();
	const client = { sendMessage } as unknown as KgsClient;
	const history = { location: { pathname: '/spielen' }, push: vi.fn(), replace: vi.fn() };
	const actions = new AppActions(store, client, history);
	return { store, sendMessage, history, actions };
}

const PREFS_FROM_KGS = {
	type: 'AUTOMATCH_PREFS',
	maxHandicap: 2,
	estimatedRank: '1d',
	freeOk: false,
	rankedOk: true,
	robotOk: false,
	humanOk: true,
	blitzOk: false,
	fastOk: true,
	mediumOk: false,
	unrankedOk: false
};

describe('automatch', () => {
	it('keeps the prefs and the search status KGS sends', () => {
		const { store, actions } = setup();
		actions.onReceiveServerMessages([PREFS_FROM_KGS, { type: 'AUTOMATCH_STATUS', enabled: true }]);
		expect(store.getState().automatchPrefs).toMatchObject({ maxHandicap: 2, fastOk: true });
		expect(store.getState().automatchEnabled).toBe(true);
		actions.onReceiveServerMessages([{ type: 'AUTOMATCH_STATUS', enabled: false }]);
		expect(store.getState().automatchEnabled).toBe(false);
	});

	it('sends the prefs back as KGS sent them, without the message type', () => {
		const message = automatchMessage('AUTOMATCH_CREATE', PREFS_FROM_KGS as never);
		expect(message).toEqual({ ...PREFS_FROM_KGS, type: 'AUTOMATCH_CREATE' });
	});

	it('starts the search with the saved prefs, or the defaults', () => {
		const { sendMessage, store, actions } = setup();
		actions.onStartAutomatch();
		expect(sendMessage).toHaveBeenLastCalledWith({
			...DEFAULT_AUTOMATCH_PREFS,
			type: 'AUTOMATCH_CREATE'
		});
		expect(store.getState().automatchEnabled).toBe(true);

		actions.onReceiveServerMessages([PREFS_FROM_KGS]);
		actions.onStartAutomatch();
		expect(sendMessage).toHaveBeenLastCalledWith({ ...PREFS_FROM_KGS, type: 'AUTOMATCH_CREATE' });
	});

	it('saves changed prefs at KGS and in the state', () => {
		const { sendMessage, store, actions } = setup();
		actions.onReceiveServerMessages([PREFS_FROM_KGS]);
		actions.onSetAutomatchPrefs({ ...store.getState().automatchPrefs!, blitzOk: true });
		expect(sendMessage).toHaveBeenLastCalledWith({
			...PREFS_FROM_KGS,
			blitzOk: true,
			type: 'AUTOMATCH_SET_PREFS'
		});
		expect(store.getState().automatchPrefs).toMatchObject({ blitzOk: true });
	});

	it('cancels the search', () => {
		const { sendMessage, store, actions } = setup({ automatchEnabled: true } as Partial<AppState>);
		actions.onCancelAutomatch();
		expect(sendMessage).toHaveBeenLastCalledWith({ type: 'AUTOMATCH_CANCEL' });
		expect(store.getState().automatchEnabled).toBe(false);
	});

	it('opens the game KGS found while searching, on the Spielen page', () => {
		const { store, history, actions } = setup({ automatchEnabled: true } as Partial<AppState>);
		actions.onReceiveServerMessages([
			{ type: 'AUTOMATCH_STATUS', enabled: false },
			{
				type: 'GAME_JOIN',
				channelId: 900,
				gameType: 'ranked',
				players: { white: ME, black: { name: 'sandora', rank: '5k', flags: {} } },
				sgfEvents: [],
				users: []
			}
		]);
		expect(store.getState().playGameId).toBe(900);
		expect(history.push).toHaveBeenCalledWith('/play');
	});

	it('opens the game also when KGS ends the search in an earlier answer', () => {
		const { store, history, actions } = setup({ automatchEnabled: true } as Partial<AppState>);
		actions.onReceiveServerMessages([{ type: 'AUTOMATCH_STATUS', enabled: false }]);
		actions.onReceiveServerMessages([
			{
				type: 'GAME_JOIN',
				channelId: 902,
				gameType: 'ranked',
				players: { white: ME, black: { name: 'sandora', rank: '5k', flags: {} } },
				sgfEvents: [],
				users: []
			}
		]);
		expect(store.getState().playGameId).toBe(902);
		expect(history.push).toHaveBeenCalledWith('/play');
	});

	it('does not treat a game as found after the user cancelled the search', () => {
		const { store, actions } = setup({ automatchEnabled: true } as Partial<AppState>);
		actions.onCancelAutomatch();
		actions.onReceiveServerMessages([
			{
				type: 'GAME_JOIN',
				channelId: 903,
				gameType: 'ranked',
				players: { white: ME, black: { name: 'sandora', rank: '5k', flags: {} } },
				sgfEvents: [],
				users: []
			}
		]);
		expect(store.getState().playGameId).toBeNull();
	});

	it('does not take over a game the user only watches', () => {
		const { store, history, actions } = setup({ automatchEnabled: true } as Partial<AppState>);
		actions.onReceiveServerMessages([
			{
				type: 'GAME_JOIN',
				channelId: 901,
				gameType: 'ranked',
				players: {
					white: { name: 'a', rank: '3d', flags: {} },
					black: { name: 'b', rank: '3d', flags: {} }
				},
				sgfEvents: [],
				users: []
			}
		]);
		expect(store.getState().playGameId).toBeNull();
		expect(history.push).not.toHaveBeenCalled();
	});
});
