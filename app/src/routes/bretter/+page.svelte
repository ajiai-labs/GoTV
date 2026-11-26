<script lang="ts">
	// Brettübersicht (model/team.ts): several KGS games in one calm window,
	// apart from your own game - a team match or any games you follow, brought
	// in from Beobachten or a player's profile. Fixed boards; a click shows one
	// big, Esc or "Alle Bretter" goes back. Only the position: no chat, no
	// comments, no analysis (team matches forbid outside help, DGoB Bundesliga
	// rules § 3). New moves never bring this window to the front.
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { app } from '#lib/app.svelte.ts';
	import { openGameWindow } from '#lib/gameWindows.ts';
	import { TEAM_KEY, loadBoards, removeBoard, saveBoards } from '#lib/model/team.ts';
	import type { TeamBoards } from '#lib/model/team.ts';
	import type { BoardMarkup, BoardState, GameChannel } from '#lib/model/types.ts';
	import Board from '#lib/ui/Board.svelte';
	import KgsGate from '#lib/ui/KgsGate.svelte';
	import { formatScoreDe } from '#lib/ui/game/gameText.ts';

	const VIEW_KEY = 'gotv.teamView';

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
	let bigEntry = $derived(big ? (shown.find((entry) => entry.board === big) ?? null) : null);

	// The games on the boards are joined at KGS (nothing happens if joined).
	$effect(() => {
		if (!app.started || !app.loggedIn) return;
		for (const { game } of shown) {
			if (game && !game.over) app.actions.onJoinGameQuietly(game.id);
		}
	});

	onMount(() => {
		// "Zur Brettübersicht" in another window changes the stored boards.
		const onStorage = (event: StorageEvent) => {
			if (event.key === TEAM_KEY) boards = loadBoards();
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && big) show(null);
		};
		window.addEventListener('storage', onStorage);
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('storage', onStorage);
			window.removeEventListener('keydown', onKey);
		};
	});

	function detach(gameId: number) {
		refused = !openGameWindow(gameId);
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

<svelte:head>
	<title>{t('app.boards.title')} – GoTV</title>
</svelte:head>

<KgsGate inWindow>
	<div class="boards">
		<header class="head">
			<h1>{t('app.boards.title')}</h1>
			{#if bigEntry}
				<button type="button" class="button" onclick={() => show(null)}>
					{t('app.boards.all')}
				</button>
			{/if}
		</header>
		{#if refused}
			<p class="muted" role="status">{t('game.screen.ownWindowRefused')}</p>
		{/if}

		{#if bigEntry}
			{@const game = bigEntry.game}
			{@const pos = game ? position(game) : null}
			<section class="big">
				<p class="players">
					{t('app.boards.board', { board: String(bigEntry.board) })}
					{#if game}· {gameLine(game)} · {stateLine(game)}{/if}
				</p>
				{#if game && pos}
					<div class="big-board">
						<Board board={pos.board} markup={pos.markup} label={gameLine(game)} />
					</div>
				{:else}
					<p class="loading">{t('app.boards.loading')}</p>
				{/if}
				<div class="actions">
					{#if game}
						<button type="button" class="button" onclick={() => detach(game.id)}>
							⧉ {t('game.screen.ownWindow')}
						</button>
					{/if}
					<button type="button" class="button" onclick={() => bigEntry && takeOff(bigEntry.board)}>
						{t('app.boards.remove')}
					</button>
				</div>
			</section>
		{:else if shown.length}
			<div class="grid">
				{#each shown as entry (entry.board)}
					{@const game = entry.game}
					{@const pos = game ? position(game) : null}
					<section class="tile" aria-label={t('app.boards.board', { board: String(entry.board) })}>
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
						<button type="button" class="board-button" onclick={() => show(entry.board)}>
							{#if game && pos}
								<Board
									board={pos.board}
									markup={pos.markup}
									coordinates={false}
									label={`${gameLine(game)}, ${stateLine(game)}`}
								/>
							{:else}
								<span class="loading">{t('app.boards.loading')}</span>
							{/if}
						</button>
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
</KgsGate>

<style>
	.boards {
		padding: 12px 16px;
	}

	.head {
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
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 14px;
	}

	.tile {
		display: flex;
		flex-direction: column;
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
		display: flex;
		flex-direction: column;
		gap: 10px;
		align-items: center;
	}

	.big-board {
		width: min(100%, calc(100vh - 170px));
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
