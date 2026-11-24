<script lang="ts">
	// A list of games or challenges (Beobachten, Spielen, Live). Each row shows
	// the type, the players (winner marked), result or move number, observers,
	// rules, name and room. The filter (room, bots) is applied here, as in the
	// old app. Long lists show the first 20 at once and the rest a moment
	// later, so the page opens without a pause.
	import { onMount } from 'svelte';
	import { getWinningColor } from '#lib/model/game/display.ts';
	import type { GameChannel, GameFilter, Index, Room } from '#lib/model/types.ts';
	import GamePlayersList from './GamePlayersList.svelte';
	import GameRulesDisplay from './GameRulesDisplay.svelte';
	import GameTypeIcon from './GameTypeIcon.svelte';
	import TvSourceBadge from '#lib/ui/tv/TvSourceBadge.svelte';
	import { formatScoreDe } from './gameText.ts';

	const FIRST_RENDER = 20;

	let {
		games,
		filter,
		roomsById,
		showSource = false,
		onSelect
	}: {
		games: Array<GameChannel>;
		filter?: GameFilter;
		roomsById?: Index<Room>;
		// TV only: label each board with the server it comes from (KGS/OGS).
		showSource?: boolean;
		onSelect: (id: number, game: GameChannel) => unknown;
	} = $props();

	let fullRender = $state(false);

	onMount(() => {
		if (games.length <= FIRST_RENDER) return;
		const timer = setTimeout(() => (fullRender = true), 32);
		return () => clearTimeout(timer);
	});

	function hasBot(game: GameChannel): boolean {
		return Object.values(game.players).some((user) => !!user?.flags?.robot);
	}

	let filtered = $derived.by(() => {
		if (!filter || !Object.keys(filter).length) return games;
		return games.filter((game) => {
			if (filter.roomId && game.roomId !== filter.roomId) return false;
			if (filter.excludeBots) return !hasBot(game);
			return true;
		});
	});

	let shown = $derived(fullRender ? filtered : filtered.slice(0, FIRST_RENDER));

	function typeOf(game: GameChannel) {
		return game.initialProposal ? game.initialProposal.gameType : game.type;
	}

	function rulesOf(game: GameChannel) {
		return game.initialProposal ? game.initialProposal.rules : game.rules;
	}
</script>

<div class="GameList">
	{#each shown as game ((game.tvSource || 'kgs') + '-' + game.id)}
		{@const room = roomsById ? roomsById[game.roomId] : null}
		{@const rules = rulesOf(game)}
		{@const isChallenge = game.type === 'challenge'}
		<button
			type="button"
			class="GameList-item"
			class:GameList-item-adjourned={game.adjourned}
			class:GameList-item-event={game.event}
			class:GameList-item-challenge={isChallenge}
			class:GameList-item-active={!isChallenge}
			onclick={() => onSelect(game.id, game)}
		>
			<span class="GameList-item-type">
				<GameTypeIcon
					type={typeOf(game)}
					subscribersOnly={game.subscribers}
					isPrivate={game.private}
				/>
			</span>
			<span class="GameList-item-players">
				<GamePlayersList players={game.players} winner={getWinningColor(game.score)} />
			</span>
			<span class="GameList-item-info">
				{#if showSource}
					<span class="GameList-item-source"><TvSourceBadge {game} /></span>
				{/if}
				{#if game.over && game.score}
					<span class="GameList-item-result">{formatScoreDe(game.score)}</span>
				{:else if !isChallenge && game.moveNum}
					<span class="GameList-item-move">Zug {game.moveNum}</span>
				{/if}
				{#if !isChallenge && game.observers}
					<span class="GameList-item-observers">{game.observers} Zuschauer</span>
				{/if}
				{#if rules}
					<span class="GameList-item-rules"><GameRulesDisplay {rules} /></span>
				{/if}
				{#if game.name}
					<span class="GameList-item-name">{game.name}</span>
				{/if}
			</span>
			{#if room}
				<span class="GameList-item-room">{room.name || 'Automatch'}</span>
			{/if}
		</button>
	{:else}
		<p class="GameList-empty muted">Keine Partien</p>
	{/each}
</div>

<style>
	.GameList {
		display: flex;
		flex-direction: column;
	}

	.GameList-item {
		display: grid;
		grid-template-columns: auto minmax(0, 1.2fr) minmax(0, 1fr) auto;
		align-items: center;
		gap: 4px 14px;
		width: 100%;
		min-height: 52px;
		padding: 10px 14px;
		border: 0;
		border-bottom: 1px solid var(--rule);
		background: none;
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}

	.GameList-item:last-child {
		border-bottom: 0;
	}

	.GameList-item:hover {
		background: var(--accent-soft);
	}

	.GameList-item-event {
		box-shadow: inset 3px 0 0 var(--live);
	}

	.GameList-item-adjourned {
		opacity: 0.5;
	}

	/* The list leaves out komi, as before. */
	.GameList-item :global(.GameRulesDisplay-komi) {
		display: none;
	}

	.GameList-item-players {
		min-width: 0;
		font-weight: 600;
	}

	.GameList-item-info {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px 10px;
		min-width: 0;
		font-size: 0.9em;
		color: var(--ink-soft);
	}

	.GameList-item-result {
		font-weight: 650;
		color: var(--ink);
	}

	.GameList-item-name {
		flex-basis: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--ink);
	}

	.GameList-item-room {
		max-width: 12rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.85em;
		color: var(--ink-soft);
	}

	.GameList-empty {
		margin: 0;
		padding: 16px 14px;
	}

	:global([data-design='oldschool']) .GameList-item {
		min-height: 0;
		padding: 3px 6px;
		gap: 2px 8px;
		background: var(--surface-sunk);
		border-bottom: 1px solid #d4d0c8;
	}

	:global([data-design='oldschool']) .GameList-item:hover {
		background: var(--accent);
		color: var(--accent-ink);
	}

	:global([data-design='oldschool']) .GameList-item:hover .GameList-item-info,
	:global([data-design='oldschool']) .GameList-item:hover .GameList-item-room,
	:global([data-design='oldschool']) .GameList-item:hover .GameList-item-result,
	:global([data-design='oldschool']) .GameList-item:hover .GameList-item-name {
		color: var(--accent-ink);
	}

	@media (max-width: 560px) {
		.GameList-item {
			grid-template-columns: auto minmax(0, 1fr);
		}

		.GameList-item-info,
		.GameList-item-room {
			grid-column: 2;
		}
	}
</style>
