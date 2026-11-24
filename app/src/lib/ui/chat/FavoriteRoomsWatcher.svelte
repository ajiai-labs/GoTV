<script lang="ts">
	// Runs app-wide (layout), renders nothing: after every KGS login joins the
	// starred rooms (room list, gotv.favoriteRooms) that are not joined yet.
	// It waits a moment after the login, so the rooms KGS rejoins on its own
	// (and the room names) are in first; then once per login. The chat stays
	// on the conversation that was open before.
	import { onDestroy } from 'svelte';
	import { app } from '#lib/app.svelte.ts';
	import { getRoomsToJoin } from '#lib/model/FavoriteRooms.ts';
	import { favoriteRooms } from './favoriteRooms.svelte.ts';

	// Time KGS gets after the login to send its own room joins.
	const SETTLE_MS = 2000;

	let { delay = SETTLE_MS }: { delay?: number } = $props();

	// Plain variables on purpose: bookkeeping, not something to render.
	let joinedThisLogin = false;
	let timer: ReturnType<typeof setTimeout> | null = null;

	function isLoggedIn(): boolean {
		const state = app.state;
		return !!state.currentUser && state.clientState.status === 'loggedIn';
	}

	function stopTimer() {
		if (timer) clearTimeout(timer);
		timer = null;
	}

	function joinFavorites() {
		timer = null;
		if (!isLoggedIn() || !app.started) return;
		joinedThisLogin = true;
		const state = app.state;
		const rooms = getRoomsToJoin(favoriteRooms.rooms, state.roomsById, state.channelMembership);
		if (!rooms.length) return;
		const active = state.activeConversationId;
		for (const room of rooms) app.actions.onJoinRoom(room);
		// Joining switches the chat to the room; back to where the viewer was.
		if (active) app.actions.onSelectConversation(active);
	}

	$effect(() => {
		const loggedIn = isLoggedIn();
		const namesKnown = Object.keys(app.state.roomsById).length > 0;
		if (!loggedIn) {
			joinedThisLogin = false;
			stopTimer();
			return;
		}
		if (joinedThisLogin || timer || !namesKnown) return;
		timer = setTimeout(joinFavorites, delay);
	});

	onDestroy(stopTimer);
</script>
