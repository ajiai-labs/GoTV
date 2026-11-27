// Editing a KGS review must never send a node id twice (review 27.11.2026:
// an answer held back for more than 3 s let the next click reuse the id, and
// a strict server logs the whole session out on that).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppActions } from './AppActions';
import { AppStore } from './AppStore';
import { getInitialState, handleMessage } from './index';
import type { KgsClient } from './KgsClient';
import type { AppState, KgsMessage } from './types';

const ME = { name: 'andy1975', rank: '1d', flags: {} };

function setup() {
	const state = {
		...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
		initialized: true,
		currentUser: ME
	} as AppState;
	const store = new AppStore(handleMessage, state);
	const sendMessage = vi.fn((message: KgsMessage) => {
		void message;
		return Promise.resolve();
	});
	const client = { sendMessage } as unknown as KgsClient;
	const history = { location: { pathname: '/beobachten' }, push: vi.fn(), replace: vi.fn() };
	const actions = new AppActions(store, client, history);
	actions.onReceiveServerMessages([
		{
			type: 'GAME_JOIN',
			channelId: 700,
			gameType: 'review',
			players: { owner: ME },
			users: [],
			sgfEvents: [
				{ type: 'PROP_GROUP_ADDED', nodeId: 0, props: [{ name: 'RULES', size: 9 }] },
				{ type: 'ACTIVATED', nodeId: 0, prevNodeId: 0 }
			]
		},
		{ type: 'GAME_STATE', channelId: 700, actions: [{ action: 'EDIT', user: ME }] }
	]);
	const game = () => store.getState().gamesById[700];
	const changes = () =>
		sendMessage.mock.calls
			.map(([message]) => message)
			.filter((message) => message.type === 'KGS_SGF_CHANGE');
	return { actions, game, changes, store, sendMessage };
}

describe('editing a review', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('waits for KGS before the next change, and never reuses a node id', () => {
		const { actions, game, changes } = setup();
		actions.onReviewMove(game(), { x: 2, y: 2 });
		actions.onReviewMove(game(), { x: 3, y: 3 }); // no answer yet: held back
		expect(changes()).toHaveLength(1);
		const first = changes()[0].sgfEvents[0].childNodeId;

		vi.advanceTimersByTime(11_000); // still no answer: the next may go ...
		actions.onReviewMove(game(), { x: 3, y: 3 });
		expect(changes()).toHaveLength(2);
		// ... but with a new node id.
		expect(changes()[1].sgfEvents[0].childNodeId).not.toBe(first);
	});

	it('goes on at once when KGS sends exactly that change back', () => {
		const { actions, game, changes } = setup();
		actions.onReviewMove(game(), { x: 2, y: 2 });
		// Someone's chat line is no answer to our change.
		actions.onReceiveServerMessages([
			{
				type: 'GAME_UPDATE',
				channelId: 700,
				sgfEvents: [{ type: 'PROP_ADDED', nodeId: 0, prop: { name: 'COMMENT', text: 'hi' } }]
			}
		]);
		actions.onReviewMove(game(), { x: 3, y: 3 });
		expect(changes()).toHaveLength(1);
		actions.onReceiveServerMessages([
			{ type: 'GAME_UPDATE', channelId: 700, sgfEvents: changes()[0].sgfEvents }
		]);
		actions.onReviewMove(game(), { x: 3, y: 3 });
		expect(changes()).toHaveLength(2);
		expect(changes()[1].sgfEvents[0].nodeId).toBe(changes()[0].sgfEvents[0].childNodeId);
	});

	it('a save KGS does not confirm counts as failed, a confirmed one as saved', async () => {
		const { actions, game, store } = setup();
		const status = () => store.getState().saveStatus?.['review:700'];
		actions.onSaveReview(game());
		expect(status()).toBe('saving');
		await vi.advanceTimersByTimeAsync(11_000);
		expect(status()).toBe('failed');

		actions.onSaveReview(game());
		await vi.advanceTimersByTimeAsync(100);
		actions.onReceiveServerMessages([{ type: 'GAME_STATE', channelId: 700, saved: true }]);
		await vi.advanceTimersByTimeAsync(11_000);
		expect(status()).toBe('saving');
		expect(game().saved).toBe(true); // the window shows "gespeichert" from the flag
	});

	it('a save that did not reach KGS fails at once', async () => {
		const { actions, game, store, sendMessage } = setup();
		sendMessage.mockImplementationOnce(() => Promise.reject(new Error('503')));
		actions.onSaveReview(game());
		await vi.advanceTimersByTimeAsync(0);
		expect(store.getState().saveStatus?.['review:700']).toBe('failed');
	});

	it('a jump into another variation shows that line', () => {
		const { actions, game } = setup();
		const move = (nodeId: number, child: number, x: number, position = 0) => [
			{ type: 'CHILD_ADDED', nodeId, childNodeId: child, position },
			{ type: 'ACTIVATED', nodeId: child, prevNodeId: nodeId },
			{
				type: 'PROP_ADDED',
				nodeId: child,
				prop: { name: 'MOVE', color: 'black', loc: { x, y: 0 } }
			}
		];
		actions.onReceiveServerMessages([
			{ type: 'GAME_UPDATE', channelId: 700, sgfEvents: [...move(0, 1, 1), ...move(1, 2, 2)] }
		]);
		// The controller plays a variation from move 1 (KGS sends it to all).
		actions.onReceiveServerMessages([
			{ type: 'GAME_UPDATE', channelId: 700, sgfEvents: move(1, 3, 5, 1) }
		]);
		const tree = game().tree!;
		expect(tree.currentNode).toBe(3);
		expect(tree.currentLine).toEqual([0, 1, 3]);
	});
});
