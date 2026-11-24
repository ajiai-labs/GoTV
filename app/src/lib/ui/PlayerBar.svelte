<script lang="ts">
	// One player above or below the board: stone colour, name, rank, clock.
	import { t } from '#lib/i18n/index.svelte.ts';
	let {
		color,
		name,
		rank,
		clock = null,
		toMove = false
	}: {
		color: 'black' | 'white';
		name: string;
		rank: string;
		clock?: string | null;
		toMove?: boolean;
	} = $props();
</script>

<div class="player" class:to-move={toMove}>
	<span
		class="stone {color}"
		aria-label={color === 'black' ? t('app.color.black') : t('app.color.white')}
	></span>
	<span class="name">{name}</span>
	<span class="rank">{rank}</span>
	{#if clock}
		<span class="clock" aria-label={t('app.playerBar.clock')}>{clock}</span>
	{/if}
</div>

<style>
	.player {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 2px;
	}

	.stone {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		flex: none;
	}

	.stone.black {
		background: radial-gradient(circle at 35% 30%, #4a524e, #0c0e0d 70%);
	}

	.stone.white {
		background: radial-gradient(circle at 35% 30%, #ffffff, #d5dbd4 80%);
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
	}

	.name {
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.rank {
		color: var(--ink-soft);
	}

	.clock {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
		padding: 2px 10px;
		border-radius: var(--radius-pill);
		background: var(--surface-sunk);
	}

	.to-move .clock {
		background: var(--accent);
		color: var(--accent-ink);
	}

	:global([data-design='oldschool']) .player {
		padding: 3px 4px;
	}

	:global([data-design='oldschool']) .clock {
		border-radius: 0;
		background: #000;
		color: #9fe870;
		font-family: 'Courier New', monospace;
	}

	:global([data-design='oldschool']) .to-move .clock {
		background: #000;
		color: #ffde59;
	}
</style>
