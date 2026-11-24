<script lang="ts">
	// Beobachten (old WatchScreen): the running KGS games with a filter (room,
	// bots - remembered by the app), or the game being watched. A game of a
	// live broadcast shows its stream; the calendar events for that are
	// loaded once.
	import { t } from '#lib/i18n/index.svelte.ts';
	import { onMount } from 'svelte';
	import { app } from '#lib/app.svelte.ts';
	import { fetchTvEvents } from '#lib/model/tv.ts';
	import type { TvEvent } from '#lib/model/tv.ts';
	import KgsGate from '#lib/ui/KgsGate.svelte';
	import FollowedPlayers from '#lib/ui/user/FollowedPlayers.svelte';
	import { followed } from '#lib/ui/user/followed.svelte.ts';
	import GameList from '#lib/ui/game/GameList.svelte';
	import GameListFilter from '#lib/ui/game/GameListFilter.svelte';
	import GameScreen from '#lib/ui/game/GameScreen.svelte';

	let tvEvents: Array<TvEvent> = $state([]);

	let appState = $derived(app.state);
	let activeGame = $derived(
		appState.watchGameId != null ? (appState.gamesById[appState.watchGameId] ?? null) : null
	);
	let hasGame = $derived(!!activeGame);

	onMount(() => {
		window.scrollTo(0, 0);
		fetchTvEvents()
			.then((events) => (tvEvents = events))
			.catch((err: unknown) => {
				console.warn('[tv] Failed to load live calendar events:', err);
			});
	});

	// Opening a game starts at the top of the page.
	$effect(() => {
		if (hasGame) window.scrollTo(0, 0);
	});
</script>

<svelte:head>
	<title>{t('app.watch.pageTitle')}</title>
</svelte:head>

<KgsGate>
	{#if activeGame}
		<GameScreen game={activeGame} {tvEvents} />
	{:else}
		{#if followed.names.length}
			<div class="WatchScreen-followed">
				<FollowedPlayers />
			</div>
		{/if}
		<section class="WatchScreen-list panel" aria-labelledby="watch-title">
			<h1 id="watch-title" class="panel-title">{t('app.watch.title')}</h1>
			<GameListFilter
				games={appState.activeGames}
				roomsById={appState.roomsById}
				filter={appState.watchFilter}
				onChange={app.actions.onShowGames}
			/>
			<GameList
				games={appState.activeGames}
				filter={appState.watchFilter}
				roomsById={appState.roomsById}
				onSelect={(id: number) => app.actions.onJoinGame(id)}
			/>
		</section>
	{/if}
</KgsGate>

<style>
	.WatchScreen-followed {
		margin-bottom: var(--gap);
	}

	.WatchScreen-list {
		max-width: 960px;
		margin: 0 auto;
	}

	.WatchScreen-list .panel-title {
		padding-bottom: 10px;
	}

	:global([data-design='oldschool']) .WatchScreen-list .panel-title {
		padding-bottom: 3px;
	}
</style>
