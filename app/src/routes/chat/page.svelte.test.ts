import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { app } from '#lib/app.svelte.ts';
import { AppActions } from '#lib/model/AppActions.ts';
import { AppStore } from '#lib/model/AppStore.ts';
import type { KgsClient } from '#lib/model/KgsClient.ts';
import { getInitialState } from '#lib/model/appState.ts';
import { handleMessage } from '#lib/model/index.ts';
import type {
	AppState,
	Conversation,
	ConversationMessage,
	GameChannel,
	Room,
	User
} from '#lib/model/types.ts';
import Page from './+page.svelte';

const me: User = { name: 'gotvfan', rank: '3k', rankVal: -3, flags: { connected: true } };
const anna: User = { name: 'anna', rank: '2d', rankVal: 2, flags: { connected: true } };
const bernd: User = { name: 'bernd', rank: '5k', rankVal: -5, flags: { connected: true } };

const DGOB = 10;
const ENGLISH = 11;
const ANNA_CHAT = 20;

function room(id: number, name: string, extra: Partial<Room> = {}): Room {
	return {
		id,
		name,
		description: null,
		owners: null,
		users: null,
		category: 'NATIONAL',
		...extra
	};
}

function message(id: string, sender: string, body: string, minute = 0): ConversationMessage {
	return { id, sender, body, date: new Date(2026, 10, 24, 18, minute) };
}

function conversation(id: number, extra: Partial<Conversation> = {}): Conversation {
	return { id, status: 'created', messages: [], ...extra };
}

const game: GameChannel = {
	id: 77,
	type: 'ranked',
	time: new Date(2026, 10, 24, 18, 2).getTime(),
	players: { white: anna, black: bernd },
	moveNum: 0,
	roomId: DGOB
};

function fixtureState(): AppState {
	const initial = getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 });
	return {
		...initial,
		initialized: true,
		nav: 'chat',
		currentUser: me,
		usersByName: { gotvfan: me, anna, bernd },
		roomsById: {
			[DGOB]: room(DGOB, 'Deutscher Go-Bund', {
				description: 'Willkommen\nDer Raum des DGoB.',
				users: ['anna', 'bernd', 'gotvfan']
			}),
			[ENGLISH]: room(ENGLISH, 'English Game Room', { category: 'MAIN', users: ['anna'] }),
			30: room(30, 'Go-Club Berlin', { category: 'CLUBS', private: true }),
			31: room(31, 'Turnierraum', { category: 'TOURNAMENT' })
		},
		channelMembership: {
			[DGOB]: { type: 'room', complete: true, stale: false },
			[ENGLISH]: { type: 'room', complete: true, stale: false },
			[ANNA_CHAT]: { type: 'conversation', complete: true, stale: false }
		},
		conversationsById: {
			[DGOB]: conversation(DGOB, {
				messages: [
					message('1', 'anna', 'Hallo zusammen', 1),
					message('2', 'gotvfan', 'Hallo Anna', 3)
				]
			}),
			[ENGLISH]: conversation(ENGLISH, { unseenCount: 3 }),
			[ANNA_CHAT]: conversation(ANNA_CHAT, {
				user: 'anna',
				unseenCount: 2,
				messages: [message('3', 'anna', 'Spielen wir?', 4)]
			})
		},
		gamesById: { 77: game },
		activeConversationId: DGOB
	};
}

function mockActions() {
	const actions = {
		onSelectConversation: vi.fn(),
		onCloseConversation: vi.fn(),
		markConversationSeen: vi.fn(),
		onSendChat: vi.fn(),
		onFetchRoomList: vi.fn(),
		onJoinRoom: vi.fn(),
		onJoinGame: vi.fn(),
		onSelectChallenge: vi.fn(),
		onShowGames: vi.fn(),
		onUserDetail: vi.fn(),
		onOpenTvStream: vi.fn()
	};
	app._actions = actions as unknown as AppActions;
	return actions;
}

describe('Chat page', () => {
	beforeEach(async () => {
		await page.viewport(1180, 820);
		app.state = fixtureState();
	});

	afterEach(() => {
		app._actions = null;
	});

	it('lists rooms and private chats with unseen badges and shows the open room', async () => {
		const actions = mockActions();
		await render(Page);
		const tabs = page.getByRole('list', { name: 'Räume und Gespräche' });
		await expect.element(tabs.getByRole('button', { name: /Deutscher Go-Bund/ })).toBeVisible();
		await expect
			.element(tabs.getByRole('button', { name: /^3 neu English Game Room/ }))
			.toBeVisible();
		await expect.element(tabs.getByRole('button', { name: /^2 neu anna/ })).toBeVisible();
		await expect.element(tabs.getByText('3 Nutzer')).toBeVisible();
		// The open room: description, games link, messages, users at the side
		await expect.element(page.getByText(/Der Raum des DGoB/)).toBeVisible();
		await expect.element(page.getByRole('button', { name: '1 Partie' })).toBeVisible();
		await expect.element(page.getByText('Hallo zusammen')).toBeVisible();
		// Sorted by rank, as before
		const sidebar = page.getByRole('complementary', { name: 'Nutzer im Raum' });
		await expect.poll(() => sidebar.element().textContent).toMatch(/anna.*gotvfan.*bernd/s);
		expect(actions.markConversationSeen).toHaveBeenCalledWith(DGOB);
	});

	it('selecting a conversation calls onSelectConversation', async () => {
		const actions = mockActions();
		await render(Page);
		await page.getByRole('button', { name: /anna/ }).first().click();
		expect(actions.onSelectConversation).toHaveBeenCalledWith(ANNA_CHAT);
	});

	it('shows a private chat with status and profile button', async () => {
		const actions = mockActions();
		app.state = { ...fixtureState(), activeConversationId: ANNA_CHAT };
		await render(Page);
		await expect.element(page.getByText('Spielen wir?')).toBeVisible();
		await expect.element(page.getByText('· Online')).toBeVisible();
		await page.getByRole('button', { name: 'Profil ansehen' }).click();
		expect(actions.onUserDetail).toHaveBeenCalledWith('anna');
	});

	it('sending a message calls onSendChat for the open conversation', async () => {
		const actions = mockActions();
		await render(Page);
		const input = page.getByRole('textbox', { name: 'Chatnachricht' });
		await input.fill('Wer spielt heute?');
		await userEvent.keyboard('{Enter}');
		expect(actions.onSendChat).toHaveBeenCalledWith('Wer spielt heute?', DGOB);
		await expect.element(input).toHaveValue('');
	});

	it('the games link shows the room games, a game in the chat opens it', async () => {
		const actions = mockActions();
		await render(Page);
		await page.getByRole('button', { name: '1 Partie' }).click();
		expect(actions.onShowGames).toHaveBeenCalledWith({ roomId: DGOB, type: 'game' });
		await page.getByRole('button', { name: /bernd/ }).first().click();
		expect(actions.onJoinGame).toHaveBeenCalledWith(77);
	});

	it('leaving a room closes the conversation and unjoins the channel', async () => {
		const store = new AppStore(handleMessage, fixtureState());
		const sendMessage = vi.fn();
		const client = { sendMessage } as unknown as KgsClient;
		const history = { location: { pathname: '/chat' }, push: vi.fn(), replace: vi.fn() };
		app._actions = new AppActions(store, client, history);
		store.subscribe(() => {
			app.state = store.getState();
		});
		app.state = store.getState();
		await render(Page);
		await page.getByRole('button', { name: 'Raum verlassen' }).first().click();
		expect(sendMessage).toHaveBeenCalledWith({ type: 'UNJOIN_REQUEST', channelId: DGOB });
		await expect
			.element(page.getByRole('list', { name: 'Räume und Gespräche' }))
			.not.toHaveTextContent('Deutscher Go-Bund');
	});

	it('the room list fetches rooms, filters by search and joins a room', async () => {
		const actions = mockActions();
		await render(Page);
		await page.getByRole('button', { name: 'Raum betreten …' }).click();
		expect(actions.onFetchRoomList).toHaveBeenCalled();
		const dialog = page.getByRole('dialog', { name: 'Räume' });
		await expect.element(dialog.getByRole('heading', { name: 'Vereine' })).toBeVisible();
		await expect.element(dialog.getByRole('button', { name: /^Go-Club Berlin/ })).toBeVisible();
		await dialog.getByRole('searchbox', { name: 'Räume suchen' }).fill('o');
		await expect
			.element(dialog.getByRole('button', { name: 'Turnierraum' }))
			.not.toBeInTheDocument();
		// Every match stays (the old "gi" regex skipped every second one).
		await expect.element(dialog.getByRole('button', { name: /^Go-Club Berlin/ })).toBeVisible();
		await expect.element(dialog.getByRole('button', { name: /^Deutscher Go-Bund/ })).toBeVisible();
		await expect.element(dialog.getByRole('button', { name: /^English Game Room/ })).toBeVisible();
		await dialog.getByRole('button', { name: /^Go-Club Berlin/ }).click();
		expect(actions.onJoinRoom).toHaveBeenCalledWith(expect.objectContaining({ id: 30 }));
		await expect.element(dialog).not.toBeInTheDocument();
	});

	it('keeps the newest message in view', async () => {
		mockActions();
		const many = Array.from({ length: 60 }, (_, i) => message(`m${i}`, 'anna', `Nachricht ${i}`));
		const state = fixtureState();
		app.state = {
			...state,
			conversationsById: {
				...state.conversationsById,
				[DGOB]: conversation(DGOB, { messages: many })
			}
		};
		await render(Page);
		const container = document.querySelector('.RoomChat-messages-container') as HTMLElement;
		await vi.waitFor(() => {
			expect(container.scrollTop + container.clientHeight).toBeGreaterThan(
				container.scrollHeight - 2
			);
		});
		container.scrollTop = 0;
		app.state = {
			...app.state,
			conversationsById: {
				...app.state.conversationsById,
				[DGOB]: conversation(DGOB, { messages: [...many, message('neu', 'bernd', 'Neu!')] })
			}
		};
		await expect.element(page.getByText('Neu!')).toBeInTheDocument();
		await vi.waitFor(() => {
			expect(container.scrollTop + container.clientHeight).toBeGreaterThan(
				container.scrollHeight - 2
			);
		});
	});
});

describe('Chat page on a phone', () => {
	beforeEach(async () => {
		await page.viewport(390, 844);
		app.state = fixtureState();
	});

	afterEach(() => {
		app._actions = null;
	});

	it('switches between the list and one chat, and shows the room users', async () => {
		const actions = mockActions();
		await render(Page);
		// One chat with a banner, no list, no user sidebar
		await expect.element(page.getByText('Hallo zusammen')).toBeVisible();
		await expect
			.element(page.getByRole('list', { name: 'Räume und Gespräche' }))
			.not.toBeInTheDocument();
		await expect
			.element(page.getByRole('complementary', { name: 'Nutzer im Raum' }))
			.not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Chats 2 neu' })).toBeVisible();

		await page.getByRole('button', { name: /Nutzer im Raum Deutscher Go-Bund/ }).click();
		await expect.element(page.getByRole('button', { name: /^bernd/ })).toBeVisible();
		await page.getByRole('button', { name: /Zurück/ }).click();
		await expect.element(page.getByText('Hallo zusammen')).toBeVisible();

		await page.getByRole('button', { name: /Chats/ }).click();
		const tabs = page.getByRole('list', { name: 'Räume und Gespräche' });
		await expect.element(tabs).toBeVisible();
		await tabs.getByRole('button', { name: /anna/ }).click();
		expect(actions.onSelectConversation).toHaveBeenCalledWith(ANNA_CHAT);
		await expect.element(tabs).not.toBeInTheDocument();
	});
});
