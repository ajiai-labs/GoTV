<script lang="ts">
	// KGS chat: the joined rooms and private chats on the left (with unseen
	// counts), the open one on the right. "Raum betreten …" lists all rooms.
	// On phones (as before) either the list or one chat, with a banner on top:
	// "Chats" goes back to the list, the room name shows the room's users.
	import { onMount } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { app } from '#lib/app.svelte.ts';
	import type { Conversation, GameChannel, Room, User } from '#lib/model/types.ts';
	import { sortUsers } from '#lib/model/user.ts';
	import KgsGate from '#lib/ui/KgsGate.svelte';
	import Modal from '#lib/ui/Modal.svelte';
	import UnseenBadge from '#lib/ui/UnseenBadge.svelte';
	import UserName from '#lib/ui/UserName.svelte';
	import UserList from '#lib/ui/user/UserList.svelte';
	import ChatRoomList from '#lib/ui/chat/ChatRoomList.svelte';
	import CreateRoomForm from '#lib/ui/community/CreateRoomForm.svelte';
	import RoomChat from '#lib/ui/chat/RoomChat.svelte';
	import UserChat from '#lib/ui/chat/UserChat.svelte';
	import { userStatusText } from '#lib/ui/chat/userStatus.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	// Space kept free under the chat (the layout's bottom padding).
	const BOTTOM_SPACE = 32;

	// The old chat switched to its phone layout at 736 px (isMobileScreen).
	const phone = new MediaQuery('(max-width: 736px)');

	let showingList = $state(false);
	let showingRoomUsers = $state(false);
	let showingRoomList = $state(false);
	let creatingRoom = $state(false);

	// The old ChatScreen._getState: rooms first, then private chats; without
	// an active conversation the first room is the active one.
	let chat = $derived.by(() => {
		const {
			channelMembership,
			conversationsById,
			roomsById,
			usersByName,
			gamesById,
			activeConversationId: storedId
		} = app.state;
		let activeConversationId = storedId;
		const roomConvs: Array<Conversation> = [];
		const userConvs: Array<Conversation> = [];
		const activeRoomGames: Array<GameChannel> = [];
		let activeConv: Conversation | null = null;
		let activeRoom: Room | null = null;
		let activeUser: User | null = null;
		for (const chanId of Object.keys(channelMembership)) {
			const chan = channelMembership[chanId];
			const conv = conversationsById[chanId] as Conversation | undefined;
			if (!conv || conv.status === 'closed') continue;
			if (chan.type === 'room') {
				if (!activeConversationId) activeConversationId = conv.id;
				if (activeConversationId === conv.id) {
					activeConv = conv;
					activeRoom = roomsById[conv.id] ?? null;
					for (const game of Object.values(gamesById)) {
						if (game.roomId === conv.id) activeRoomGames.push(game);
					}
				}
				roomConvs.push(conv);
			} else if (chan.type === 'conversation') {
				userConvs.push(conv);
				if (activeConversationId === conv.id && conv.user) {
					activeConv = conv;
					activeUser = usersByName[conv.user] ?? null;
				}
			}
		}
		return {
			roomConvs,
			userConvs,
			activeConv,
			activeRoom,
			activeRoomGames,
			activeUser,
			activeConversationId
		};
	});

	let tabs = $derived([
		...chat.roomConvs.map((conversation) => ({
			conversation,
			room: (app.state.roomsById[conversation.id] as Room | undefined) ?? null,
			user: null
		})),
		...chat.userConvs.map((conversation) => ({
			conversation,
			room: null,
			user: conversation.user
				? ((app.state.usersByName[conversation.user] as User | undefined) ?? null)
				: null
		}))
	]);

	// All unseen messages (the "Chats" button on phones).
	let unseen = $derived.by(() => {
		let major = 0;
		let minor = 0;
		for (const convo of Object.values(app.state.conversationsById)) {
			if (!convo.unseenCount) continue;
			if (convo.user) major += convo.unseenCount;
			else minor += convo.unseenCount;
		}
		return { major, minor };
	});

	let roomUsers = $derived.by(() => {
		const room = chat.activeRoom;
		if (!showingRoomUsers || !room || !room.users) return [];
		const users = room.users
			.map((name) => app.state.usersByName[name] as User | undefined)
			.filter((user): user is User => !!user);
		sortUsers(users);
		return users;
	});

	// On phones: the list, when asked for or when no chat is open.
	let listView = $derived(phone.current && (showingList || !chat.activeConv));
	let usersView = $derived(phone.current && showingRoomUsers && !!chat.activeRoom);

	// As before: opening the chat and leaving it marks the open conversation seen.
	onMount(() => {
		markSeen();
		return markSeen;
	});

	function markSeen() {
		const id = chat.activeConversationId;
		if (id && app.started) app.actions.markConversationSeen(id);
	}

	function selectConversation(conversationId: number) {
		showingList = false;
		app.actions.onSelectConversation(conversationId);
	}

	function closeConversation(conversationId: number) {
		app.actions.onCloseConversation(conversationId);
	}

	function sendChat(body: string) {
		const { activeConversationId, activeUser } = chat;
		if (!activeConversationId) return;
		if (activeUser && (!activeUser.flags || !activeUser.flags.connected)) return;
		app.actions.onSendChat(body, activeConversationId);
	}

	function showRoomList() {
		app.actions.onFetchRoomList();
		showingRoomList = true;
	}

	function joinRoom(room: Room) {
		showingRoomList = false;
		app.actions.onJoinRoom(room);
	}

	function userCount(room: Room | null): string | null {
		if (!room || !room.users) return null;
		return t('chat.page.userCount', { count: room.users.length });
	}

	// The chat fills the window below the header: messages scroll inside.
	function fillWindow(element: HTMLElement) {
		const measure = () => {
			const top = element.getBoundingClientRect().top + window.scrollY;
			element.style.setProperty('--chat-top', `${Math.round(top + BOTTOM_SPACE)}px`);
		};
		measure();
		// The offline note above the page comes and goes with the connection.
		const observer = new ResizeObserver(measure);
		observer.observe(document.body);
		window.addEventListener('resize', measure);
		return () => {
			observer.disconnect();
			window.removeEventListener('resize', measure);
		};
	}
</script>

<svelte:head>
	<title>{t('chat.page.pageTitle')}</title>
</svelte:head>

{#snippet tabList()}
	<ul class="ChatScreen-tabs" aria-label={t('chat.page.tabs')}>
		{#each tabs as tab (tab.conversation.id)}
			{@const conversation = tab.conversation}
			{@const active = chat.activeConversationId === conversation.id}
			{@const unseenCount = conversation.unseenCount ?? 0}
			<li class="ChatScreen-tab" class:ChatScreen-tab-active={active}>
				<button
					type="button"
					class="ChatScreen-tab-label"
					aria-current={active ? 'true' : undefined}
					onclick={() => selectConversation(conversation.id)}
				>
					<span class="ChatScreen-tab-name">
						{#if unseenCount}
							<UnseenBadge
								major={conversation.user ? unseenCount : 0}
								minor={conversation.user ? 0 : unseenCount}
							/>
						{/if}
						{#if tab.user}
							<UserName user={tab.user} />
						{:else if tab.room}
							<span>{tab.room.name}{tab.room.private ? ' 🔒' : ''}</span>
						{:else}
							<span>{t('chat.page.empty')}</span>
						{/if}
					</span>
					<span class="ChatScreen-tab-info">
						{#if tab.room}
							{userCount(tab.room) ?? '…'}
						{:else if tab.user}
							{userStatusText(tab.user)}
						{/if}
					</span>
				</button>
				<button
					type="button"
					class="ChatScreen-tab-close"
					aria-label={tab.room ? t('chat.page.leaveRoom') : t('chat.page.closeConversation')}
					title={tab.room ? t('chat.page.leaveRoom') : t('chat.page.closeConversation')}
					onclick={() => closeConversation(conversation.id)}
				>
					×
				</button>
			</li>
		{/each}
		<li class="ChatScreen-tab ChatScreen-tab-join">
			<button type="button" class="ChatScreen-tab-label" onclick={showRoomList}>
				{t('chat.page.joinRoom')}
			</button>
		</li>
	</ul>
{/snippet}

{#snippet banner()}
	<div class="ChatScreen-banner">
		{#if usersView}
			<button type="button" class="ChatScreen-back" onclick={() => (showingRoomUsers = false)}>
				<span aria-hidden="true">‹</span>
				{t('chat.page.back')}
			</button>
			<span class="ChatScreen-banner-title">
				{userCount(chat.activeRoom) ?? t('chat.page.roomUsers')}
			</span>
		{:else}
			<button type="button" class="ChatScreen-back" onclick={() => (showingList = true)}>
				<span aria-hidden="true">‹</span>
				{t('chat.page.chats')}
				<UnseenBadge major={unseen.major} minor={unseen.minor} />
			</button>
			{#if chat.activeRoom}
				<button
					type="button"
					class="ChatScreen-banner-title"
					aria-label={t('chat.page.showRoomUsers', { room: chat.activeRoom.name ?? '' })}
					onclick={() => (showingRoomUsers = true)}
				>
					{chat.activeRoom.name}{chat.activeRoom.private ? ' 🔒' : ''}
					{#if userCount(chat.activeRoom)}
						<span class="ChatScreen-banner-info">{userCount(chat.activeRoom)}</span>
					{/if}
				</button>
			{:else if chat.activeUser}
				<span class="ChatScreen-banner-title">
					<UserName user={chat.activeUser} extraIcons />
					<span class="ChatScreen-banner-info">{userStatusText(chat.activeUser)}</span>
				</span>
			{/if}
		{/if}
	</div>
{/snippet}

<KgsGate>
	<h1 class="visually-hidden">{t('chat.page.title')}</h1>
	<div class="ChatScreen panel" class:ChatScreen-phone={phone.current} {@attach fillWindow}>
		{#if listView}
			<div class="ChatScreen-list">
				{@render tabList()}
			</div>
		{:else}
			{#if phone.current}
				{@render banner()}
			{:else}
				<div class="ChatScreen-side">
					{@render tabList()}
				</div>
			{/if}
			<div class="ChatScreen-active-chat">
				{#if usersView}
					<div class="ChatScreen-room-users">
						<UserList users={roomUsers} />
					</div>
				{:else if chat.activeConv && chat.activeUser}
					<UserChat user={chat.activeUser} conversation={chat.activeConv} onSendChat={sendChat} />
				{:else if chat.activeConv && chat.activeRoom}
					<RoomChat
						room={chat.activeRoom}
						conversation={chat.activeConv}
						games={chat.activeRoomGames}
						onSendChat={sendChat}
					/>
				{:else}
					<p class="ChatScreen-empty muted">
						{t('chat.page.noChat')}
					</p>
				{/if}
			</div>
		{/if}
	</div>

	{#if showingRoomList}
		<Modal
			title={t('chat.page.rooms')}
			onclose={() => {
				showingRoomList = false;
				creatingRoom = false;
			}}
		>
			{#if creatingRoom}
				<CreateRoomForm />
			{:else}
				<button
					type="button"
					class="button ChatScreen-create-room"
					onclick={() => {
						app.actions.onClearCommunityResult();
						creatingRoom = true;
					}}
				>
					+ {t('community.room.title')}
				</button>
				<ChatRoomList roomsById={app.state.roomsById} onJoinRoom={joinRoom} />
			{/if}
		</Modal>
	{/if}
</KgsGate>

<style>
	.ChatScreen-create-room {
		margin-bottom: 10px;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.ChatScreen {
		display: grid;
		grid-template-columns: 230px minmax(0, 1fr);
		height: calc(100dvh - var(--chat-top, 120px));
		min-height: 360px;
	}

	.ChatScreen-phone {
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: auto minmax(0, 1fr);
	}

	.ChatScreen-side {
		border-right: 1px solid var(--rule);
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.ChatScreen-list {
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.ChatScreen-active-chat {
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	.ChatScreen-tabs {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.ChatScreen-tab {
		display: flex;
		align-items: stretch;
		border-bottom: 1px solid var(--rule);
	}

	.ChatScreen-tab-label {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		min-height: 44px;
		padding: 10px 4px 10px 16px;
		border: 0;
		background: none;
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}

	.ChatScreen-tab-name {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.ChatScreen-tab-info {
		color: var(--ink-soft);
		font-size: 0.87em;
	}

	.ChatScreen-tab-close {
		flex: none;
		width: 40px;
		border: 0;
		background: none;
		color: var(--ink-soft);
		font-size: 1.2rem;
		cursor: pointer;
	}

	.ChatScreen-tab-close:hover {
		color: var(--ink);
	}

	.ChatScreen-tab:hover {
		background: var(--surface-sunk);
	}

	.ChatScreen-tab-active,
	.ChatScreen-tab-active:hover {
		background: var(--accent-soft);
	}

	.ChatScreen-tab-active .ChatScreen-tab-name {
		font-weight: 700;
	}

	.ChatScreen-tab-join .ChatScreen-tab-label {
		justify-content: center;
		color: var(--accent);
		font-weight: 600;
	}

	.ChatScreen-banner {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		padding: 0 8px;
		border-bottom: 1px solid var(--rule);
	}

	.ChatScreen-back {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: 4px;
		min-height: 40px;
		padding: 0 8px;
		border: 0;
		background: none;
		color: var(--accent);
		font-weight: 650;
		cursor: pointer;
	}

	.ChatScreen-back span[aria-hidden] {
		font-size: 1.4em;
		line-height: 1;
	}

	.ChatScreen-banner-title {
		display: flex;
		flex: 1;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		min-width: 0;
		min-height: 40px;
		padding: 10px 4px;
		border: 0;
		background: none;
		color: var(--ink);
		font-weight: 650;
		text-align: left;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	button.ChatScreen-banner-title {
		cursor: pointer;
	}

	.ChatScreen-banner-info {
		flex: none;
		color: var(--ink-soft);
		font-size: 0.85em;
		font-weight: 400;
	}

	.ChatScreen-room-users {
		height: 100%;
		padding: 8px;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.ChatScreen-empty {
		margin: 0;
		padding: 24px 16px;
	}

	:global([data-design='oldschool']) .ChatScreen-side {
		border-right: 2px solid var(--bevel-dark, #808080);
	}

	:global([data-design='oldschool']) .ChatScreen-tab {
		border-bottom-color: #808080;
	}

	:global([data-design='oldschool']) .ChatScreen-tab-label {
		min-height: 36px;
		padding: 4px 4px 4px 8px;
	}

	:global([data-design='oldschool']) .ChatScreen-tab-active,
	:global([data-design='oldschool']) .ChatScreen-tab-active:hover {
		background: var(--accent);
	}

	:global([data-design='oldschool']) .ChatScreen-tab-active .ChatScreen-tab-label,
	:global([data-design='oldschool']) .ChatScreen-tab-active .ChatScreen-tab-info,
	:global([data-design='oldschool']) .ChatScreen-tab-active .ChatScreen-tab-close {
		color: var(--accent-ink);
	}

	:global([data-design='oldschool']) .ChatScreen-banner {
		background: var(--title-bar);
		color: var(--title-ink);
	}

	:global([data-design='oldschool']) .ChatScreen-back,
	:global([data-design='oldschool']) .ChatScreen-banner-title,
	:global([data-design='oldschool']) .ChatScreen-banner-info {
		color: var(--title-ink);
	}
</style>
