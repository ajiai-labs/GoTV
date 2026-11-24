<script lang="ts">
	// A KGS game, watched or played. The board takes the space on the left
	// (as high as the window allows), beside it players and clocks, the move
	// bar (watching) or the game buttons (playing), the observers and the
	// game chat with the game info. On narrow screens the board comes first
	// and chat, info and observers are tabs below it.
	//
	// Playing: a click on a free point on your move plays there (a ghost
	// stone shows where); while scoring, a click marks a group dead or alive.
	// A watched game that belongs to a live broadcast shows the stream above
	// the board (two-click embed).
	import { onMount, tick } from 'svelte';
	import { app } from '#lib/app.svelte.ts';
	import {
		getGameChatSections,
		getGameLine,
		getGamePlayerRole,
		getGameRoleColor,
		isGameScoring,
		isPlayerMove
	} from '#lib/model/game/tree.ts';
	import { kgsTvSource } from '#lib/model/TvSource.ts';
	import type { TvEvent } from '#lib/model/tv.ts';
	import { sortUsers } from '#lib/model/user.ts';
	import type {
		BoardPointMark,
		GameChannel,
		Index,
		PlayerColor,
		Point,
		Room,
		User
	} from '#lib/model/types.ts';
	import ChatMessageBar from '#lib/ui/chat/ChatMessageBar.svelte';
	import StreamEmbed from '#lib/ui/tv/StreamEmbed.svelte';
	import UserList from '#lib/ui/user/UserList.svelte';
	import BoardContainer from './BoardContainer.svelte';
	import GameBoardNav from './GameBoardNav.svelte';
	import GameChat from './GameChat.svelte';
	import GameInfo from './GameInfo.svelte';
	import GameMoreMenu from './GameMoreMenu.svelte';
	import GamePlayActions from './GamePlayActions.svelte';
	import GamePlayersInfo from './GamePlayersInfo.svelte';
	import GameReplaySuggestion from './GameReplaySuggestion.svelte';
	import GameUndoPrompt from './GameUndoPrompt.svelte';
	import { formatScoreDe } from './gameText.ts';

	type Tab = 'chat' | 'info' | 'users';

	// Space the layout keeps below the page (padding of the app frame).
	const BOTTOM_SPACE = 32;
	const MIN_HEIGHT = 420;

	let {
		game,
		playing = false,
		tvEvents = [],
		currentUser: currentUserProp,
		usersByName: usersByNameProp,
		roomsById: roomsByIdProp
	}: {
		game: GameChannel;
		playing?: boolean;
		// Calendar events: a watched game of a live broadcast shows its stream.
		tvEvents?: Array<TvEvent>;
		// Defaults: from the app state.
		currentUser?: User;
		usersByName?: Index<User>;
		roomsById?: Index<Room>;
	} = $props();

	let currentUser = $derived(currentUserProp ?? app.state.currentUser ?? { name: '' });
	let usersByName = $derived(usersByNameProp ?? app.state.usersByName);
	let roomsById = $derived(roomsByIdProp ?? app.state.roomsById);

	let tab: Tab = $state('chat');
	let dismissedReplayForGameId: number | null = $state(null);
	let screenEl: HTMLElement | undefined = $state();
	let chatScroll: HTMLElement | undefined = $state();
	let topOffset = $state(0);
	let innerHeight = $state(0);

	let tree = $derived(game.tree);
	let users = $derived.by(() => {
		const list = (game.users ?? [])
			.map((name) => usersByName[name])
			.filter((user): user is User => !!user);
		sortUsers(list);
		return list;
	});
	let moveNum = $derived(
		playing && tree ? getGameLine(tree, tree.activeNode).length - 1 : undefined
	);
	let isOurMove = $derived(playing && !!tree && isPlayerMove(game, currentUser.name));
	let scoring = $derived(isGameScoring(game));
	let playerColor: PlayerColor | null = $derived.by(() => {
		const role = getGamePlayerRole(currentUser.name, game.players);
		return (role && getGameRoleColor(role)) || null;
	});
	let isRengo = $derived(!!game.players.white_2);
	let liveEvent = $derived(
		!playing && game.event
			? kgsTvSource.getLiveEventForGame(game, tvEvents, roomsById, new Date())
			: null
	);
	let chatSections = $derived(getGameChatSections(game));
	let showReplaySuggestion = $derived(
		!playing && !!game.over && !!tree && dismissedReplayForGameId !== game.id
	);
	let title = $derived.by(() => {
		if (game.over || game.score) {
			const score = game.score ? formatScoreDe(game.score) : '';
			if (game.over) return 'Partie beendet' + (score ? ': ' + score : '');
			return score;
		}
		return game.name || (moveNum ? `Zug ${moveNum}` : '');
	});

	// The chat follows new messages and moves with chat, as before.
	let chatSignature = $derived.by(() => {
		const last = chatSections[chatSections.length - 1];
		return `${chatSections.length}:${last?.messages?.length ?? 0}:${last?.actions.length ?? 0}`;
	});

	$effect(() => {
		void chatSignature;
		void tab;
		void tick().then(() => {
			if (chatScroll) chatScroll.scrollTop = chatScroll.scrollHeight;
		});
	});

	function measure() {
		if (screenEl) topOffset = screenEl.getBoundingClientRect().top + window.scrollY;
	}

	onMount(measure);

	let screenHeight = $derived(Math.max(MIN_HEIGHT, innerHeight - topOffset - BOTTOM_SPACE));

	function onLeave() {
		app.actions.onLeaveGame(game);
	}

	function onUserDetail(user: User) {
		app.actions.onUserDetail(user.name);
	}

	function onChat(body: string) {
		app.actions.onSendGameChat(body, game.id);
	}

	function onChangeCurrentNode(nodeId: number) {
		app.actions.onChangeCurrentNode(game, nodeId);
	}

	function onClickPoint(
		clicked: GameChannel,
		loc: Point,
		locColor?: PlayerColor | null,
		locMark?: BoardPointMark | null
	) {
		if (isGameScoring(clicked)) {
			const alive =
				locMark === 'blackTerritory' || locMark === 'whiteTerritory' || locMark === 'dead';
			app.actions.onMarkLife(clicked, loc, alive);
		} else if (!locColor) {
			const role = getGamePlayerRole(currentUser.name, clicked.players);
			app.actions.onPlayMove(clicked, loc, role ? getGameRoleColor(role) : null);
		}
	}

	function onAcceptUndo() {
		if (game.undoRequest) app.actions.onAcceptUndo(game);
	}

	function onDeclineUndo() {
		if (game.undoRequest) app.actions.onDeclineUndo(game);
	}

	const TABS: Array<{ id: Tab; label: () => string }> = [
		{ id: 'chat', label: () => 'Chat' },
		{ id: 'info', label: () => 'Info' },
		{ id: 'users', label: () => `${users.length} Beobachter` }
	];
</script>

<svelte:window bind:innerHeight onresize={measure} />

<div
	class="GameScreen"
	class:GameScreen-playing={playing}
	class:GameScreen-watching={!playing}
	class:GameScreen-rengo={isRengo}
	class:GameScreen-has-tv-stream={!!liveEvent}
	style:--game-height="{screenHeight}px"
	bind:this={screenEl}
>
	<header class="GameScreen-header">
		{#if !playing}
			<button type="button" class="GameScreen-back button" onclick={onLeave}>
				<span aria-hidden="true">‹</span> Zurück
			</button>
		{/if}
		<h1 class="GameScreen-title">{title}</h1>
		{#if !playing}
			<GameMoreMenu {game} {roomsById} />
		{/if}
	</header>

	<div class="GameScreen-main">
		<div class="GameScreen-board-column">
			{#if liveEvent}
				<section class="GameScreen-tv-stream" aria-label="Übertragung">
					<h2 class="GameScreen-tv-stream-title">Live: {liveEvent.name}</h2>
					<StreamEmbed event={liveEvent} />
				</section>
			{/if}
			<div class="GameScreen-board-area">
				<BoardContainer
					{game}
					{playing}
					ghost={isOurMove && !scoring ? playerColor : null}
					onClickPoint={isOurMove || scoring ? onClickPoint : undefined}
				/>
				{#if game.accessDenied}
					<p class="GameScreen-access-denied" role="alert">{game.accessDenied}</p>
				{/if}
				{#if game.undoRequest}
					<div class="GameScreen-overlay">
						<GameUndoPrompt
							role={game.undoRequest}
							onAccept={onAcceptUndo}
							onDecline={onDeclineUndo}
						/>
					</div>
				{:else if showReplaySuggestion}
					<div class="GameScreen-overlay">
						<GameReplaySuggestion
							onReplay={() => app.suggestGameReplay(game)}
							onDismiss={() => (dismissedReplayForGameId = game.id)}
						/>
					</div>
				{/if}
			</div>
		</div>

		<div class="GameScreen-side panel">
			<div class="GameScreen-controls">
				{#if playing}
					<GamePlayActions
						{currentUser}
						{game}
						{isOurMove}
						{scoring}
						onPass={app.actions.onPass}
						onUndo={app.actions.onUndo}
						onResign={app.actions.onResign}
						onLeaveGame={onLeave}
						onAddTime={app.actions.onAddGameTime}
						onDoneScoring={app.actions.onDoneScoring}
					/>
				{:else if tree}
					<GameBoardNav
						nodeId={tree.currentNode}
						currentLine={tree.currentLine}
						live={!game.over}
						{onChangeCurrentNode}
					/>
				{/if}
			</div>

			<div class="GameScreen-players-users">
				<div class="GameScreen-players">
					<GamePlayersInfo {game} {onUserDetail} />
				</div>
				<div class="GameScreen-tabs" role="tablist" aria-label="Ansicht">
					{#each TABS as item (item.id)}
						<button
							type="button"
							role="tab"
							class="GameScreen-tab"
							aria-selected={tab === item.id}
							onclick={() => (tab = item.id)}
						>
							{item.label()}
						</button>
					{/each}
				</div>
				<div class="GameScreen-users" class:GameScreen-tab-content={tab === 'users'}>
					<h2 class="GameScreen-side-title">{users.length} Beobachter</h2>
					<UserList {users} onSelectUser={onUserDetail} />
				</div>
			</div>

			<div
				class="GameScreen-chat GameScreen-tab-content-{tab}"
				class:GameScreen-tab-content={tab === 'chat' || tab === 'info'}
			>
				<div class="GameScreen-chat-scroll" bind:this={chatScroll}>
					{#if tree}
						<div class="GameScreen-chat-info">
							<GameInfo {game} {roomsById} />
						</div>
					{/if}
					{#if tab === 'chat'}
						<GameChat
							{currentUser}
							{chatSections}
							{usersByName}
							onUserDetail={app.actions.onUserDetail}
							onOpenTv={app.actions.onOpenTvStream}
						/>
					{/if}
				</div>
			</div>
			<div class="GameScreen-chat-message-bar" class:GameScreen-tab-content={tab === 'chat'}>
				<ChatMessageBar
					conversation={{ id: 0, messages: [], status: 'created', chatsDisabled: !tree }}
					onSubmit={onChat}
				/>
			</div>
		</div>
	</div>
</div>

<style>
	.GameScreen {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.GameScreen-header {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 40px;
	}

	.GameScreen-title {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: 1.05rem;
		font-weight: 650;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.GameScreen-main {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(340px, 400px);
		gap: var(--gap);
		min-height: 0;
	}

	.GameScreen-board-column {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 0;
		min-height: 0;
	}

	.GameScreen-tv-stream {
		flex: none;
		max-height: 45%;
		overflow-y: auto;
		padding: 10px 14px;
		border-radius: var(--radius-m);
		background: var(--stage);
		color: var(--stage-ink);
	}

	.GameScreen-tv-stream-title {
		margin: 0;
		font-size: 1rem;
		font-weight: 650;
	}

	.GameScreen-board-area {
		position: relative;
		flex: 1;
		min-height: 0;
	}

	.GameScreen-board-area > :global(.BoardContainer) {
		position: absolute;
		inset: 0;
		height: auto;
	}

	.GameScreen-access-denied {
		position: absolute;
		left: 0;
		right: 0;
		top: 40%;
		margin: 0;
		padding: 10px 16px;
		background: #fff3cd;
		color: #5c4400;
		text-align: center;
	}

	.GameScreen-overlay {
		position: absolute;
		left: 50%;
		bottom: 16px;
		z-index: 5;
		width: min(92%, 30rem);
		transform: translateX(-50%);
	}

	.GameScreen-side {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.GameScreen-controls {
		order: 1;
		padding: 0 12px 10px;
	}

	.GameScreen-controls:empty {
		display: none;
	}

	.GameScreen-players-users {
		display: grid;
		grid-template-columns: minmax(0, 63fr) minmax(0, 37fr);
		order: 0;
		max-height: 220px;
		border-bottom: 1px solid var(--rule);
	}

	.GameScreen-players {
		padding: 10px;
		background: var(--surface-sunk);
		overflow-y: auto;
	}

	.GameScreen-users {
		padding: 6px 4px 10px 8px;
		overflow-x: hidden;
		overflow-y: auto;
		font-size: 0.9em;
	}

	.GameScreen-side-title {
		margin: 2px 4px 4px;
		font-size: 0.8em;
		font-weight: 600;
		color: var(--ink-soft);
	}

	.GameScreen-tabs {
		display: none;
	}

	.GameScreen-playing .GameScreen-controls,
	.GameScreen-watching .GameScreen-controls {
		padding-top: 10px;
	}

	.GameScreen-chat {
		order: 2;
		position: relative;
		flex: 1;
		min-height: 120px;
	}

	.GameScreen-chat-scroll {
		position: absolute;
		inset: 0;
		padding: 4px 12px;
		overflow-x: hidden;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.GameScreen-chat-info {
		padding-bottom: 6px;
		font-size: 0.9em;
	}

	.GameScreen-chat-message-bar {
		order: 3;
		padding: 8px 12px 12px;
		border-top: 1px solid var(--rule);
	}

	/* Wide screens: the whole screen fits the window, the board as high as it goes. */
	@media (min-width: 901px) {
		.GameScreen {
			height: var(--game-height);
		}

		.GameScreen-main {
			flex: 1;
		}

		.GameScreen-side {
			height: 100%;
		}
	}

	/* Narrow screens: board on top, then buttons, players and tabs. */
	@media (max-width: 900px) {
		.GameScreen-main {
			grid-template-columns: minmax(0, 1fr);
		}

		.GameScreen-board-area {
			flex: none;
			aspect-ratio: 1;
			width: 100%;
			max-width: 820px;
			align-self: center;
		}

		.GameScreen-tv-stream {
			max-height: none;
		}

		.GameScreen-controls {
			order: 0;
		}

		.GameScreen-players-users {
			display: flex;
			flex-direction: column;
			order: 1;
			max-height: none;
			border-bottom: 0;
		}

		.GameScreen-tabs {
			display: flex;
			justify-content: center;
			gap: 4px;
			border-bottom: 1px solid var(--rule);
		}

		.GameScreen-tab {
			min-height: 44px;
			padding: 8px 14px;
			border: 0;
			border-bottom: 3px solid transparent;
			background: none;
			color: var(--ink-soft);
			cursor: pointer;
		}

		.GameScreen-tab[aria-selected='true'] {
			color: var(--ink);
			border-bottom-color: var(--accent);
			font-weight: 600;
		}

		.GameScreen-side-title {
			display: none;
		}

		.GameScreen-users,
		.GameScreen-chat,
		.GameScreen-chat-message-bar {
			display: none;
		}

		.GameScreen-users.GameScreen-tab-content,
		.GameScreen-chat.GameScreen-tab-content,
		.GameScreen-chat-message-bar.GameScreen-tab-content {
			display: block;
		}

		.GameScreen-users {
			min-height: 200px;
			max-height: 300px;
			padding: 12px;
		}

		.GameScreen-chat {
			min-height: 0;
		}

		.GameScreen-chat-scroll {
			position: static;
			min-height: 100px;
			max-height: 300px;
		}

		.GameScreen-tab-content-chat .GameScreen-chat-info {
			display: none;
		}

		.GameScreen-chat-info {
			min-height: 200px;
		}
	}

	/* Oldschool: framed window, title bar header, tabs like a dialog */
	:global([data-design='oldschool']) .GameScreen-header {
		min-height: 0;
		padding: 2px 4px;
		background: var(--title-bar);
		color: var(--title-ink);
	}

	:global([data-design='oldschool']) .GameScreen-title {
		font-size: 13px;
	}

	:global([data-design='oldschool']) .GameScreen-tv-stream {
		border-radius: 0;
	}

	:global([data-design='oldschool']) .GameScreen-side {
		border-color: #ffffff #808080 #808080 #ffffff;
	}

	:global([data-design='oldschool']) .GameScreen-players {
		background: var(--surface);
		padding: 4px;
	}

	:global([data-design='oldschool']) .GameScreen-users {
		background: var(--surface-sunk);
		border-left: 1px solid #808080;
	}

	:global([data-design='oldschool']) .GameScreen-chat-scroll {
		background: var(--surface-sunk);
		border-top: 1px solid #808080;
		padding: 2px 6px;
	}

	:global([data-design='oldschool']) .GameScreen-tab[aria-selected='true'] {
		background: var(--surface-sunk);
		border-bottom-color: var(--accent);
	}

	:global([data-design='oldschool']) .GameScreen-access-denied {
		border: 2px solid #000;
	}
</style>
