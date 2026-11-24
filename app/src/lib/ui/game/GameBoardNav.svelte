<script lang="ts">
	// The move bar of a KGS/OGS game (old BoardNav): the shared bar
	// (#lib/ui/BoardNav.svelte) driven by the game's line of nodes, with the
	// move number. Keys as before: left/right one move, up to the last move,
	// down to the start (Home/End work as well). Typing in a field is left
	// alone.
	import BoardNav from '#lib/ui/BoardNav.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	let {
		nodeId,
		currentLine,
		onChangeCurrentNode,
		live = false
	}: {
		nodeId: number | null | undefined;
		currentLine: Array<number> | null | undefined;
		onChangeCurrentNode: (nodeId: number) => unknown;
		// A game still running: "to the end" means back to the current move.
		live?: boolean;
	} = $props();

	let line = $derived(currentLine ?? []);
	let moveNum = $derived(typeof nodeId === 'number' ? Math.max(0, line.indexOf(nodeId)) : 0);
	let total = $derived(Math.max(0, line.length - 1));

	function goTo(index: number) {
		const target = line[Math.max(0, Math.min(total, index))];
		if (typeof target === 'number' && target !== nodeId) onChangeCurrentNode(target);
	}

	// The shared bar steps with left/right except inside fields. The old bar
	// also stepped while the (empty) chat line had the focus - it takes the
	// focus on a game screen - so that case is handled here, as are up/down.
	function onkey(event: KeyboardEvent) {
		const target = event.target as HTMLElement | null;
		const field = target?.closest('input, textarea, select, [contenteditable="true"]');
		if (field) {
			const input = field as HTMLInputElement;
			if (input.isContentEditable || input.type === 'range' || input.value) return;
		}
		if (event.key === 'ArrowUp') goTo(total);
		else if (event.key === 'ArrowDown') goTo(0);
		else if (field && event.key === 'ArrowLeft') goTo(moveNum - 1);
		else if (field && event.key === 'ArrowRight') goTo(moveNum + 1);
		else return;
		event.preventDefault();
	}
</script>

<svelte:window onkeydown={typeof nodeId === 'number' && currentLine ? onkey : undefined} />

{#if typeof nodeId === 'number' && currentLine}
	<div class="GameBoardNav">
		<BoardNav bind:move={() => moveNum, goTo} {total} latest={live ? total : null} />
		<div class="GameBoardNav-move">{t('game.move', { move: moveNum })}</div>
	</div>
{:else}
	<div class="GameBoardNav"></div>
{/if}

<style>
	.GameBoardNav-move {
		padding: 4px 2px 0;
		font-size: 0.9em;
		color: var(--ink-soft);
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
</style>
