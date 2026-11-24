<script lang="ts">
	// The chat of a KGS room: description (with "N Partien" / "N
	// Herausforderungen"), messages with the room's games mixed in, input line
	// and - not on phones - the users of the room at the side.
	import { MediaQuery } from 'svelte/reactivity';
	import { app } from '#lib/app.svelte.ts';
	import type {
		Conversation,
		GameChannel,
		GameFilter,
		Index,
		Room,
		User
	} from '#lib/model/types.ts';
	import { sortUsers } from '#lib/model/user.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import RichContent from '#lib/ui/RichContent.svelte';
	import UserList from '#lib/ui/user/UserList.svelte';
	import ChatMessages from './ChatMessages.svelte';
	import ChatMessageBar from './ChatMessageBar.svelte';
	import RoomGameLinks from './RoomGameLinks.svelte';
	import { keepNewestInView } from './keepNewestInView.svelte.ts';

	// Mixing more games into the chat would bury the messages (as before).
	const MAX_GAMES_IN_CHAT = 20;

	let {
		room,
		conversation,
		games = null,
		currentUser,
		usersByName,
		onUserDetail,
		onSendChat
	}: {
		room: Room;
		conversation: Conversation;
		games?: Array<GameChannel> | null;
		// Defaults (as in ChatMessages): the app's user, users and user details.
		currentUser?: User | null;
		usersByName?: Index<User>;
		onUserDetail?: (name: string) => unknown;
		onSendChat: (body: string) => unknown;
	} = $props();

	// The old chat checked the screen width (isMobileScreen, 736 px).
	const phone = new MediaQuery('(max-width: 736px)');

	let users = $derived.by(() => {
		if (!room.users) return null;
		const known = usersByName ?? app.state.usersByName;
		const list = room.users.map((name) => known[name]).filter((user): user is User => !!user);
		sortUsers(list);
		return list;
	});

	let description = $derived(room.description ? room.description.replace(/[\r\n]+$/, '') : '');

	function showUser(name: string) {
		if (onUserDetail) onUserDetail(name);
		else app.actions.onUserDetail(name);
	}

	function showUserDetail(user: User) {
		showUser(user.name);
	}

	function onJoinGame(gameId: number | string) {
		app.actions.onJoinGame(gameId);
	}

	function onSelectChallenge(gameId: number) {
		app.actions.onSelectChallenge(gameId);
	}

	function showGames(selected: Array<GameChannel>) {
		const filter: GameFilter = {
			roomId: room.id,
			type: selected.length && selected[0].type === 'challenge' ? 'challenge' : 'game'
		};
		app.actions.onShowGames(filter);
	}
</script>

<div class="RoomChat" class:RoomChat-with-sidebar={!phone.current}>
	<div
		class="RoomChat-messages-container"
		{@attach keepNewestInView(() => [conversation.id, conversation.messages.length])}
	>
		{#if description}
			<div class="RoomChat-desc">
				<RichContent content={description} firstLineHeading />
				{#if games && games.length}
					<RoomGameLinks {games} onSelect={showGames} />
				{/if}
			</div>
		{/if}
		<div class="RoomChat-messages">
			<ChatMessages
				{currentUser}
				messages={conversation.messages}
				{usersByName}
				games={games && games.length < MAX_GAMES_IN_CHAT ? games : null}
				{onUserDetail}
				{onJoinGame}
				{onSelectChallenge}
			/>
		</div>
	</div>
	<div class="RoomChat-message-bar">
		<ChatMessageBar {conversation} onSubmit={onSendChat} />
	</div>
	{#if !phone.current}
		<aside class="RoomChat-sidebar" aria-label={t('chat.page.roomUsers')}>
			{#if users}
				<UserList {users} onSelectUser={showUserDetail} />
			{/if}
		</aside>
	{/if}
</div>

<style>
	.RoomChat {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr) auto;
		height: 100%;
		min-height: 0;
	}

	.RoomChat-with-sidebar {
		grid-template-columns: minmax(0, 1fr) 210px;
	}

	.RoomChat-messages-container {
		grid-column: 1;
		grid-row: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.RoomChat-desc {
		margin: 12px 12px 0;
		padding: 12px 16px;
		border-radius: var(--radius-m);
		background: var(--surface-sunk);
		line-height: 1.35;
		overflow-wrap: anywhere;
	}

	.RoomChat-desc :global(h1),
	.RoomChat-desc :global(h2),
	.RoomChat-desc :global(h3),
	.RoomChat-desc :global(h4) {
		margin-top: 0;
	}

	.RoomChat-messages {
		padding: 16px;
	}

	.RoomChat-message-bar {
		grid-column: 1;
		grid-row: 2;
		padding: 10px 12px;
		border-top: 1px solid var(--rule);
	}

	.RoomChat-sidebar {
		grid-column: 2;
		grid-row: 1 / span 2;
		padding: 8px 4px;
		border-left: 1px solid var(--rule);
		overflow-x: hidden;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		font-size: 0.93em;
	}

	@media (max-width: 736px) {
		.RoomChat-desc {
			margin: 8px 8px 0;
		}

		.RoomChat-messages {
			padding: 12px 10px;
		}
	}

	:global([data-design='oldschool']) .RoomChat-desc {
		border: 2px inset #ece9e2;
		background: var(--surface-sunk);
	}

	:global([data-design='oldschool']) .RoomChat-messages-container {
		background: var(--surface-sunk);
	}

	:global([data-design='oldschool']) .RoomChat-message-bar {
		padding: 4px;
	}

	:global([data-design='oldschool']) .RoomChat-sidebar {
		border-left: 2px solid #808080;
		background: var(--surface-sunk);
	}
</style>
