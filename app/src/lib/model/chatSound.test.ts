import { describe, expect, it } from 'vitest';
import { isChatForMe } from './chatSound';
import type { AppState } from './types';

function state(extra: Partial<AppState> = {}) {
	return {
		currentUser: { name: 'andy1975', rank: '1d', flags: {} },
		conversationsById: {
			7: { id: 7, user: { name: 'ziming9' }, status: 'open' },
			8: { id: 8, user: { name: 'old' }, status: 'closed' }
		},
		gamesById: {
			20: {
				id: 20,
				type: 'ranked',
				over: false,
				players: { black: { name: 'andy1975' }, white: { name: 'ziming9' } }
			},
			21: {
				id: 21,
				type: 'ranked',
				over: true,
				players: { black: { name: 'andy1975' }, white: { name: 'ziming9' } }
			},
			22: {
				id: 22,
				type: 'ranked',
				over: false,
				players: { black: { name: 'a' }, white: { name: 'b' } }
			},
			23: { id: 23, type: 'review', over: false, players: { owner: { name: 'andy1975' } } }
		},
		...extra
	} as unknown as AppState;
}

describe('chat sound', () => {
	it('sounds for a private message from someone else', () => {
		expect(isChatForMe(state(), 7, 'ziming9')).toBe(true);
		expect(isChatForMe(state(), 7, 'ANDY1975')).toBe(false); // my own echo
		expect(isChatForMe(state(), 8, 'old')).toBe(false); // closed chat
	});

	it('sounds for the chat of my own running game only', () => {
		expect(isChatForMe(state(), 20, 'ziming9')).toBe(true);
		expect(isChatForMe(state(), 20, 'kibitz')).toBe(true);
		expect(isChatForMe(state(), 21, 'ziming9')).toBe(false); // game over
		expect(isChatForMe(state(), 22, 'a')).toBe(false); // only watching
		expect(isChatForMe(state(), 23, 'friend')).toBe(false); // review
		expect(isChatForMe(state(), 99, 'room')).toBe(false); // a room
	});

	it('stays quiet while logged out', () => {
		expect(isChatForMe(state({ currentUser: null }), 7, 'ziming9')).toBe(false);
	});
});
