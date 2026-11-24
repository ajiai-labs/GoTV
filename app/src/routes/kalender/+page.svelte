<script lang="ts">
	// Kalender: tournaments with broadcasts as a month sheet or a list. Works
	// without a KGS login. Stars ("Mein GoTV") are kept in this browser only.
	import { app } from '#lib/app.svelte.ts';
	import CalendarView from '#lib/ui/tv/CalendarView.svelte';
	import { loadFavorites, saveFavorites, toggleFavorite } from '#lib/model/TvFavorites.ts';

	let favorites = $state.raw(loadFavorites());

	function onToggleFavorite(eventId: string) {
		favorites = toggleFavorite(favorites, 'events', eventId);
		saveFavorites(favorites);
	}
</script>

<svelte:head>
	<title>Kalender – GoTV</title>
</svelte:head>

<CalendarView
	onOpenReplay={(url: string) => app.openReplay(url)}
	favoriteEventIds={favorites.events}
	{onToggleFavorite}
/>
