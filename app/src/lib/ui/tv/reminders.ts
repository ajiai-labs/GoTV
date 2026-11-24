// "Mein GoTV" reminders (used by ReminderWatcher.svelte and Live): a
// browser notification 10 minutes before a starred channel or tournament.
import { getDueReminders, getMyGoTvItems, getReminderKey } from '#lib/model/MyGoTv.ts';
import type { MyGoTvItem } from '#lib/model/MyGoTv.ts';
import type { TvChannel, TvEvent } from '#lib/model/tv.ts';
import {
	loadFavorites,
	loadNotifiedKeys,
	loadRemindersEnabled,
	saveNotifiedKeys
} from '#lib/model/TvFavorites.ts';

// How often the starred channels and tournaments are checked.
export const REMINDER_CHECK_MS = 60000;

export function getNotificationPermission(): NotificationPermission | null {
	return typeof window.Notification === 'function' ? window.Notification.permission : null;
}

function formatReminder(item: MyGoTvItem): string {
	const time = item.start
		? item.start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
		: '';
	return item.planned
		? 'Feste Sendezeit ' + time + ' Uhr (geplant)'
		: 'Beginnt um ' + time + ' Uhr';
}

// Browser notification shortly before a starred channel or tournament
// begins - only while GoTV is open (no server sends push messages). The
// stars and the switch are read from storage each time, so a change on
// Live, Kalender or Kanäle counts at once.
export function checkReminders(
	channels: Array<TvChannel>,
	events: Array<TvEvent>,
	now: Date
): Array<MyGoTvItem> {
	if (!loadRemindersEnabled() || getNotificationPermission() !== 'granted') return [];
	const items = getMyGoTvItems(loadFavorites(), channels, events, now);
	const notified = loadNotifiedKeys();
	const due = getDueReminders(items, now, notified);
	for (const item of due) {
		try {
			new window.Notification('GoTV: ' + item.name, {
				body: formatReminder(item),
				tag: getReminderKey(item)
			});
		} catch (err) {
			console.warn('[tv] Reminder could not be shown:', err);
		}
	}
	if (due.length) saveNotifiedKeys([...notified, ...due.map(getReminderKey)]);
	return due;
}
