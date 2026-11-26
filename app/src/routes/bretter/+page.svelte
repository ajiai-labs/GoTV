<script lang="ts">
	// Brettübersicht (model/team.ts): several KGS games in one calm window,
	// apart from your own game - a team match or any games you follow, brought
	// in from Beobachten or a player's profile. Fixed boards; a click shows one
	// big - with the game's chat beside it, to read and write - Esc or "Alle
	// Bretter" goes back. The overview shows positions only; no analysis
	// anywhere (team matches forbid outside help, DGoB Bundesliga rules § 3).
	// New moves never bring this window to the front. Your own running game
	// can show as a framed preview first; a click on it brings back its own
	// window - you play only there.
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { app } from '#lib/app.svelte.ts';
	import { openGameWindow } from '#lib/gameWindows.ts';
	import { VIEW_ID } from '#lib/windowLink.ts';
	import { isGamePlayer, isGamePlaying } from '#lib/model/game/index.ts';
	import { TEAM_KEY, emptyBoards, loadBoards, removeBoard, saveBoards } from '#lib/model/team.ts';
	import type { TeamBoards } from '#lib/model/team.ts';
	import type { BoardMarkup, BoardState, GameChannel } from '#lib/model/types.ts';
	import Board from '#lib/ui/Board.svelte';
	import GameScreen from '#lib/ui/game/GameScreen.svelte';
	import KgsGate from '#lib/ui/KgsGate.svelte';
	import { formatScoreDe } from '#lib/ui/game/gameText.ts';

	const VIEW_KEY = 'gotv.teamView';
	const OWN_KEY = 'gotv.boardsOwnGame';

	let showOwn = $state(loadShowOwn());
	function loadShowOwn(): boolean {
		try {
			return localStorage.getItem(OWN_KEY) !== 'off';
		} catch {
			return true;
		}
	}
	function setShowOwn(on: boolean) {
		showOwn = on;
		try {
			localStorage.setItem(OWN_KEY, on ? 'on' : 'off');
		} catch {
			// not remembered without storage
		}
	}

	// Your own running game (joined at KGS), shown as a framed preview.
	let ownGame = $derived.by(() => {
		const me = app.state.currentUser?.name;
		if (!me || !showOwn) return null;
		return (
			Object.values(app.state.gamesById).find(
				(game) =>
					!!app.state.channelMembership[game.id] &&
					isGamePlayer(me, game.players) &&
					isGamePlaying(game)
			) ?? null
		);
	});

	let boards: TeamBoards = $state(loadBoards());
	let big: number | null = $state(loadView());
	let refused = $state(false);

	function loadView(): number | null {
		try {
			const board = Number(localStorage.getItem(VIEW_KEY));
			return board > 0 ? board : null;
		} catch {
			return null;
		}
	}

	// The enlarged board is remembered, also after minimising or reopening.
	function show(board: number | null) {
		big = board;
		try {
			if (board) localStorage.setItem(VIEW_KEY, String(board));
			else localStorage.removeItem(VIEW_KEY);
		} catch {
			// not remembered without storage
		}
	}

	// All boards at once: off the overview, and KGS may let the games go.
	function clearAll() {
		boards = emptyBoards();
		saveBoards(boards);
		show(null);
	}

	function takeOff(board: number) {
		boards = removeBoard(boards, board);
		saveBoards(boards);
		if (big === board) show(null);
	}

	// Boards with their game (a list entry before joining has no moves yet).
	let shown = $derived(
		boards
			.map((id, i) => ({
				board: i + 1,
				id,
				game: id != null ? app.state.gamesById[id] : undefined
			}))
			.filter((entry) => entry.id != null)
	);
	// The boards fill the window: 1 alone, 2 side by side (one above the
	// other in a tall window), 3 and 4 two by two.
	let innerWidth = $state(0);
	let innerHeight = $state(0);
	let grid = $derived.by(() => {
		const n = shown.length + (ownGame ? 1 : 0);
		if (n <= 1) return { cols: 1, rows: 1 };
		if (n === 2) return innerHeight > innerWidth ? { cols: 1, rows: 2 } : { cols: 2, rows: 1 };
		if (n <= 4) return { cols: 2, rows: 2 };
		return innerHeight > innerWidth ? { cols: 2, rows: 3 } : { cols: 3, rows: 2 };
	});
	let bigEntry = $derived(big ? (shown.find((entry) => entry.board === big) ?? null) : null);

	// Logged out at KGS (in any window): this window has nothing to show any
	// more and closes, instead of offering a login of its own.
	let wasLoggedIn = false;
	$effect(() => {
		if (app.loggedIn) wasLoggedIn = true;
		else if (wasLoggedIn && app.state.initialized) window.close();
	});

	// The games on the boards are registered as shown here with the window
	// that holds the KGS connection: it joins each once and lets go when no
	// window shows it any more - also when a board is taken off (×).
	let viewed: Array<number> = []; // not reactive: only bookkeeping
	function syncViews(ids: Array<number>) {
		for (const id of ids) {
			if (!viewed.includes(id)) app.actions.onViewGame(id, VIEW_ID);
		}
		for (const id of viewed) {
			if (!ids.includes(id)) app.actions.onUnviewGame(id, VIEW_ID);
		}
		viewed = [...ids];
	}
	$effect(() => {
		if (!app.started || !app.loggedIn) return;
		syncViews(shown.flatMap(({ game }) => (game ? [game.id] : [])));
	});

	onMount(() => {
		// "Zur Brettübersicht" in another window changes the stored boards.
		const onStorage = (event: StorageEvent) => {
			if (event.key === TEAM_KEY) boards = loadBoards();
		};
		const onKey = (event: KeyboardEvent) => {
			// Esc in a text field or a dialog stays there.
			const target = event.target as HTMLElement | null;
			const typing = !!target?.closest('input, textarea, [role="dialog"]');
			if (event.key === 'Escape' && big && !typing) show(null);
		};
		const leave = () => {
			if (app.started) syncViews([]);
		};
		window.addEventListener('storage', onStorage);
		window.addEventListener('keydown', onKey);
		window.addEventListener('pagehide', leave);
		return () => {
			window.removeEventListener('storage', onStorage);
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('pagehide', leave);
			leave();
		};
	});

	function isMine(game: GameChannel): boolean {
		const me = app.state.currentUser?.name;
		return !!me && isGamePlayer(me, game.players);
	}

	// The latest position of a game (live), with its last-move mark.
	function position(game: GameChannel): { board: BoardState; markup: BoardMarkup } | null {
		const tree = game.tree;
		if (!tree) return null;
		// The latest move from KGS; a game without one: the end of its line.
		const node =
			typeof tree.activeNode === 'number'
				? tree.activeNode
				: (tree.currentLine?.[tree.currentLine.length - 1] ?? tree.currentNode);
		const state = tree.computedState?.[node] ?? tree.computedState?.[tree.currentNode];
		return state ? { board: state.board, markup: state.markup } : null;
	}

	function player(game: GameChannel, role: 'white' | 'black'): string {
		const p = game.players?.[role];
		return p ? p.name + (p.rank ? ` [${p.rank}]` : '') : '?';
	}

	function gameLine(game: GameChannel): string {
		return `${player(game, 'white')} – ${player(game, 'black')}`;
	}

	function stateLine(game: GameChannel): string {
		if (game.over && game.score != null) return formatScoreDe(game.score);
		return t('app.boards.move', { move: String(game.moveNum ?? 0) });
	}
</script>

<svelte:window bind:innerWidth bind:innerHeight />

<svelte:head>
	<title>{t('app.boards.title')} – GoTV</title>
</svelte:head>

<KgsGate inWindow>
	{#if bigEntry?.game}
		{@const game = bigEntry.game}
		<!-- The same game screen as a game window, with all it can do. -->
		<div class="single">
			<GameScreen
				{game}
				playing={isMine(game) && isGamePlaying(game)}
				inWindow
				onBack={() => show(null)}
			/>
		</div>
	{:else}
		<div class="boards">
			<header class="head">
				<h1>{t('app.boards.title')}</h1>
				<label class="own-switch">
					<input
						type="checkbox"
						checked={showOwn}
						onchange={(event) => setShowOwn(event.currentTarget.checked)}
					/>
					{t('app.boards.showOwn')}
				</label>
				{#if bigEntry}
					<button type="button" class="button" onclick={() => show(null)}>
						{t('app.boards.all')}
					</button>
				{/if}
				{#if shown.length}
					<button type="button" class="button" onclick={clearAll}>{t('app.boards.clear')}</button>
				{/if}
			</header>
			{#if refused}
				<p class="muted" role="status">{t('game.screen.ownWindowRefused')}</p>
			{/if}

			{#if bigEntry}
				<!-- A board whose game is gone (an earlier KGS session). -->
				<section class="big">
					<p class="players">{t('app.boards.board', { board: String(bigEntry.board) })}</p>
					<p class="loading">{t('app.boards.gone')}</p>
					<div class="actions">
						<button
							type="button"
							class="button"
							onclick={() => bigEntry && takeOff(bigEntry.board)}
						>
							{t('app.boards.remove')}
						</button>
					</div>
				</section>
			{:else if shown.length || ownGame}
				<div class="grid" style:--cols={grid.cols} style:--rows={grid.rows}>
					{#if ownGame}
						{@const pos = position(ownGame)}
						<section class="tile own" aria-label={t('app.boards.own')}>
							<header><strong>{t('app.boards.own')}</strong></header>
							<div class="area">
								<button
									type="button"
									class="board-button own-button fit"
									title={t('app.boards.ownHint')}
									onclick={() => (refused = !openGameWindow(ownGame.id))}
								>
									{#if pos}
										<Board
											board={pos.board}
											markup={pos.markup}
											coordinates={false}
											label={`${t('app.boards.own')}: ${gameLine(ownGame)}, ${t('app.boards.ownHint')}`}
										/>
									{/if}
								</button>
							</div>
							<p class="players">{gameLine(ownGame)}</p>
							<p class="muted">{stateLine(ownGame)}</p>
						</section>
					{/if}
					{#each shown as entry (entry.board)}
						{@const game = entry.game}
						{@const pos = game ? position(game) : null}
						<section
							class="tile"
							aria-label={t('app.boards.board', { board: String(entry.board) })}
						>
							<header>
								<strong>{t('app.boards.board', { board: String(entry.board) })}</strong>
								<button
									type="button"
									class="remove"
									aria-label={t('app.boards.remove')}
									title={t('app.boards.remove')}
									onclick={() => takeOff(entry.board)}
								>
									×
								</button>
							</header>
							<div class="area">
								<button type="button" class="board-button fit" onclick={() => show(entry.board)}>
									{#if game && pos}
										<Board
											board={pos.board}
											markup={pos.markup}
											coordinates={false}
											label={`${gameLine(game)}, ${stateLine(game)}`}
										/>
									{:else}
										<span class="loading">
											{game ? t('app.boards.loading') : t('app.boards.gone')}
										</span>
									{/if}
								</button>
							</div>
							{#if game}
								<p class="players">{gameLine(game)}</p>
								<p class="muted">{stateLine(game)}</p>
							{/if}
						</section>
					{/each}
				</div>
			{:else}
				<p class="empty">{t('app.boards.empty')}</p>
			{/if}
		</div>
	{/if}
</KgsGate>

<style>
	/* The whole window, whatever the layout around: the boards fill it. */
	.boards {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		padding: 10px 14px 12px;
		background: var(--bg);
	}

	.head {
		flex: none;
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 12px;
	}

	.head h1 {
		flex: 1;
		margin: 0;
		font-size: 1.15rem;
	}

	.grid {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		grid-template-rows: repeat(var(--rows), minmax(0, 1fr));
		gap: 12px;
	}

	/* A square board as large as its area allows (width or height). */
	.area {
		flex: 1;
		min-height: 0;
		align-self: stretch;
		display: flex;
		align-items: center;
		justify-content: center;
		container-type: size;
	}

	.fit {
		width: min(100cqw, 100cqh);
	}

	.tile {
		display: flex;
		flex-direction: column;
		min-height: 0;
		gap: 6px;
		padding: 10px;
		border: 1px solid var(--panel-border);
		border-radius: var(--radius-m);
		background: var(--surface);
		box-shadow: var(--panel-shadow);
	}

	.tile header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	/* Your own game: framed, a click goes to its window. */
	.tile.own {
		border: 3px solid var(--accent);
	}

	.own-button {
		cursor: pointer;
	}

	.own-switch {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.9rem;
		color: var(--ink-soft);
	}

	.remove {
		border: 0;
		background: none;
		font-size: 1.2rem;
		line-height: 1;
		color: var(--ink-soft);
		cursor: pointer;
	}

	.board-button {
		display: block;
		padding: 0;
		border: 0;
		background: none;
		cursor: zoom-in;
	}

	.loading {
		display: block;
		padding: 40px 8px;
		text-align: center;
		color: var(--ink-soft);
	}

	.players {
		margin: 0;
		font-weight: 600;
	}

	.tile p {
		margin: 0;
	}

	.big {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
		align-items: center;
	}

	/* One board enlarged: the game screen fills the window. */
	.single {
		padding: 8px 12px 0;
	}

	.actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.empty {
		color: var(--ink-soft);
	}
</style>
