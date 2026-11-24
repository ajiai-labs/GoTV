<script lang="ts">
	// Runs app-wide (layout), renders nothing: tells when a followed KGS player
	// starts a game - a browser notification while GoTV is open, with the same
	// switch and permission as the "Mein GoTV" reminders. Games already running
	// at login, or of a player just followed, are listed but not announced.
	import { app } from '#lib/app.svelte.ts';
	import { getFollowedGames } from '#lib/model/FollowedPlayers.ts';
	import type { FollowedGame } from '#lib/model/FollowedPlayers.ts';
	import { loadRemindersEnabled } from '#lib/model/TvFavorites.ts';
	import { getNotificationPermission } from '#lib/ui/tv/reminders.ts';
	import { followed } from './followed.svelte.ts';

	// Plain variables on purpose: bookkeeping, not something to render.
	let seen: Set<number> | null = null;
	let namesKey = '';

	function notify(item: FollowedGame) {
		if (!loadRemindersEnabled() || getNotificationPermission() !== 'granted') return;
		const opponent = item.opponent ? ` gegen ${item.opponent.name}` : '';
		try {
			new Notification(`${item.name} spielt jetzt auf KGS`, {
				body: `Neue Partie${opponent} – in GoTV unter „Beobachten“`,
				tag: `gotv-follow-${item.game.id}`
			});
		} catch {
			// notifications not available here
		}
	}

	$effect(() => {
		const games = app.state.activeGames;
		const names = followed.names;
		if (!app.state.currentUser) {
			seen = null;
			return;
		}
		const found = getFollowedGames(games, names);
		const key = names.join('\n').toLowerCase();
		// First game list after login, or the list of followed players changed.
		if (seen === null || key !== namesKey) {
			if (seen === null && !games.length) return;
			// Not reactive on purpose (bookkeeping inside the effect, never rendered).
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			seen = new Set([...(seen ?? []), ...found.map((item) => item.game.id)]);
			namesKey = key;
			return;
		}
		for (const item of found) {
			if (seen.has(item.game.id)) continue;
			seen.add(item.game.id);
			notify(item);
		}
	});
</script>
