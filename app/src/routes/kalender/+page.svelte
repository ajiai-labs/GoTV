<script lang="ts">
	// Kalender: tournaments with broadcasts as a month sheet or a list. Works
	// without a KGS login. Stars ("Mein GoTV") are kept in this browser only.
	// A tournament running right now shows as a full broadcast with its
	// boards, as on Live.
	import { t } from '#lib/i18n/index.svelte.ts';
	import { onMount } from 'svelte';
	import { app } from '#lib/app.svelte.ts';
	import CalendarView from '#lib/ui/tv/CalendarView.svelte';
	import CalendarEventCard from '#lib/ui/tv/CalendarEventCard.svelte';
	import BroadcastCard from '#lib/ui/tv/BroadcastCard.svelte';
	import { loadFavorites, saveFavorites, toggleFavorite } from '#lib/model/TvFavorites.ts';
	import { applyOgsLinks, loadOgsLinks, saveOgsLinks } from '#lib/model/OgsLinks.ts';
	import { kgsTvSource } from '#lib/model/TvSource.ts';
	import type { TvEvent } from '#lib/model/tv.ts';

	// "now" follows the clock like the calendar itself.
	const REFRESH_MS = 60000;

	let favorites = $state.raw(loadFavorites());
	let ogsLinks = $state.raw(loadOgsLinks());
	let now = $state(Date.now());

	onMount(() => {
		const timer = setInterval(() => (now = Date.now()), REFRESH_MS);
		return () => clearInterval(timer);
	});

	function onToggleFavorite(eventId: string) {
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

	function onOpenReplay(url: string) {
		app.openReplay(url);
	}

	function getBroadcast(event: TvEvent) {
		return kgsTvSource.getLiveBroadcasts(
			app.state.activeGames,
			applyOgsLinks([event], ogsLinks),
			app.state.roomsById,
			new Date(now)
		)[0];
	}
</script>

<svelte:head>
	<title>{t('app.calendar.pageTitle')}</title>
</svelte:head>

{#snippet renderEvent(event: TvEvent, options: { openGames: boolean })}
	{@const broadcast = getBroadcast(event)}
	{#if broadcast}
		<div class="live-broadcast">
			<BroadcastCard
				{broadcast}
				{onOpenReplay}
				{now}
				{onAssignOgsLink}
				hasManualOgsLink={!!ogsLinks[event.id]}
				favorite={favorites.events.includes(event.id)}
				{onToggleFavorite}
			/>
		</div>
	{:else}
		<CalendarEventCard
			{event}
			{onOpenReplay}
			{now}
			openGames={options.openGames}
			favorite={favorites.events.includes(event.id)}
			{onToggleFavorite}
		/>
	{/if}
{/snippet}

<CalendarView {onOpenReplay} {renderEvent} favoriteEventIds={favorites.events} {onToggleFavorite} />

<style>
	/* A running broadcast takes the whole row of the card grid. */
	.live-broadcast {
		grid-column: 1 / -1;
		min-width: 0;
	}
</style>
