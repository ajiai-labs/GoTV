<script lang="ts">
	// A list of game summaries (archive of a user, own unfinished games):
	// type, players (dot at the winner), result, rules and date - or
	// "Läuft gerade" for a game in play. With `player` set, the result is
	// marked as won or lost from that player's view.
	import { onMount } from 'svelte';
	import type { GameSummary } from '#lib/model/types.ts';
	import { getWinningColor } from '#lib/model/game/display.ts';
	import { formatLocaleDateTime } from '#lib/util/date.ts';
	import GameTypeIcon from './GameTypeIcon.svelte';
	import GamePlayersList from './GamePlayersList.svelte';
	import GameRulesDisplay from './GameRulesDisplay.svelte';
	import { formatScoreDe } from './gameText.ts';

	let {
		games,
		player,
		onSelect
	}: {
		games: Array<GameSummary>;
		player?: string;
		onSelect: (game: GameSummary) => unknown;
	} = $props();

	// Long archives: the first 15 at once, the rest right after (as before).
	const FIRST_RENDER = 15;
	let fullRender = $state(false);

	onMount(() => {
		if (games.length > FIRST_RENDER) {
			const timer = setTimeout(() => (fullRender = true), 0);
			return () => clearTimeout(timer);
		}
	});

	let shown = $derived(fullRender ? games : games.slice(0, FIRST_RENDER));

	function outcome(game: GameSummary): 'won' | 'lost' | null {
		const winningColor = getWinningColor(game.score);
		const winningPlayer = winningColor ? game.players[winningColor] : null;
		if (winningPlayer && winningPlayer.name === player) return 'won';
		if (player && winningColor) return 'lost';
		return null;
	}
</script>

<div class="GameSummaryList">
	{#each shown as game (game.timestamp)}
		{@const winningColor = getWinningColor(game.score)}
		{@const result = outcome(game)}
		{@const playingNow = game.inPlay && !winningColor}
		<button
			type="button"
			class="GameSummaryList-item"
			class:GameSummaryList-item-won={result === 'won'}
			class:GameSummaryList-item-lost={result === 'lost'}
			onclick={() => onSelect(game)}
		>
			<span class="GameSummaryList-item-type">
				<GameTypeIcon type={game.type} isPrivate={game.private} />
			</span>
			<span class="GameSummaryList-item-players">
				<GamePlayersList players={game.players} winner={winningColor} />
			</span>
			<span class="GameSummaryList-item-info">
				{#if playingNow}
					<span class="GameSummaryList-item-date-now">
						{game.type === 'review' ? 'Wird besprochen' : 'Läuft gerade'}
					</span>
				{:else}
					<span class="GameSummaryList-item-result-rules">
						{#if game.score}
							<span class="GameSummaryList-item-result">
								{#if result}<span class="sr-only">
										{result === 'won' ? 'Gewonnen: ' : 'Verloren: '}
									</span>{/if}{formatScoreDe(game.score)}
							</span>
						{/if}
						{#if game.rules}
							<span class="GameSummaryList-item-rules">
								<GameRulesDisplay rules={game.rules} />
							</span>
						{/if}
					</span>
					<span class="GameSummaryList-item-date">{formatLocaleDateTime(game.timestamp)}</span>
				{/if}
			</span>
		</button>
	{/each}
</div>

<style>
	.GameSummaryList {
		display: flex;
		flex-direction: column;
	}

	.GameSummaryList-item {
		display: grid;
		grid-template-columns: auto minmax(120px, 180px) 1fr;
		align-items: center;
		gap: 4px 16px;
		width: 100%;
		min-height: 44px;
		padding: 8px 12px;
		border: 0;
		border-bottom: 1px solid var(--rule);
		background: none;
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}

	.GameSummaryList-item:hover,
	.GameSummaryList-item:focus-visible {
		background: var(--surface-sunk);
	}

	.GameSummaryList-item-players {
		min-width: 0;
		padding-left: 10px;
		line-height: 1.5;
	}

	.GameSummaryList-item-info {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px 16px;
		min-width: 0;
		color: var(--ink-soft);
	}

	.GameSummaryList-item-result-rules {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px 10px;
	}

	.GameSummaryList-item-result {
		position: relative;
		font-weight: 650;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.GameSummaryList-item-won .GameSummaryList-item-result,
	.GameSummaryList-item-lost .GameSummaryList-item-result {
		padding-left: 12px;
	}

	.GameSummaryList-item-won .GameSummaryList-item-result::before,
	.GameSummaryList-item-lost .GameSummaryList-item-result::before {
		content: '';
		position: absolute;
		left: 0;
		top: 50%;
		width: 7px;
		height: 7px;
		margin-top: -3.5px;
		border-radius: 50%;
	}

	.GameSummaryList-item-won .GameSummaryList-item-result::before {
		background: var(--accent);
	}

	.GameSummaryList-item-lost .GameSummaryList-item-result::before {
		background: #c0392b;
	}

	.GameSummaryList-item-date-now {
		font-weight: 650;
		color: var(--live);
	}

	.GameSummaryList-item-date {
		font-size: 0.93em;
	}

	@media (max-width: 520px) {
		.GameSummaryList-item {
			grid-template-columns: auto 1fr;
		}

		.GameSummaryList-item-info {
			grid-column: 2;
			padding-left: 10px;
		}
	}

	:global([data-design='oldschool']) .GameSummaryList-item {
		min-height: 32px;
		padding: 3px 6px;
		border-bottom-color: #c0bcb2;
	}

	:global([data-design='oldschool']) .GameSummaryList-item:hover,
	:global([data-design='oldschool']) .GameSummaryList-item:focus-visible {
		background: var(--accent-soft);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
