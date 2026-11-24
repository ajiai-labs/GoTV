<script lang="ts">
	// Kanäle: the standing roster of Go channels with their fixed air times.
	// Works without a KGS login. Stars ("Mein GoTV") stay in this browser.
	import { onMount } from 'svelte';
	import ChannelsView from '#lib/ui/tv/ChannelsView.svelte';
	import { fetchTvChannels } from '#lib/model/tv.ts';
	import type { TvChannel } from '#lib/model/tv.ts';
	import { loadFavorites, saveFavorites, toggleFavorite } from '#lib/model/TvFavorites.ts';

	// "now" and the roster are refreshed like the old TV screen did.
	const REFRESH_MS = 60000;

	let status: 'loading' | 'ready' | 'error' = $state('loading');
	let channels = $state.raw<Array<TvChannel>>([]);
	let now = $state(Date.now());
	let favorites = $state.raw(loadFavorites());
	let mounted = false;

	function loadChannels() {
		fetchTvChannels().then(
			(loaded) => {
				if (!mounted) return;
				channels = loaded;
				status = 'ready';
			},
			(err: unknown) => {
				console.warn('[tv] Failed to load channels:', err);
				if (mounted && !channels.length) status = 'error';
			}
		);
	}

	function onToggleFavorite(channelId: string) {
		favorites = toggleFavorite(favorites, 'channels', channelId);
		saveFavorites(favorites);
	}

	onMount(() => {
		mounted = true;
		loadChannels();
		const timer = setInterval(() => {
			now = Date.now();
			loadChannels();
		}, REFRESH_MS);
		return () => {
			mounted = false;
			clearInterval(timer);
		};
	});
</script>

<svelte:head>
	<title>Kanäle – GoTV</title>
</svelte:head>

<h1>Kanäle</h1>

<ChannelsView
	{status}
	{channels}
	{now}
	onRetry={loadChannels}
	favoriteIds={favorites.channels}
	{onToggleFavorite}
/>

<style>
	h1 {
		margin: 8px 0 16px;
		font-size: clamp(1.5rem, 2.6vw, 2.2rem);
		letter-spacing: -0.015em;
	}

	:global([data-design='oldschool']) h1 {
		font-size: 16px;
		letter-spacing: 0;
	}
</style>
