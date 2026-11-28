// KGS ends the whole session on a join or unjoin for a channel it does not
// know - the cases found in the review of 26.11.2026.
import { describe, expect, it } from 'vitest';
import { ChannelGuard } from './channelGuard';
import { handleMessage, getInitialState } from './index';

const join = (channelId: number) => ({ type: 'JOIN_REQUEST', channelId });
const unjoin = (channelId: number) => ({ type: 'UNJOIN_REQUEST', channelId });

describe('channel guard', () => {
	it('never asks for a channel KGS closed', () => {
		const guard = new ChannelGuard();
		guard.observe({ type: 'GAME_JOIN', channelId: 7 });
		guard.observe({ type: 'CLOSE', channelId: 7 });
		expect(guard.allow(join(7))).toBe(false);
		expect(guard.allow(unjoin(7))).toBe(false);
	});

	it('does not join a game again that KGS took off all its lists', () => {
		const guard = new ChannelGuard();
		guard.observe({ type: 'GLOBAL_GAMES_JOIN', channelId: 1, games: [{ channelId: 7 }] });
		guard.observe({ type: 'ROOM_JOIN', channelId: 2, games: [{ channelId: 7 }] });
		guard.observe({ type: 'GAME_CONTAINER_REMOVE_GAME', channelId: 2, gameId: 7 });
		expect(guard.allow(join(7))).toBe(true); // still in the global list
		guard.observe({ type: 'UNJOIN', channelId: 7 });
		guard.observe({ type: 'GAME_CONTAINER_REMOVE_GAME', channelId: 1, gameId: 7 });
		expect(guard.allow(join(7))).toBe(false);
	});

	it('sends a join once and an unjoin once, only for a channel we are in', () => {
		let now = 0;
		const guard = new ChannelGuard(() => now);
		expect(guard.allow(unjoin(7))).toBe(false); // not in it
		expect(guard.allow(join(7))).toBe(true);
		expect(guard.allow(join(7))).toBe(false); // already asked
		guard.observe({ type: 'GAME_JOIN', channelId: 7 });
		expect(guard.allow(join(7))).toBe(false); // in it
		expect(guard.allow(unjoin(7))).toBe(true);
		expect(guard.allow(unjoin(7))).toBe(false); // the timer after the close button
		guard.observe({ type: 'UNJOIN', channelId: 7 });
		expect(guard.allow(unjoin(7))).toBe(false);
		// An unanswered request blocks only for a while.
		expect(guard.allow(join(8))).toBe(true);
		now = 25_000;
		expect(guard.allow(join(8))).toBe(true);
	});

	it('forgets everything of the old session on a new login', () => {
		const guard = new ChannelGuard();
		guard.observe({ type: 'GAME_JOIN', channelId: 7 });
		guard.observe({ type: 'LOGOUT' });
		expect(guard.allow(unjoin(7))).toBe(false);
		guard.observe({ type: 'LOGIN_SUCCESS' });
		expect(guard.allow(unjoin(7))).toBe(false);
	});

	it('lets other messages through', () => {
		expect(new ChannelGuard().allow({ type: 'CHAT', channelId: 3, text: 'hi' })).toBe(true);
	});

	it('goes on after a reload or take-over with what it knew', () => {
		let now = 0;
		const before = new ChannelGuard(() => now);
		before.observe({ type: 'GAME_JOIN', channelId: 7 });
		before.observe({ type: 'GAME_JOIN', channelId: 8 });
		before.observe({ type: 'CLOSE', channelId: 7 });
		expect(before.allow(unjoin(8))).toBe(true); // KGS has not answered yet
		expect(before.allow(join(9))).toBe(true);
		const saved = JSON.parse(JSON.stringify(before.toJSON()));

		const after = new ChannelGuard(() => now);
		// The mirrored state still shows us in 7 (its CLOSE came after the save).
		after.restore(saved, [7, 8]);
		expect(after.allow(join(7))).toBe(false);
		expect(after.allow(unjoin(7))).toBe(false);
		expect(after.allow(unjoin(8))).toBe(false); // already asked
		expect(after.allow(join(9))).toBe(false); // already asked
		now = 25_000; // no answer: may ask again
		expect(after.allow(join(9))).toBe(true);
	});

	it('tells every change, so the owner window can store it', () => {
		const guard = new ChannelGuard();
		let changes = 0;
		guard.onChange = () => changes++;
		guard.allow(join(4));
		guard.observe({ type: 'GAME_JOIN', channelId: 4 });
		expect(changes).toBe(2);
	});
});

describe('a move that did not reach KGS', () => {
	it('goes off the board again and is marked until the board moves on', () => {
		let state = getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 });
		const tree = {
			nodes: { 0: { id: 0, children: [], props: [] } },
			rootNode: 0,
			activeNode: 0,
			currentNode: 0,
			currentLine: [0],
			computedState: {}
		};
		state = { ...state, gamesById: { 5: { id: 5, type: 'free', tree } as never } };
		state = handleMessage(state, {
			type: 'START_GAME_MOVE',
			channelId: 5,
			color: 'black',
			loc: { x: 2, y: 3 }
		});
		expect(state.gamesById[5].tree?.pendingMove).toBeTruthy();
		state = handleMessage(state, { type: 'GAME_MOVE_FAILED', channelId: 5 });
		expect(state.gamesById[5].tree?.pendingMove).toBeUndefined();
		expect(state.gamesById[5].moveFailed).toBe(true);
	});
});

// 28.11.2026: a profile change reached KGS after the leave of its channel.
describe('ChannelGuard - other requests', () => {
	it('lets nothing go to a channel we are leaving, left or KGS closed', () => {
		const guard = new ChannelGuard(() => 0);
		guard.observe({ type: 'DETAILS_JOIN', channelId: 7 });
		guard.observe({ type: 'GAME_JOIN', channelId: 8 });
		expect(guard.allow({ type: 'DETAILS_CHANGE', channelId: 7 })).toBe(true);
		expect(guard.allow({ type: 'UNJOIN_REQUEST', channelId: 7 })).toBe(true);
		// Leaving: a late change for it is dropped.
		expect(guard.allow({ type: 'DETAILS_CHANGE', channelId: 7 })).toBe(false);
		guard.observe({ type: 'UNJOIN', channelId: 7 });
		expect(guard.allow({ type: 'DETAILS_CHANGE', channelId: 7 })).toBe(false);
		guard.observe({ type: 'CLOSE', channelId: 8 });
		expect(guard.allow({ type: 'GAME_MOVE', channelId: 8 })).toBe(false);
		// Requests without a channel are not the gate's business.
		expect(guard.allow({ type: 'DETAILS_JOIN_REQUEST', name: 'andy1975' })).toBe(true);
	});

	it('lets requests go again once the channel is joined again, or being joined', () => {
		const guard = new ChannelGuard(() => 0);
		guard.observe({ type: 'GAME_JOIN', channelId: 9 });
		guard.observe({ type: 'UNJOIN', channelId: 9 });
		expect(guard.allow({ type: 'CHAT', channelId: 9 })).toBe(false);
		expect(guard.allow({ type: 'JOIN_REQUEST', channelId: 9 })).toBe(true);
		expect(guard.allow({ type: 'CHAT', channelId: 9 })).toBe(true);
		guard.observe({ type: 'GAME_JOIN', channelId: 9 });
		expect(guard.allow({ type: 'GAME_MOVE', channelId: 9 })).toBe(true);
	});

	it('keeps what was left across a reload of the window', () => {
		const guard = new ChannelGuard(() => 0);
		guard.observe({ type: 'GAME_JOIN', channelId: 9 });
		guard.observe({ type: 'UNJOIN', channelId: 9 });
		const again = new ChannelGuard(() => 0);
		again.restore(guard.toJSON());
		expect(again.allow({ type: 'CHAT', channelId: 9 })).toBe(false);
	});
});
