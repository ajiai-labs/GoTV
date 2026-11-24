<script lang="ts">
	// "Mein GoTV" reminders, app-wide: renders nothing, checks every minute
	// whether a starred channel or tournament begins within 10 minutes and
	// shows a browser notification (gotv.reminders, gotv.notified).
	import { onMount } from 'svelte';
	import { fetchTvChannels, fetchTvEvents } from '#lib/model/tv.ts';
	import { loadRemindersEnabled } from '#lib/model/TvFavorites.ts';
	import { REMINDER_CHECK_MS, checkReminders, getNotificationPermission } from './reminders.ts';

	onMount(() => {
		let mounted = true;
		const timer = setInterval(() => {
			// Nothing to fetch while reminders are off.
			if (!loadRemindersEnabled() || getNotificationPermission() !== 'granted') return;
			Promise.all([fetchTvChannels(), fetchTvEvents()]).then(
				([channels, events]) => {
					if (mounted) checkReminders(channels, events, new Date());
				},
				(err: unknown) => console.warn('[tv] Reminders: calendar not available:', err)
			);
		}, REMINDER_CHECK_MS);
		return () => {
			mounted = false;
			clearInterval(timer);
		};
	});
</script>
