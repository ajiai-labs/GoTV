<script lang="ts">
	// Under a room's description: "N Partien" and "N Herausforderungen" of the
	// room. A click shows them in Beobachten or Spielen (filtered by the room).
	import type { GameChannel } from '#lib/model/types.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	let {
		games,
		onSelect
	}: {
		games: Array<GameChannel>;
		onSelect: (games: Array<GameChannel>) => unknown;
	} = $props();

	let groups = $derived.by(() => {
		const activeGames: Array<GameChannel> = [];
		const challenges: Array<GameChannel> = [];
		for (const game of games) {
			if (game.deletedTime) continue;
			if (game.type === 'challenge') challenges.push(game);
			else activeGames.push(game);
		}
		return [
			{ key: 'games', isChallenges: false, games: activeGames },
			{ key: 'challenges', isChallenges: true, games: challenges }
		].filter((group) => group.games.length);
	});

	function label(count: number, isChallenges: boolean): string {
		if (isChallenges) return t('chat.roomGames.challenges', { count });
		return t('chat.roomGames.games', { count });
	}
</script>

{#if groups.length}
	<div class="RoomGameLinks">
		{#each groups as group (group.key)}
			<button
				type="button"
				class="RoomGameLink"
				class:RoomGameLink-challenges={group.isChallenges}
				onclick={() => onSelect(group.games)}
			>
				<span class="RoomGameLink-icon" aria-hidden="true">
					{#if group.isChallenges}
						☝
					{:else}
						<svg viewBox="0 0 20 14" width="20" height="14">
							<circle cx="6" cy="7" r="5.5" fill="#1d2421" />
							<circle cx="14" cy="7" r="5.5" fill="#fff" stroke="#1d2421" stroke-width="1" />
						</svg>
					{/if}
				</span>
				<span>{label(group.games.length, group.isChallenges)}</span>
			</button>
		{/each}
	</div>
{/if}

<style>
	.RoomGameLinks {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 12px;
	}

	.RoomGameLink {
		display: inline-flex;
		flex: 1 1 auto;
		align-items: center;
		gap: 8px;
		min-height: 38px;
		padding: 6px 14px;
		border: var(--button-border);
		border-radius: var(--radius-pill);
		background: var(--button-bg);
		color: var(--ink);
		cursor: pointer;
	}

	.RoomGameLink:hover {
		border-color: var(--accent);
	}

	.RoomGameLink-challenges {
		font-weight: 650;
	}

	.RoomGameLink-icon {
		display: inline-grid;
		place-items: center;
		width: 20px;
		font-size: 16px;
		line-height: 1;
	}

	:global([data-design='oldschool']) .RoomGameLink {
		min-height: 28px;
		padding: 2px 10px;
	}

	:global([data-design='oldschool']) .RoomGameLink:active {
		border-style: inset;
	}
</style>
