// KGS logs the user out ("Internal error ... Unknown channel N") when the
// client sends UNJOIN_REQUEST for a channel KGS has already closed - e.g.
// "Schließen" on a game that just ended. Seen in the desktop app 24.11.2026.
import { AppActions } from './AppActions';
import { AppStore } from './AppStore';
import { getInitialState, handleMessage } from './index';
import type { KgsClient } from './KgsClient';
import type { AppState } from './types';

function setup() {
	const state = {
		...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
		initialized: true,
		currentUser: { name: 'andy1975', rank: '1d', flags: {} }
	} as AppState;
	const store = new AppStore(handleMessage, state);
	const sendMessage = vi.fn();
	const client = { sendMessage } as unknown as KgsClient;
	const history = { location: { pathname: '/beobachten' }, push: vi.fn(), replace: vi.fn() };
	return { sendMessage, actions: new AppActions(store, client, history) };
}

const unjoins = (send: ReturnType<typeof vi.fn>) =>
	send.mock.calls.filter(([msg]) => (msg as { type: string }).type === 'UNJOIN_REQUEST');

describe('channels closed by KGS', () => {
	it('leaving a game KGS already closed sends no UNJOIN_REQUEST', () => {
		const { sendMessage, actions } = setup();
		actions.onReceiveServerMessages([{ type: 'CLOSE', channelId: 109615487 }]);
		actions.onLeaveGame(109615487);
		expect(unjoins(sendMessage)).toEqual([]);
	});

	it('still leaves an open game, and a game joined again after closing', () => {
		const { sendMessage, actions } = setup();
		actions.onReceiveServerMessages([
			{ type: 'GAME_JOIN', channelId: 42, gameType: 'free', players: {}, sgfEvents: [], users: [] }
		]);
		actions.onLeaveGame(42);
		expect(unjoins(sendMessage)).toHaveLength(1);

		actions.onReceiveServerMessages([{ type: 'UNJOIN', channelId: 43 }]);
		actions.onReceiveServerMessages([
			{ type: 'GAME_JOIN', channelId: 43, gameType: 'free', players: {}, sgfEvents: [], users: [] }
		]);
		actions.onLeaveGame(43);
		expect(unjoins(sendMessage)).toHaveLength(2);
	});

	it('a TV board released after KGS closed its game sends no UNJOIN_REQUEST', () => {
		const { sendMessage, actions } = setup();
		const release = actions.onObserveTvGame(77);
		actions.onReceiveServerMessages([{ type: 'CLOSE', channelId: 77 }]);
		release();
		expect(unjoins(sendMessage)).toEqual([]);
	});
});
