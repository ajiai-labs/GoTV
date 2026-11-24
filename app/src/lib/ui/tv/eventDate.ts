import { formatLocaleDate, formatLocaleTime } from '#lib/util/date.ts';
import type { TvEvent } from '#lib/model/tv.ts';

// "24. Nov. 2026 18:00 – 25. Nov. 2026": calendar cards and replay lists.
export function formatEventDateRange(event: TvEvent): string {
	let start = formatLocaleDate(event.date_start);
	if (event.start) {
		// "start" carries the precise time (with timezone) - shown in the
		// viewer's local time, unlike date_start which is date-only.
		start += ' ' + formatLocaleTime(event.start);
	}
	if (event.date_end) {
		return start + ' – ' + formatLocaleDate(event.date_end);
	}
	return start;
}
