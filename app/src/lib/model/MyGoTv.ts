// "Mein GoTV": what the starred channels and tournaments do right now and
// next, plus the reminders shortly before they begin. A channel's air time
// is a plan ("geplant"); a tournament date comes from the calendar.
import { getLiveWindow } from './tv';
import { getNextAirTime } from './tvChannels';
import type { TvChannel, TvEvent } from './tv';
import type { TvFavorites } from './TvFavorites';
export type MyGoTvItem = {
	kind: 'channel' | 'event';
	id: string;
	name: string;
	// "now": on air / running; "next": begins later; "none": no known time.
	status: 'now' | 'next' | 'none';
	start: Date | null | undefined;
	end: Date | null | undefined;
	// Fixed air time of a channel, not a confirmed broadcast.
	planned: boolean;
	// A start time of day is known (not just a whole tournament day).
	timed: boolean;
};
// Reminders fire this long before a start.
export const REMINDER_LEAD_MS = 10 * 60 * 1000;

function channelItem(channel: TvChannel, now: Date): MyGoTvItem {
	const air = getNextAirTime(channel, now);
	return {
		kind: 'channel',
		id: channel.id,
		name: channel.name,
		status: !air ? 'none' : air.start <= now ? 'now' : 'next',
		start: air ? air.start : null,
		end: air ? air.end : null,
		planned: true,
		timed: !!air
	};
}

// The real start (event.start) where known; the live window opens a few
// minutes earlier, which counts as "now" already.
function eventItem(event: TvEvent, now: Date): MyGoTvItem | null | undefined {
	const window = getLiveWindow(event);

	if (window.end < now) {
		return null; // over: it lives on in the calendar and Nachspielen
	}

	const start = event.start ? new Date(event.start) : window.start;
	return {
		kind: 'event',
		id: event.id,
		name: event.name,
		status: window.start <= now ? 'now' : 'next',
		start,
		end: window.end,
		planned: false,
		timed: !!event.start
	};
}

// Running first, then by start; starred items without a known time last.
export function getMyGoTvItems(
	favorites: TvFavorites,
	channels: Array<TvChannel>,
	events: Array<TvEvent>,
	now: Date
): Array<MyGoTvItem> {
	const items = [];

	for (const channel of channels) {
		if (favorites.channels.includes(channel.id)) {
			items.push(channelItem(channel, now));
		}
	}

	for (const event of events) {
		if (favorites.events.includes(event.id)) {
			const item = eventItem(event, now);

			if (item) {
				items.push(item);
			}
		}
	}

	const rank = {
		now: 0,
		next: 1,
		none: 2
	};
	return items.sort((a, b) => {
		if (a.status !== b.status) {
			return rank[a.status] - rank[b.status];
		}

		const aStart = a.start ? a.start.getTime() : Infinity;
		const bStart = b.start ? b.start.getTime() : Infinity;
		return aStart - bStart || a.name.localeCompare(b.name);
	});
}
export function getReminderKey(item: MyGoTvItem): string {
	return item.kind + ':' + item.id + ':' + (item.start ? item.start.getTime() : '');
}
// Items starting within the lead time that were not announced yet. A
// tournament without a start time (whole day) gets no reminder.
export function getDueReminders(
	items: Array<MyGoTvItem>,
	now: Date,
	notifiedKeys: Array<string>
): Array<MyGoTvItem> {
	return items.filter((item) => {
		if (!item.start || !item.timed) {
			return false;
		}

		const untilStart = item.start.getTime() - now.getTime();
		return (
			untilStart <= REMINDER_LEAD_MS &&
			untilStart > -REMINDER_LEAD_MS &&
			!notifiedKeys.includes(getReminderKey(item))
		);
	});
}
