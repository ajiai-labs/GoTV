import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { app } from '#lib/app.svelte.ts';
import type { AppActions } from '#lib/model/AppActions.ts';
import { getInitialState } from '#lib/model/appState.ts';
import type { AppState, User } from '#lib/model/types.ts';
import FavoriteRoomsWatcher from './FavoriteRoomsWatcher.svelte';
import { favoriteRooms } from './favoriteRooms.svelte.ts';

const me: User = { name: 'gotvfan', rank: '3k', flags: { connected: true } };
const ROOMS = {
	1: { id: 1, name: 'Deutscher Raum' },
	2: { id: 2, name: 'English Game Room' },
	3: { id: 3, name: 'Go Club' }
} as unknown as AppState['roomsById'];

function loggedIn(extra: Partial<AppState> = {}): AppState {
	return {
		...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
		currentUser: me,
		roomsById: ROOMS,
		// KGS rejoined the English Game Room on its own.
		channelMembership: { 2: { type: 'room', complete: true, stale: false } },
		activeConversationId: 2,
		...extra
	};
}

function loggedOut(): AppState {
	return getInitialState({ status: 'loggedOut', network: 'online', retryTimes: 0 });
}

function mockActions() {
	const actions = { onJoinRoom: vi.fn(), onSelectConversation: vi.fn() };
	app._actions = actions as unknown as AppActions;
	return actions;
}

describe('FavoriteRoomsWatcher', () => {
	beforeEach(() => {
		window.localStorage.setItem(
			'gotv.favoriteRooms',
			JSON.stringify([
				{ id: 1, name: 'Deutscher Raum' },
				{ id: 2, name: 'English Game Room' },
				{ id: 9, name: 'Gibt es nicht mehr' }
			])
		);
		favoriteRooms.reload();
		app.state = loggedOut();
	});

	afterEach(() => {
		app._actions = null;
		app.state = loggedOut();
		window.localStorage.clear();
		favoriteRooms.reload();
	});

	it('joins the starred rooms not joined yet, once per login', async () => {
		const actions = mockActions();
		await render(FavoriteRoomsWatcher, { delay: 10 });
		// Logged out: nothing.
		await new Promise((resolve) => setTimeout(resolve, 40));
		expect(actions.onJoinRoom).not.toHaveBeenCalled();

		app.state = loggedIn();
		await vi.waitFor(() => expect(actions.onJoinRoom).toHaveBeenCalledTimes(1));
		expect(actions.onJoinRoom).toHaveBeenCalledWith(ROOMS[1]);
		// The chat stays where it was.
		expect(actions.onSelectConversation).toHaveBeenCalledWith(2);

		// More messages in the same login: no second round.
		app.state = loggedIn({ activeConversationId: 1 });
		await new Promise((resolve) => setTimeout(resolve, 40));
		expect(actions.onJoinRoom).toHaveBeenCalledTimes(1);

		// The next login joins again.
		app.state = loggedOut();
		await new Promise((resolve) => setTimeout(resolve, 20));
		app.state = loggedIn();
		await vi.waitFor(() => expect(actions.onJoinRoom).toHaveBeenCalledTimes(2));
	});

	it('waits for the room names', async () => {
		const actions = mockActions();
		await render(FavoriteRoomsWatcher, { delay: 10 });
		app.state = loggedIn({ roomsById: {} });
		await new Promise((resolve) => setTimeout(resolve, 40));
		expect(actions.onJoinRoom).not.toHaveBeenCalled();
		app.state = loggedIn();
		await vi.waitFor(() => expect(actions.onJoinRoom).toHaveBeenCalledWith(ROOMS[1]));
	});
});
