import { describe, expect, it, vi } from 'vitest';
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
	const history = { location: { pathname: '/konto' }, push: vi.fn(), replace: vi.fn() };
	return { store, sendMessage, actions: new AppActions(store, client, history) };
}

describe('community actions', () => {
	it('adds and removes list entries at KGS', () => {
		const { sendMessage, actions } = setup();
		actions.onAddFriend('censored', ' troll ', 'stört im Raum');
		expect(sendMessage).toHaveBeenCalledWith({
			type: 'FRIEND_ADD',
			friendType: 'censored',
			name: 'troll',
			text: 'stört im Raum'
		});
		actions.onRemoveFriend('buddy', 'thirdstep');
		expect(sendMessage).toHaveBeenCalledWith({
			type: 'FRIEND_REMOVE',
			friendType: 'buddy',
			name: 'thirdstep'
		});
	});

	it('leaves a message, deletes the mailbox, asks for statistics', () => {
		const { store, sendMessage, actions } = setup();
		actions.onLeaveMessage('guiguistar', 'Partie fortsetzen?');
		expect(sendMessage).toHaveBeenCalledWith({
			type: 'MESSAGE_CREATE',
			name: 'guiguistar',
			text: 'Partie fortsetzen?'
		});
		store.dispatch({
			type: 'MESSAGES',
			messages: [{ time: 'x', user: { name: 'a' }, text: 'hi' }]
		});
		actions.onDeleteMailbox();
		expect(sendMessage).toHaveBeenCalledWith({ type: 'MESSAGE_DELETE' });
		expect(store.getState().mailbox).toEqual([]);
		actions.onRequestServerStats();
		expect(sendMessage).toHaveBeenCalledWith({ type: 'REQUEST_SERVER_STATS' });
	});

	it('creates a temporary room', () => {
		const { sendMessage, actions } = setup();
		actions.onCreateRoom('Andys Lernraum', 'Zum Nachbesprechen', true);
		expect(sendMessage).toHaveBeenCalledWith({
			type: 'CREATE_ROOM_REQUEST',
			name: 'Andys Lernraum',
			description: 'Zum Nachbesprechen',
			category: 'TEMPORARY',
			locale: '',
			private: true,
			tournOnly: false,
			globalOnly: false
		});
	});
});

describe('no conversations', () => {
	const convoJoin = (callbackKey?: number) => ({
		type: 'CONVO_JOIN',
		channelId: 321,
		user: { name: 'chatty', rank: '3k', flags: 'c' },
		...(callbackKey ? { callbackKey } : {})
	});

	it('declines a new private chat while switched on', () => {
		localStorage.setItem('gotv.noChats', '1');
		try {
			const { store, sendMessage, actions } = setup();
			actions.onReceiveServerMessages([
				convoJoin(),
				{ type: 'CHAT', channelId: 321, user: { name: 'chatty' }, text: 'Hallo?' }
			]);
			expect(sendMessage).toHaveBeenCalledWith({ type: 'CONVO_NO_CHATS', channelId: 321 });
			expect(store.getState().conversationsById[321]?.status).toBe('closed');
			expect(store.getState().communityResult).toMatchObject({
				type: 'CHAT_DECLINED',
				name: 'chatty'
			});
		} finally {
			localStorage.removeItem('gotv.noChats');
		}
	});

	it('keeps chats when switched off', () => {
		const { sendMessage, actions } = setup();
		actions.onReceiveServerMessages([convoJoin()]);
		expect(sendMessage).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: 'CONVO_NO_CHATS' })
		);
	});

	it('marks a chat the other player declined', () => {
		const { store, actions } = setup();
		actions.onReceiveServerMessages([convoJoin(7), { type: 'CONVO_NO_CHATS', channelId: 321 }]);
		expect(store.getState().conversationsById[321]).toMatchObject({
			chatsDisabled: true,
			declinedByOther: true
		});
	});
});
