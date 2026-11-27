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
	import HomeLink from '#lib/ui/HomeLink.svelte';
	import Modal from '#lib/ui/Modal.svelte';
	import { playStoneClick } from '#lib/sound/gameSounds.ts';
	import { app } from '#lib/app.svelte.ts';
	import { loadGameWindows } from '#lib/gameWindows.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
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
	import Splitter from '#lib/ui/Splitter.svelte';

	type Tab = 'chat' | 'info' | 'users';

	// Space the layout keeps below the page (padding of the app frame).
	const BOTTOM_SPACE = 32;

	// The splitter remembers the side column's SHARE of the width, not a board
	// width in pixels: the board takes the rest and grows and shrinks with the
	// window, as in CGoban (user, 26.11.2026 - a fixed board width stayed
	// small in a maximised window, a fixed side width squeezed the board to a
	// stamp in a half window). Older `gotv.gameBoardWidth`/`gotv.gameSideWidth`
	// values are ignored.
	const SIDE_SHARE_KEY = 'gotv.gameSideShare';
	const SIDE_SHARE_DEFAULT = 0.3;
	const SIDE_SHARE_MIN = 0.12;
	const SIDE_SHARE_MAX = 0.55;
	const SIDE_WIDTH_MIN = 280;
	const BOARD_MIN_WIDTH = 320;
	const BOARD_WIDTH_STEP = 20;
	const SPLITTER_WIDTH = 24;

	function loadShare(): number | null {
		try {
			const value = Number(localStorage.getItem(SIDE_SHARE_KEY));
			return value >= SIDE_SHARE_MIN && value <= SIDE_SHARE_MAX ? value : null;
		} catch {
			return null;
		}
	}

	let {
		game,
		playing = false,
		inWindow = false,
		onBack,
		overview = false,
		tvEvents = [],
		currentUser: currentUserProp,
		usersByName: usersByNameProp,
		roomsById: roomsByIdProp
	}: {
		game: GameChannel;
		playing?: boolean;
		// In its own window (/partie): "Zurück" closes the window.
		inWindow?: boolean;
		// Shown enlarged in the Brettübersicht: "Alle Bretter" goes back to
		// the overview, the game stays joined.
		onBack?: () => void;
		// Shown in the Brettübersicht: no analysis of a running game there.
		overview?: boolean;
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
		// Each name once: a doubled name would break the keyed list (and with
		// it the whole game screen).
		const list = [...new Set(game.users ?? [])]
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
	// Own game: a stone click for every new move (not when it opens).
	let heardMoveNum: number | undefined;
	let heardGameId: number | undefined;
	$effect(() => {
		const current = moveNum;
		if (
			game.id === heardGameId &&
			current !== undefined &&
			heardMoveNum !== undefined &&
			current > heardMoveNum
		) {
			playStoneClick();
		}
		heardMoveNum = current;
		heardGameId = game.id;
	});

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
	// "Mit KataGo auswerten" only for a game the viewer played, and only once
	// it is over - never KataGo while a game runs.
	let canReview = $derived(!!game.over && !!playerColor);
	let title = $derived.by(() => {
		if (game.over || game.score) {
			const score = game.score ? formatScoreDe(game.score) : '';
			if (game.over)
				return score ? t('game.screen.overWithScore', { score }) : t('game.screen.over');
			return score;
		}
		return game.name || (moveNum ? t('game.move', { move: moveNum }) : '');
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

	let screenHeight = $derived(Math.max(0, innerHeight - topOffset - BOTTOM_SPACE));

	let mainEl: HTMLElement | undefined = $state();
	let mainWidth = $state(0);
	let boardAreaHeight = $state(0);
	let sideShare = $state(loadShare());
	let sideWidth = $derived(
		Math.max(SIDE_WIDTH_MIN, Math.round(mainWidth * (sideShare ?? SIDE_SHARE_DEFAULT)))
	);
	let boardMaxWidth = $derived(Math.max(0, mainWidth - SPLITTER_WIDTH - SIDE_WIDTH_MIN));
	let boardMinWidth = $derived(Math.min(BOARD_MIN_WIDTH, boardMaxWidth));
	// The whole board always stays visible (no scrolling while playing): at
	// most as wide as its column is high; more width goes to the side.
	let fittedBoardWidth = $derived(Math.min(boardMaxWidth, boardAreaHeight));
	let boardWidth = $derived(
		Math.max(boardMinWidth, Math.min(fittedBoardWidth, mainWidth - SPLITTER_WIDTH - sideWidth))
	);
	// Once the board is large, reclaim vertical space above it. The threshold
	// uses the column width, so compacting the header does not change it.
	let compactHeader = $derived(sideShare !== null && boardWidth >= innerHeight * 0.75);

	function setBoardWidth(value: number) {
		if (mainWidth <= 0) return;
		const board = Math.max(boardMinWidth, Math.min(boardMaxWidth, Math.round(value)));
		const side = mainWidth - SPLITTER_WIDTH - board;
		sideShare = Math.min(SIDE_SHARE_MAX, Math.max(SIDE_SHARE_MIN, side / mainWidth));
		try {
			localStorage.setItem(SIDE_SHARE_KEY, sideShare.toFixed(3));
		} catch {
			// not remembered without storage
		}
	}

	function onSplitterPointer(clientX: number) {
		if (!mainEl) return;
		setBoardWidth(clientX - mainEl.getBoundingClientRect().left - SPLITTER_WIDTH / 2);
	}

	function onSplitterKey(step: -1 | 1 | 'min' | 'max') {
		if (step === 'min') setBoardWidth(boardMinWidth);
		else if (step === 'max') setBoardWidth(boardMaxWidth);
		else setBoardWidth(boardWidth + step * BOARD_WIDTH_STEP);
	}

	function onLeave() {
		app.actions.onLeaveGame(game);
		if (inWindow) window.close();
	}

	// "Eigenes Fenster": the game moves out of the main window.
	let canMoveOut = $derived((!inWindow || !!onBack) && loadGameWindows());
	let windowRefused = $state(false);
	function onMoveToWindow() {
		windowRefused = !app.moveGameToWindow(game.id);
	}

	// Leaving an own running game asks first, as CGoban does: leave anyway,
	// resign, or back to the game.
	let confirmingLeave = $state(false);

	function onLeaveRunningGame() {
		confirmingLeave = true;
	}

	function onResignInstead() {
		confirmingLeave = false;
		app.actions.onResign(game);
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
		{ id: 'chat', label: () => t('game.screen.tabChat') },
		{ id: 'info', label: () => t('game.screen.tabInfo') },
		{ id: 'users', label: () => t('game.screen.observers', { count: users.length }) }
	];
</script>

<svelte:window bind:innerHeight onresize={measure} />

{#if confirmingLeave}
	<Modal title={t('game.play.leaveTitle')} onclose={() => (confirmingLeave = false)}>
		<p class="GameScreen-leave-text">{t('game.play.leaveText')}</p>
		<div class="GameScreen-leave-actions">
			<button type="button" class="button button-primary" onclick={() => (confirmingLeave = false)}>
				{t('game.play.leaveBack')}
			</button>
			<button type="button" class="button" onclick={onResignInstead}>
				{t('game.play.resign')}
			</button>
			<button
				type="button"
				class="button"
				onclick={() => {
					confirmingLeave = false;
					// Confirmed: leave the own game at KGS, even while another
					// window shows it.
					app.actions.onLeaveGame(game, { explicit: true });
					if (inWindow) window.close();
				}}
			>
				{t('game.play.leaveYes')}
			</button>
		</div>
	</Modal>
{/if}

<div
	class="GameScreen GameScreen-fit"
	class:GameScreen-playing={playing}
	class:GameScreen-watching={!playing}
	class:GameScreen-rengo={isRengo}
	class:GameScreen-has-tv-stream={!!liveEvent}
	class:GameScreen-compact-header={compactHeader}
	style:--game-height="{screenHeight}px"
	bind:this={screenEl}
>
	<header class="GameScreen-header">
		{#if !inWindow}<HomeLink />{/if}
		{#if onBack}
			<button type="button" class="GameScreen-back button" onclick={onBack}>
				<span aria-hidden="true">‹</span>
				{t('app.boards.all')}
			</button>
		{:else if !playing}
			<button type="button" class="GameScreen-back button" onclick={onLeave}>
				<span aria-hidden="true">{inWindow ? '×' : '‹'}</span>
				{inWindow ? t('game.screen.closeWindow') : t('game.screen.back')}
			</button>
		{/if}
		<h1 class="GameScreen-title">{title}</h1>
		{#if canMoveOut}
			<button
				type="button"
				class="GameScreen-own-window button"
				onclick={onMoveToWindow}
				title={t('game.screen.ownWindowHint')}
			>
				<span aria-hidden="true">⧉</span>
				{t('game.screen.ownWindow')}
			</button>
		{/if}
		{#if !playing}
			<GameMoreMenu {game} {roomsById} kgsTools {overview} />
		{/if}
	</header>
	{#if windowRefused}
		<p class="GameScreen-window-refused" role="status">{t('game.screen.ownWindowRefused')}</p>
	{/if}

	<div
		class="GameScreen-main"
		bind:this={mainEl}
		bind:clientWidth={mainWidth}
		style:--board-width="{boardWidth}px"
		style:--splitter-width="{SPLITTER_WIDTH}px"
	>
		<div class="GameScreen-board-column">
			{#if liveEvent}
				<section class="GameScreen-tv-stream" aria-label={t('game.screen.broadcast')}>
					<h2 class="GameScreen-tv-stream-title">
						{t('game.screen.live', { name: liveEvent.name })}
					</h2>
					<StreamEmbed event={liveEvent} />
				</section>
			{/if}
			<div
				class="GameScreen-board-area"
				bind:clientHeight={boardAreaHeight}
				style:--board-area-height="{boardAreaHeight}px"
			>
				<div class="GameScreen-board-frame" role="region" aria-label={t('game.screen.board')}>
					<BoardContainer
						{game}
						{playing}
						ghost={isOurMove && !scoring ? playerColor : null}
						onClickPoint={isOurMove || scoring ? onClickPoint : undefined}
					/>
				</div>
				{#if game.accessDenied}
					<p class="GameScreen-access-denied" role="alert">{game.accessDenied}</p>
				{/if}
				{#if game.moveFailed && playing}
					<p class="GameScreen-move-failed" role="alert">{t('game.screen.moveFailed')}</p>
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
							onReview={canReview ? () => app.suggestGameReplay(game, { kataGo: true }) : undefined}
							onDismiss={() => (dismissedReplayForGameId = game.id)}
						/>
					</div>
				{/if}
			</div>
		</div>

		<div class="GameScreen-splitter">
			<Splitter
				label={t('game.screen.splitter')}
				valuenow={boardWidth}
				valuemin={boardMinWidth}
				valuemax={boardMaxWidth}
				valuetext={t('game.screen.splitterFitValue', {
					width: Math.min(boardWidth, boardAreaHeight),
					side: Math.max(0, mainWidth - SPLITTER_WIDTH - boardWidth)
				})}
				onpointer={onSplitterPointer}
				onkey={onSplitterKey}
			/>
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
						onLeaveGame={onLeaveRunningGame}
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
					<GamePlayersInfo {game} {onUserDetail} countdownColor={playing ? playerColor : null} />
				</div>
				<div class="GameScreen-tabs" role="tablist" aria-label={t('game.screen.tabs')}>
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
					<h2 class="GameScreen-side-title">
						{t('game.screen.observers', { count: users.length })}
					</h2>
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
	.GameScreen-leave-text {
		margin: 0 0 14px;
		max-width: 46ch;
	}

	.GameScreen-leave-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

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

	.GameScreen-own-window {
		white-space: nowrap;
	}

	.GameScreen-window-refused {
		margin: 4px 0 0;
		color: var(--ink-soft);
		font-size: 0.9rem;
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
		grid-template-columns: minmax(0, var(--board-width)) var(--splitter-width) minmax(0, 1fr);
		min-height: 0;
	}

	.GameScreen-splitter {
		display: flex;
		justify-content: center;
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

	.GameScreen-board-frame {
		position: absolute;
		inset: 0;
	}

	.GameScreen-access-denied {
		position: absolute;
		left: 0;
		right: 0;
		top: 40%;
		margin: 0;
		padding: 10px 16px;
		background: var(--warn-bg, #fff3cd);
		color: var(--warn-ink, #5c4400);
		text-align: center;
	}

	.GameScreen-move-failed {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		z-index: 4;
		margin: 0;
		padding: 10px 16px;
		background: var(--warn-bg, #fff3cd);
		color: var(--warn-ink, #5c4400);
		font-weight: 600;
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
		/* Its width follows the splitter: narrow sides stack the players and
		   the observers instead of cutting the names short. */
		container-type: inline-size;
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

	@container (max-width: 420px) {
		.GameScreen-players-users {
			grid-template-columns: minmax(0, 1fr);
			max-height: 300px;
			overflow-y: auto;
		}
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

	/* Desktop layout with the chat in its own column. */
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

		.GameScreen-fit {
			flex: 1;
			min-height: 0;
		}

		.GameScreen-fit .GameScreen-main {
			grid-template-rows: minmax(0, 1fr);
		}

		.GameScreen-fit .GameScreen-board-area {
			align-self: flex-end;
			width: min(100%, var(--board-area-height));
		}

		.GameScreen-fit .GameScreen-side {
			overflow-y: auto;
		}

		.GameScreen-fit .GameScreen-chat {
			min-height: 0;
		}

		.GameScreen-fit .GameScreen-players-users {
			min-height: 0;
			overflow-y: auto;
		}

		.GameScreen-compact-header {
			gap: 4px;
		}

		.GameScreen-compact-header .GameScreen-header {
			min-height: 0;
		}

		.GameScreen-compact-header .GameScreen-header :global(.button) {
			padding-block: 4px;
		}
	}

	/* Narrow screens: board on top, then buttons, players and tabs. */
	@media (max-width: 900px) {
		.GameScreen-main {
			grid-template-columns: minmax(0, 1fr);
			gap: calc(var(--gap) / 2);
		}

		/* One column: board on top, nothing to resize. */
		.GameScreen-splitter {
			display: none;
		}

		.GameScreen-board-area {
			flex: none;
			aspect-ratio: 1;
			width: 100%;
			/* The whole board in view also in a short window (header above it). */
			max-width: min(820px, calc(100dvh - 72px));
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
