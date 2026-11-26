<script lang="ts">
	// A KGS game in its own window (gameWindows.ts, /partie?id=N), as in
	// CGoban. The window shares the KGS connection of the main window
	// (windowLink.ts). Closing it leaves a watched game at KGS; an own game
	// keeps running - KGS lets you come back to it.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { app } from '#lib/app.svelte.ts';
	import { VIEW_ID } from '#lib/windowLink.ts';
	import { isGamePlayer, isGamePlaying } from '#lib/model/game/index.ts';
	import KgsGate from '#lib/ui/KgsGate.svelte';
	import Spinner from '#lib/ui/Spinner.svelte';
	import GameScreen from '#lib/ui/game/GameScreen.svelte';

	let gameId = $derived(Number(page.url.searchParams.get('id')));
	let game = $derived(Number.isFinite(gameId) ? (app.state.gamesById[gameId] ?? null) : null);
	let me = $derived(app.state.currentUser?.name ?? '');
	let mine = $derived(!!game && !!me && isGamePlayer(me, game.players));
	let playing = $derived(!!game && mine && isGamePlaying(game));
	let title = $derived.by(() => {
		const players = game?.players;
		const names = [players?.white?.name, players?.black?.name].filter(Boolean);
		return names.length ? names.join(' – ') : t('app.gameWindow.title');
	});

	// This window shows the game: registered with the window that holds the
	// KGS connection, which joins it once and lets go when no window shows it
	// any more (AppActions.onViewGame).
	let viewing = false;
	$effect(() => {
		if (viewing || !game || !app.loggedIn || !app.started) return;
		viewing = true;
		app.actions.onViewGame(gameId, VIEW_ID);
	});

	onMount(() => {
		const leave = () => {
			if (viewing && app.started) app.actions.onUnviewGame(gameId, VIEW_ID);
			viewing = false;
		};
		window.addEventListener('pagehide', leave);
		return () => {
			window.removeEventListener('pagehide', leave);
			leave();
		};
	});
</script>

<svelte:head>
	<title>{title} – GoTV</title>
</svelte:head>

<KgsGate inWindow>
	{#if game}
		<GameScreen {game} {playing} inWindow />
	{:else if !Number.isFinite(gameId) || gameId <= 0}
		<p class="missing">{t('app.gameWindow.missing')}</p>
	{:else}
		<Spinner />
	{/if}
</KgsGate>

<style>
	.missing {
		margin: 24px;
	}
</style>
