// "Spiel kommentieren" / "Kommentierte Spiele" (KGS tags, 27.11.2026).
import { describe, expect, it, vi } from 'vitest';
import { AppActions } from './AppActions';
import { AppStore } from './AppStore';
import { getInitialState, handleMessage } from './index';
import type { KgsClient } from './KgsClient';
import type { AppState, GameSummary } from './types';

const ME = { name: 'andy1975', rank: '1d', flags: {} };
const game: GameSummary = {
	timestamp: '2026-11-25T19:25:00.000Z',
	type: 'ranked',
	rules: { size: 19, komi: 0.5 },
	players: { white: ME, black: { name: 'Zaharka', rank: '2k' } },
	score: 24.5
};

function setup() {
	const state = {
		...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
		initialized: true,
		currentUser: ME
	} as AppState;
	const store = new AppStore(handleMessage, state);
	const sendMessage = vi.fn(() => Promise.resolve());
	const client = { sendMessage } as unknown as KgsClient;
	const history = { location: { pathname: '/konto' }, push: vi.fn(), replace: vi.fn() };
	return { store, sendMessage, actions: new AppActions(store, client, history) };
}

describe('KGS tags', () => {
	it('reads the tag archive of a player once and leaves it', () => {
		const { store, sendMessage, actions } = setup();
		actions.onRequestTagArchive('Zaharka');
		expect(sendMessage).toHaveBeenCalledWith({ type: 'JOIN_TAG_ARCHIVE_REQUEST', name: 'Zaharka' });
		actions.onReceiveServerMessages([
			{
				type: 'TAG_ARCHIVE_JOIN',
				channelId: 640,
				user: { name: 'Zaharka', rank: '2k' },
				games: [{ ...game, gameType: 'ranked', tag: 'schöner Angriff' }]
			}
		]);
		expect(store.getState().taggedGamesByUser?.Zaharka[0].tag).toBe('schöner Angriff');
		expect(sendMessage).toHaveBeenCalledWith({ type: 'UNJOIN_REQUEST', channelId: 640 });
	});

	it('tags a game (max. 50 characters), kept once KGS took it', async () => {
		const { store, sendMessage, actions } = setup();
		actions.onTagGame(game, '  ' + 'x'.repeat(60));
		expect(store.getState().saveStatus?.['tag:' + game.timestamp]).toBe('saving');
		await vi.waitFor(() =>
			expect(store.getState().saveStatus?.['tag:' + game.timestamp]).toBe('saved')
		);
		expect(sendMessage).toHaveBeenCalledWith({
			type: 'TAG_GAME',
			gameTimestamp: game.timestamp,
			text: 'x'.repeat(50)
		});
		expect(store.getState().taggedGamesByUser?.andy1975[0].tag).toBe('x'.repeat(50));
		actions.onTagGame(game, '');
		await vi.waitFor(() => expect(store.getState().taggedGamesByUser?.andy1975).toEqual([]));
	});

	it('says so when the comment did not reach KGS, and keeps nothing', async () => {
		const { store, sendMessage, actions } = setup();
		sendMessage.mockImplementationOnce(() => Promise.reject(new Error('503')));
		actions.onTagGame(game, 'Yose');
		await vi.waitFor(() =>
			expect(store.getState().saveStatus?.['tag:' + game.timestamp]).toBe('failed')
		);
		expect(store.getState().taggedGamesByUser?.andy1975).toBeUndefined();
	});

	it('an unknown player has no commented games', () => {
		const { store, actions } = setup();
		actions.onReceiveServerMessages([{ type: 'TAG_ARCHIVE_NONEXISTANT', name: 'niemand' }]);
		expect(store.getState().taggedGamesByUser?.niemand).toEqual([]);
	});
});
