<script lang="ts">
	// A KGS or OGS board next to a broadcast: the board with its own move bar
	// (rewinding stays while new moves arrive, "Zum aktuellen Zug" follows the
	// game again), the players, and chat / info / observers as tabs - the same
	// building blocks as the game screen. A KGS board is observed while the
	// panel is open (and again after a reconnect); an OGS board needs no KGS
	// at all, its chat is read-only.
	import { tick } from 'svelte';
	import { app } from '#lib/app.svelte.ts';
	import { getGameChatSections, getGameLine } from '#lib/model/game/tree.ts';
	import { sortUsers } from '#lib/model/user.ts';
	import type { GameChannel, User } from '#lib/model/types.ts';
	import BoardContainer from '#lib/ui/game/BoardContainer.svelte';
	import GameBoardNav from '#lib/ui/game/GameBoardNav.svelte';
	import GameChat from '#lib/ui/game/GameChat.svelte';
	import GameInfo from '#lib/ui/game/GameInfo.svelte';
	import GameMoreMenu from '#lib/ui/game/GameMoreMenu.svelte';
	import GamePlayersInfo from '#lib/ui/game/GamePlayersInfo.svelte';
	import { formatScoreDe } from '#lib/ui/game/gameText.ts';
	import ChatMessageBar from '#lib/ui/chat/ChatMessageBar.svelte';
	import UserList from '#lib/ui/user/UserList.svelte';
	import TvSourceBadge from './TvSourceBadge.svelte';

	type Tab = 'chat' | 'info' | 'users';

	// The chat follows new messages only while it is (nearly) at the bottom.
	const FOLLOW_SLACK_PX = 32;

	let { game }: { game: GameChannel } = $props();

	const uid = $props.id();

	// null follows the newest move; a number keeps a locally rewound position.
	let selectedNode: number | null = $state(null);
	let tab: Tab = $state('chat');
	let chatEl: HTMLElement | undefined = $state();

	let isOgs = $derived(game.tvSource === 'ogs');
	let gameId = $derived(game.id);
	let source = $derived(isOgs ? 'OGS' : 'KGS');
	let tree = $derived(game.tree);
	let roomsById = $derived(app.state.roomsById);
	let usersByName = $derived(app.state.usersByName);
	// Observing again after a reconnect: the subscription follows the connection.
	let connectionKey = $derived(app.state.clientState.status + '/' + app.state.clientState.network);

	$effect(() => {
		void connectionKey;
		if (isOgs || !app.started) return;
		return app.actions.onObserveTvGame(gameId);
	});

	let currentNode = $derived.by(() => {
		if (!tree) return null;
		if (typeof selectedNode === 'number' && tree.nodes[selectedNode]) return selectedNode;
		return tree.activeNode;
	});
	let currentLine = $derived(
		tree && typeof currentNode === 'number' ? getGameLine(tree, currentNode) : null
	);
	let liveGame: GameChannel = $derived(
		tree && typeof currentNode === 'number' && currentLine
			? { ...game, tree: { ...tree, currentNode, currentLine } }
			: game
	);
	let sections = $derived(getGameChatSections(game));
	let users = $derived.by(() => {
		const list = (game.users ?? [])
			.map((name) => usersByName[name])
			.filter((user): user is User => !!user);
		sortUsers(list);
		return list;
	});
	let header = $derived.by(() => {
		if (game.over || game.score) {
			return (
				(game.over ? 'Partie beendet' : '') +
				(game.score ? (game.over ? ': ' : '') + formatScoreDe(game.score) : '')
			);
		}
		return game.name || '';
	});
	let chatsDisabled = $derived(!tree || isOgs || !app.started);

	// Snapshot before the update whether the chat sits at the bottom; after
	// it, keep it there.
	let chatSignature = $derived.by(() => {
		const last = sections[sections.length - 1];
		return `${sections.length}:${last?.messages?.length ?? 0}:${last?.actions.length ?? 0}`;
	});

	$effect.pre(() => {
		void chatSignature;
		void tab;
		const el = chatEl;
		const follow = !el || el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_SLACK_PX;
		if (!follow) return;
		void tick().then(() => {
			if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
		});
	});

	function onChangeCurrentNode(nodeId: number) {
		selectedNode = tree && nodeId === tree.activeNode ? null : nodeId;
	}

	function onUserDetail(user: User) {
		if (app.started) app.actions.onUserDetail(user.name);
	}

	function onChat(body: string) {
		if (app.started && !isOgs) app.actions.onSendGameChat(body, game.id);
	}

	const TABS: Array<{ id: Tab; label: () => string }> = [
		{ id: 'chat', label: () => 'Chat' },
		{ id: 'info', label: () => 'Info' },
		{ id: 'users', label: () => `${users.length} Beobachter` }
	];
</script>

<div class="TvGamePanel">
	<div class="TvGamePanel-game-header">
		<TvSourceBadge {game} />
		<div class="TvGamePanel-game-score">{header}</div>
		<GameMoreMenu game={liveGame} {roomsById} />
	</div>
	{#if game.accessDenied}
		<p class="TvGamePanel-notice" role="alert">{game.accessDenied}</p>
	{:else if tree && typeof currentNode === 'number' && currentLine}
		<div class="TvGamePanel-board-section">
			<div class="TvGamePanel-board">
				<BoardContainer game={liveGame} embedded />
			</div>
			<GameBoardNav nodeId={currentNode} {currentLine} {onChangeCurrentNode} live={!game.over} />
		</div>
	{:else}
		<p class="TvGamePanel-notice" role="status">Brett wird von {source} geladen …</p>
	{/if}
	<div class="TvGamePanel-players">
		<GamePlayersInfo game={liveGame} {onUserDetail} />
	</div>
	<div class="TvGamePanel-tabs" role="tablist" aria-label="Partie">
		{#each TABS as item (item.id)}
			<button
				type="button"
				role="tab"
				id="{uid}-{item.id}"
				class="TvGamePanel-tab"
				class:TvGamePanel-tab-active={tab === item.id}
				aria-selected={tab === item.id}
				aria-controls="{uid}-panel"
				onclick={() => (tab = item.id)}
			>
				{item.label()}
			</button>
		{/each}
	</div>
	<div id="{uid}-panel" role="tabpanel" aria-labelledby="{uid}-{tab}">
		<h4 class="TvGamePanel-chat-title">
			{tab === 'info' ? 'Partieinfo' : tab === 'users' ? 'Beobachter' : source + '-Partiechat'}
		</h4>
		<div class="TvGamePanel-chat" bind:this={chatEl}>
			{#if tab === 'info'}
				<GameInfo game={liveGame} {roomsById} />
			{:else if tab === 'users'}
				<UserList {users} onSelectUser={onUserDetail} />
			{:else if sections.length}
				<GameChat
					currentUser={app.state.currentUser ?? { name: '' }}
					chatSections={sections}
					{usersByName}
					onUserDetail={(name: string) => {
						if (app.started) app.actions.onUserDetail(name);
					}}
					onOpenTv={(url: string) => {
						if (app.started) app.actions.onOpenTvStream(url);
					}}
				/>
			{:else}
				<p class="TvGamePanel-notice">
					{tree ? 'Noch keine Chatnachrichten.' : 'Chat wird geladen …'}
				</p>
			{/if}
		</div>
	</div>
	{#if tab === 'chat'}
		<ChatMessageBar
			conversation={{ id: 0, messages: [], status: 'created', chatsDisabled }}
			onSubmit={onChat}
		/>
	{/if}
</div>

<style>
	.TvGamePanel {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}

	.TvGamePanel-game-header {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 36px;
	}

	.TvGamePanel-game-score {
		flex: 1;
		min-width: 0;
		color: var(--ink-soft);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* The whole board stays in view next to the video (iPad landscape). */
	.TvGamePanel-board-section {
		width: 100%;
		max-width: max(240px, calc(100dvh - 300px));
		margin: 0 auto;
	}

	.TvGamePanel-tabs {
		display: flex;
		border-bottom: 1px solid var(--rule);
	}

	.TvGamePanel-tab {
		flex: 1;
		min-height: 38px;
		padding: 6px 4px;
		border: 0;
		border-bottom: 3px solid transparent;
		background: none;
		color: var(--ink-soft);
		cursor: pointer;
	}

	.TvGamePanel-tab-active {
		border-bottom-color: var(--accent);
		color: var(--ink);
		font-weight: 600;
	}

	.TvGamePanel-chat-title {
		margin: 0;
		padding: 4px 2px;
		font-size: 0.9em;
		font-weight: 650;
	}

	.TvGamePanel-chat {
		height: 240px;
		overflow-y: auto;
		overflow-wrap: break-word;
		border: 1px solid var(--rule);
		border-radius: var(--radius-s);
		background: var(--surface);
	}

	.TvGamePanel-notice {
		margin: 0;
		padding: 12px;
		color: var(--ink-soft);
		font-size: 0.9em;
	}

	:global([data-design='oldschool']) .TvGamePanel-tab {
		border: 2px outset #ece9e2;
		border-bottom-width: 2px;
		background: var(--button-bg);
		color: var(--ink);
	}

	:global([data-design='oldschool']) .TvGamePanel-tab-active {
		border-style: inset;
		background: var(--accent-soft);
	}

	:global([data-design='oldschool']) .TvGamePanel-chat {
		border: 2px inset #ece9e2;
		background: var(--surface-sunk);
	}
</style>
