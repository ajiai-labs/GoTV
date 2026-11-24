// Brett-Verzögerung: how many seconds the boards lag behind the game
// server, so they match the video. Remembered per channel - each stream has
// its own lag - with the last value used anywhere as the default for a
// channel that has none yet. This browser only (localStorage).
import type { TvEvent } from './tv';
export const DELAY_MAX_SECONDS = 120;
export const DELAY_STEP_SECONDS = 5;
// The last value set anywhere (also the key of the old global setting).
const DEFAULT_KEY = 'gotv.boardDelay';
const PER_CHANNEL_KEY = 'gotv.boardDelays';
export function clampDelay(value: unknown): number {
	const delay = Math.round(Number(value));

	if (!isFinite(delay) || delay <= 0) {
		return 0;
	}

	return Math.min(delay, DELAY_MAX_SECONDS);
}
export function stepDelay(current: number, steps: number): number {
	return clampDelay(current + steps * DELAY_STEP_SECONDS);
}
// The stream an event runs on: its live channel, else its stream URL.
export function getDelayChannelKey(event: TvEvent): string {
	if (event.channel) {
		return event.channel.platform + '/' + event.channel.id.toLowerCase();
	}

	return event.stream_url.toLowerCase().replace(/\/+$/, '');
}

function readPerChannel(): Record<string, number> {
	try {
		const data = JSON.parse(window.localStorage.getItem(PER_CHANNEL_KEY) || '{}');
		return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
	} catch {
		return {};
	}
}

export function loadDelay(event: TvEvent): number {
	try {
		const perChannel = readPerChannel();
		const key = getDelayChannelKey(event);

		if (Object.prototype.hasOwnProperty.call(perChannel, key)) {
			return clampDelay(perChannel[key]);
		}

		return clampDelay(window.localStorage.getItem(DEFAULT_KEY));
	} catch {
		return 0; // storage disabled
	}
}
export function saveDelay(event: TvEvent, seconds: number) {
	try {
		const perChannel = { ...readPerChannel(), [getDelayChannelKey(event)]: clampDelay(seconds) };
		window.localStorage.setItem(PER_CHANNEL_KEY, JSON.stringify(perChannel));
		window.localStorage.setItem(DEFAULT_KEY, String(clampDelay(seconds)));
	} catch {
		// Not remembered without storage.
	}
}
