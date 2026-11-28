<script lang="ts">
	// A list of games or challenges (Beobachten, Spielen, Live). Each row shows
	// the type, the players (winner marked), result or move number, observers,
	// board and time, and the game's name. Running games stand in columns with
	// a header (28.11.2026, after the mockups); the room only for tournament
	// games (user: two players of different countries play in any room - the
	// room says little, except for tournaments). The filter (game/filter.ts) is
	// applied here. Long lists show the first 20 at once and the rest a moment
	// later, so the page opens without a pause.
	import { onMount } from 'svelte';
	import { getWinningColor } from '#lib/model/game/display.ts';
	import { filterGames, gameRules } from '#lib/model/game/filter.ts';
	import type { GameChannel, GameFilter, Index, Room } from '#lib/model/types.ts';
	import GamePlayersList from './GamePlayersList.svelte';
	import GameRulesDisplay from './GameRulesDisplay.svelte';
	import GameTypeIcon from './GameTypeIcon.svelte';
	import TvSourceBadge from '#lib/ui/tv/TvSourceBadge.svelte';
	import { formatScoreDe } from './gameText.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

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

	let filtered = $derived(filterGames(games, filter, roomsById));

	let shown = $derived(fullRender ? filtered : filtered.slice(0, FIRST_RENDER));

	function typeOf(game: GameChannel) {
		return game.initialProposal ? game.initialProposal.gameType : game.type;
	}

	let hasActive = $derived(shown.some((game) => game.type !== 'challenge'));
</script>

<div class="GameList">
	{#if hasActive}
		<div class="GameList-head" aria-hidden="true">
			<span></span>
			<span>{t('play.list.headPlayers')}</span>
			<span>{t('play.list.headMove')}</span>
			<span>{t('play.list.headObservers')}</span>
			<span>{t('play.list.headRules')}</span>
			<span></span>
		</div>
	{/if}
	{#each shown as game ((game.tvSource || 'kgs') + '-' + game.id)}
		{@const room = roomsById ? roomsById[game.roomId] : null}
		{@const rules = gameRules(game)}
		{@const isChallenge = game.type === 'challenge'}
		{@const isTournament = game.type === 'tournament' || !!game.event}
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
				{#if game.name}
					<span class="GameList-item-name">{game.name}</span>
				{/if}
			</span>
			<span class="GameList-item-cells">
				<span class="GameList-item-move">
					{#if game.over && game.score}
						<span class="GameList-item-result">{formatScoreDe(game.score)}</span>
					{:else if !isChallenge && game.moveNum}
						{t('play.list.move', { move: game.moveNum })}
					{/if}
				</span>
				<span class="GameList-item-observers">
					{#if !isChallenge && game.observers}
						{t('play.list.observers', { count: game.observers })}
					{/if}
				</span>
				<span class="GameList-item-rules">
					{#if rules}<GameRulesDisplay {rules} full />{/if}
				</span>
			</span>
			<span class="GameList-item-extra">
				{#if showSource}
					<TvSourceBadge {game} />
				{/if}
				{#if room && isTournament}
					<span class="GameList-item-room">{room.name || t('play.list.automatch')}</span>
				{/if}
			</span>
		</button>
	{:else}
		<p class="GameList-empty muted">{t('play.list.empty')}</p>
	{/each}
</div>

<style>
	.GameList {
		display: flex;
		flex-direction: column;
		/* The columns of header and rows (28.11.2026). */
		--game-list-columns: 28px minmax(0, 1.3fr) 5.5rem 7rem minmax(0, 1.7fr) minmax(0, 10rem);
	}

	.GameList-head,
	.GameList-item {
		display: grid;
		grid-template-columns: var(--game-list-columns);
		align-items: center;
		gap: 4px 14px;
		padding: 10px 14px;
	}

	.GameList-head {
		padding-top: 8px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--rule);
		color: var(--ink-soft);
		font-size: 0.82em;
	}

	.GameList-item {
		width: 100%;
		min-height: 52px;
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
		display: flex;
		flex-direction: column;
		min-width: 0;
		font-weight: 600;
	}

	/* On wide screens the cells are columns of the row. */
	.GameList-item-cells {
		display: contents;
	}

	.GameList-item-move,
	.GameList-item-observers,
	.GameList-item-rules {
		min-width: 0;
		font-size: 0.9em;
		color: var(--ink-soft);
	}

	.GameList-item-result {
		font-weight: 650;
		color: var(--ink);
	}

	.GameList-item-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 400;
		font-size: 0.85em;
		color: var(--ink-soft);
	}

	.GameList-item-extra {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		min-width: 0;
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

	:global([data-design='oldschool']) .GameList-head,
	:global([data-design='oldschool']) .GameList-item {
		padding: 3px 6px;
		gap: 2px 8px;
	}

	:global([data-design='oldschool']) .GameList-item {
		min-height: 0;
		background: var(--surface-sunk);
		border-bottom: 1px solid #d4d0c8;
	}

	:global([data-design='oldschool']) .GameList-item:hover {
		background: var(--accent);
		color: var(--accent-ink);
	}

	:global([data-design='oldschool']) .GameList-item:hover .GameList-item-move,
	:global([data-design='oldschool']) .GameList-item:hover .GameList-item-observers,
	:global([data-design='oldschool']) .GameList-item:hover .GameList-item-rules,
	:global([data-design='oldschool']) .GameList-item:hover .GameList-item-room,
	:global([data-design='oldschool']) .GameList-item:hover .GameList-item-result,
	:global([data-design='oldschool']) .GameList-item:hover .GameList-item-name {
		color: var(--accent-ink);
	}

	/* Narrow: players on top, the cells in one wrapped line below. */
	@media (max-width: 700px) {
		.GameList-head {
			display: none;
		}

		.GameList-item {
			grid-template-columns: 28px minmax(0, 1fr) auto;
		}

		.GameList-item-cells {
			display: flex;
			flex-wrap: wrap;
			gap: 2px 10px;
			grid-column: 2 / -1;
			grid-row: 2;
		}
	}
</style>
