<script lang="ts">
	// "Jetzt auf KGS" on Live (28.11.2026): KGS tournament games and games KGS
	// marks as broadcasts, grouped by room - also without a calendar entry
	// or stream (a KGS tournament was missing from Live). Each game opens like
	// on Beobachten; a room's games can go to the Brettübersicht at once.
	import { t } from '#lib/i18n/index.svelte.ts';
	import { app } from '#lib/app.svelte.ts';
	import { bringToBoards, loadGameWindows } from '#lib/gameWindows.ts';
	import { getKgsNowGroups } from '#lib/model/tv.ts';
	import type { KgsNowGroup } from '#lib/model/tv.ts';
	import GameList from '#lib/ui/game/GameList.svelte';

	let { shownIds = [] }: { shownIds?: Array<number> } = $props();

	let groups = $derived(getKgsNowGroups(app.state.activeGames, app.state.roomsById, shownIds));
	let canUseBoards = $derived(loadGameWindows());
	let note: { roomId: number | null; text: string } | null = $state(null);

	function toBoards(group: KgsNowGroup) {
		let added = 0;
		let full = false;
		for (const game of group.games) {
			const result = bringToBoards(game.id, app.isLiveGame);
			if (result === 'refused') {
				note = { roomId: group.roomId, text: t('game.screen.ownWindowRefused') };
				return;
			}
			if (result === 'full') {
				full = true;
				break;
			}
			added++;
		}
		note = {
			roomId: group.roomId,
			text: full
				? t('tv.kgsNow.boardsFull', { count: added })
				: t('tv.kgsNow.boardsAdded', { count: added })
		};
	}
</script>

{#if groups.length}
	<section class="KgsNow" aria-labelledby="kgs-now-title">
		<h2 id="kgs-now-title" class="KgsNow-title">{t('tv.kgsNow.title')}</h2>
		<p class="muted">{t('tv.kgsNow.hint')}</p>
		{#each groups as group (group.roomId ?? 'none')}
			<div class="KgsNow-group panel">
				<div class="KgsNow-head">
					<h3>
						{group.tournament ? t('tv.kgsNow.tournament') : t('tv.kgsNow.broadcast')}
						· {group.roomName ?? t('tv.kgsNow.unknownRoom')}
						· {t('tv.kgsNow.boards', { count: group.games.length })}
					</h3>
					{#if canUseBoards}
						<button type="button" class="button" onclick={() => toBoards(group)}>
							{t('tv.kgsNow.toBoards')}
						</button>
					{/if}
				</div>
				{#if note && note.roomId === group.roomId}
					<p class="KgsNow-note" role="status">{note.text}</p>
				{/if}
				<GameList
					games={group.games}
					roomsById={app.state.roomsById}
					onSelect={(id: number) => app.watchGame(id)}
				/>
			</div>
		{/each}
	</section>
{/if}

<style>
	.KgsNow {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.KgsNow-title {
		margin: 0;
		font-size: 1.25rem;
	}

	.KgsNow > .muted {
		margin: 0;
	}

	.KgsNow-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
	}

	.KgsNow-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.KgsNow-head h3 {
		margin: 0;
		font-size: 1rem;
	}

	.KgsNow-note {
		margin: 0;
		color: var(--ink-soft);
	}
</style>
