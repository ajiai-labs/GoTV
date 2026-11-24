<script lang="ts">
	// Kanäle: the standing roster of Go channels with their fixed air times.
	// Works without a KGS login. Stars ("Mein GoTV") stay in this browser.
	// A calendar event running on a channel right now shows there as a full
	// broadcast with its boards, as on Live.
	import { t } from '#lib/i18n/index.svelte.ts';
	import { onMount } from 'svelte';
	import { app } from '#lib/app.svelte.ts';
	import ChannelsView from '#lib/ui/tv/ChannelsView.svelte';
	import ChannelCard from '#lib/ui/tv/ChannelCard.svelte';
	import BroadcastCard from '#lib/ui/tv/BroadcastCard.svelte';
	import { fetchTvChannels, fetchTvEvents } from '#lib/model/tv.ts';
	import type { TvChannel, TvEvent } from '#lib/model/tv.ts';
	import { kgsTvSource } from '#lib/model/TvSource.ts';
	import { applyOgsLinks, loadOgsLinks, saveOgsLinks } from '#lib/model/OgsLinks.ts';
	import { loadFavorites, saveFavorites, toggleFavorite } from '#lib/model/TvFavorites.ts';

	// "now" and the roster are refreshed like the old TV screen did.
	const REFRESH_MS = 60000;

	let status: 'loading' | 'ready' | 'error' = $state('loading');
	let channels = $state.raw<Array<TvChannel>>([]);
	let now = $state(Date.now());
	let favorites = $state.raw(loadFavorites());
	let events = $state.raw<Array<TvEvent>>([]);
	let ogsLinks = $state.raw(loadOgsLinks());
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

	// The broadcasts running now (shared request with the channels).
	function loadEvents() {
		fetchTvEvents().then(
			(loaded) => {
				if (mounted) events = loaded;
			},
			(err: unknown) => console.warn('[tv] Failed to load live calendar events:', err)
		);
	}

	function onToggleFavorite(channelId: string) {
		favorites = toggleFavorite(favorites, 'channels', channelId);
		saveFavorites(favorites);
	}

	function onToggleEventFavorite(eventId: string) {
		favorites = toggleFavorite(favorites, 'events', eventId);
		saveFavorites(favorites);
	}

	function onAssignOgsLink(eventId: string, gameId: number | null) {
		const next = { ...ogsLinks };
		if (gameId) next[eventId] = gameId;
		else delete next[eventId];
		saveOgsLinks(next);
		ogsLinks = next;
	}

	let broadcasts = $derived(
		kgsTvSource.getLiveBroadcasts(
			app.state.activeGames,
			applyOgsLinks(events, ogsLinks),
			app.state.roomsById,
			new Date(now)
		)
	);

	// A calendar event running on this channel right now.
	function getBroadcast(channel: TvChannel) {
		return broadcasts.find(
			({ event }) =>
				event.stream_url === channel.url ||
				(event.channel &&
					event.channel.platform === channel.platform &&
					event.channel.id === channel.channel_id)
		);
	}

	onMount(() => {
		mounted = true;
		loadChannels();
		loadEvents();
		const timer = setInterval(() => {
			now = Date.now();
			loadChannels();
			loadEvents();
		}, REFRESH_MS);
		return () => {
			mounted = false;
			clearInterval(timer);
		};
	});
</script>

<svelte:head>
	<title>{t('app.channels.pageTitle')}</title>
</svelte:head>

<h1>{t('app.channels.title')}</h1>

{#snippet renderChannel(channel: TvChannel, onAir: boolean)}
	{@const broadcast = getBroadcast(channel)}
	{#if broadcast}
		<div class="live-broadcast">
			<BroadcastCard
				{broadcast}
				onOpenReplay={(url: string) => app.openReplay(url)}
				{now}
				{onAssignOgsLink}
				hasManualOgsLink={!!ogsLinks[broadcast.event.id]}
				favorite={favorites.events.includes(broadcast.event.id)}
				onToggleFavorite={onToggleEventFavorite}
			/>
		</div>
	{:else}
		<ChannelCard
			{channel}
			{onAir}
			favorite={favorites.channels.includes(channel.id)}
			{onToggleFavorite}
		/>
	{/if}
{/snippet}

<ChannelsView
	{status}
	{channels}
	{now}
	onRetry={loadChannels}
	{renderChannel}
	favoriteIds={favorites.channels}
	{onToggleFavorite}
/>

<style>
	/* A running broadcast takes the whole row of the channel grid. */
	.live-broadcast {
		grid-column: 1 / -1;
		min-width: 0;
	}

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
