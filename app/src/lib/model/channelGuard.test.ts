// KGS ends the whole session on a join or unjoin for a channel it does not
// know - the cases found in the review of 26.11.2026.
import { describe, expect, it } from 'vitest';
import { ChannelGuard } from './channelGuard';

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
});
