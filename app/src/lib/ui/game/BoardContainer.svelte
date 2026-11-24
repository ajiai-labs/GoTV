<script lang="ts">
	// The board of a KGS (or OGS) game at its current node, as large as the
	// space allows: as wide as the container, and no higher than the
	// container when that has a height of its own (game screen beside the
	// side panel). Embedded in a card (`embedded`), it simply fills the
	// width. With `onClickPoint` the points are clickable (playing,
	// marking dead stones); `ghost` shows a see-through stone of that colour
	// under the pointer.
	import type { BoardPointMark, GameChannel, PlayerColor, Point } from '#lib/model/types.ts';
	import Board from '#lib/ui/Board.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	let {
		game,
		playing = false,
		embedded = false,
		ghost = null,
		onClickPoint
	}: {
		game: GameChannel;
		playing?: boolean;
		embedded?: boolean;
		ghost?: PlayerColor | null;
		onClickPoint?: (
			game: GameChannel,
			loc: Point,
			color?: PlayerColor | null,
			mark?: BoardPointMark | null
		) => unknown;
	} = $props();

	function onPoint(loc: Point, color: PlayerColor | null, mark: BoardPointMark | null) {
		onClickPoint?.(game, loc, color, mark);
	}

	let width = $state(0);
	let height = $state(0);

	// A container without a height of its own grows with the board, so its
	// height equals the width: min() is then simply the width.
	let size = $derived(embedded || height < 1 ? width : Math.min(width, height));

	let nodeState = $derived(game.tree ? game.tree.computedState[game.tree.currentNode] : undefined);
	let moveNum = $derived(
		game.tree ? Math.max(0, game.tree.currentLine.indexOf(game.tree.currentNode)) : 0
	);
	let label = $derived.by(() => {
		const white = game.players.white?.name ?? game.players.owner?.name;
		const black = game.players.black?.name;
		if (white && black) return t('game.board.labelPlayers', { white, black, move: moveNum });
		const name = white ?? black;
		return name
			? t('game.board.labelOne', { name, move: moveNum })
			: t('game.board.label', { move: moveNum });
	});
</script>

<div
	class="BoardContainer"
	class:BoardContainer-embedded={embedded}
	class:BoardContainer-playing={playing}
	bind:clientWidth={width}
	bind:clientHeight={height}
>
	{#if nodeState && size > 0}
		<div class="BoardContainer-board" style:width="{size}px" style:height="{size}px">
			<Board
				board={nodeState.board}
				markup={nodeState.markup}
				{label}
				ghost={onClickPoint ? ghost : null}
				onpoint={onClickPoint ? onPoint : undefined}
			/>
		</div>
	{/if}
</div>

<style>
	.BoardContainer {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		width: 100%;
		min-width: 0;
		min-height: 0;
		height: 100%;
	}

	.BoardContainer-embedded {
		height: auto;
	}

	.BoardContainer-board {
		flex: none;
	}
</style>
