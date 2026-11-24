<script module lang="ts">
	import type { BoardState, GameChannel } from '#lib/model/types.ts';

	// The position a preview shows: the latest move (live), else the current.
	export function getPreviewBoard(game: Pick<GameChannel, 'tree'>): BoardState | null {
		const tree = game.tree;
		if (!tree) return null; // KGS list entry before joining: no moves known yet
		const nodeId = typeof tree.activeNode === 'number' ? tree.activeNode : tree.currentNode;
		const state = tree.computedState && tree.computedState[nodeId];
		return state ? state.board : null;
	}
</script>

<script lang="ts">
	// Turnierübersicht: one small board per game of a broadcast (team match,
	// several boards). The boards are the same (delayed) snapshots as the big
	// board, so a preview never runs ahead of the video. A click brings the
	// game up next to the stream. Finished games say "beendet", never the
	// result (no spoiler).
	import TvSourceBadge from './TvSourceBadge.svelte';

	let {
		games,
		selectedKey,
		getKey,
		onSelect
	}: {
		games: Array<GameChannel>;
		selectedKey: string | null | undefined;
		getKey: (game: GameChannel) => string;
		onSelect: (gameId: number, game: GameChannel) => unknown;
	} = $props();

	const STAR_POINTS: Record<string, Array<number>> = {
		'19': [3, 9, 15],
		'13': [3, 6, 9],
		'9': [2, 4, 6]
	};

	function formatPlayer(game: GameChannel, role: 'black' | 'white'): string {
		const player = game.players && game.players[role];
		if (!player) return '?';
		return player.name + (player.rank ? ' ' + player.rank : '');
	}

	function getStones(board: BoardState) {
		const stones: Array<{ x: number; y: number; color: string }> = [];
		board.forEach((row, y) =>
			row.forEach((color, x) => {
				if (color) stones.push({ x, y, color });
			})
		);
		return stones;
	}

	function getStars(size: number) {
		const points = STAR_POINTS[String(size)] || [];
		return points.flatMap((y) => points.map((x) => ({ x, y })));
	}
</script>

{#snippet miniBoard(board: BoardState)}
	{@const size = board.length}
	<svg class="BoardPreview-board" viewBox="0 0 {size} {size}" aria-hidden="true">
		<rect width={size} height={size} class="BoardPreview-wood" />
		<g class="BoardPreview-lines">
			{#each { length: size }, i (i)}
				<line x1={0.5} y1={i + 0.5} x2={size - 0.5} y2={i + 0.5} />
				<line x1={i + 0.5} y1={0.5} x2={i + 0.5} y2={size - 0.5} />
			{/each}
		</g>
		{#each getStars(size) as star (star.x + '-' + star.y)}
			<circle class="BoardPreview-star" cx={star.x + 0.5} cy={star.y + 0.5} r={0.12} />
		{/each}
		{#each getStones(board) as stone (stone.x + '-' + stone.y)}
			<circle
				class="BoardPreview-stone BoardPreview-stone-{stone.color}"
				cx={stone.x + 0.5}
				cy={stone.y + 0.5}
				r={0.46}
			/>
		{/each}
	</svg>
{/snippet}

<div class="BoardPreview-grid">
	{#each games as game (getKey(game))}
		{@const key = getKey(game)}
		{@const board = getPreviewBoard(game)}
		<button
			type="button"
			class="BoardPreview"
			class:BoardPreview-selected={key === selectedKey}
			aria-pressed={key === selectedKey}
			onclick={() => onSelect(game.id, game)}
		>
			{#if board}
				{@render miniBoard(board)}
			{:else}
				<span class="BoardPreview-board BoardPreview-empty">Brett nach Klick</span>
			{/if}
			<span class="BoardPreview-players">
				<span class="BoardPreview-player">● {formatPlayer(game, 'black')}</span>
				<span class="BoardPreview-player">○ {formatPlayer(game, 'white')}</span>
			</span>
			<span class="BoardPreview-meta">
				<TvSourceBadge {game} />
				{game.over ? 'beendet' : game.moveNum ? 'Zug ' + String(game.moveNum) : 'läuft'}
			</span>
		</button>
	{/each}
</div>

<style>
	.BoardPreview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 8px;
		margin: 6px 0 10px;
	}

	.BoardPreview {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
		padding: 6px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-s);
		background: var(--surface);
		color: var(--ink);
		font-size: 0.82em;
		text-align: left;
		cursor: pointer;
	}

	.BoardPreview-selected {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px var(--accent-soft);
	}

	.BoardPreview-board {
		display: block;
		width: 100%;
		aspect-ratio: 1;
	}

	.BoardPreview-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--board);
		color: var(--board-coord);
		text-align: center;
	}

	.BoardPreview-wood {
		fill: var(--board);
	}

	.BoardPreview-lines {
		stroke: var(--board-line);
		stroke-width: 0.04;
	}

	.BoardPreview-star {
		fill: var(--board-line);
	}

	.BoardPreview-stone-black {
		fill: #161616;
	}

	.BoardPreview-stone-white {
		fill: #f7f7f2;
		stroke: #5a5a55;
		stroke-width: 0.04;
	}

	.BoardPreview-players {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.BoardPreview-player {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.BoardPreview-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--ink-soft);
	}

	:global([data-design='oldschool']) .BoardPreview {
		border: 2px outset #ece9e2;
		background: var(--button-bg);
	}

	:global([data-design='oldschool']) .BoardPreview-selected {
		border-style: inset;
		box-shadow: none;
		background: var(--accent-soft);
	}
</style>
