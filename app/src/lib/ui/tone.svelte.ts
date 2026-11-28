// The background tone of the Modern design (wish of the user, 28.11.2026:
// warmer than the grey-green, chosen in the settings - a neutral warm paper
// and one soft tone for each basic colour: yellow, red, blue, green). Put on
// <html data-tone>, where app.css changes only the page and its muted
// surfaces - panels stay white, the board stays wood. app.html applies it
// before the first paint. "Modern dunkel" and "Classic" keep their colours.

import type { MessageKey } from '#lib/i18n/index.svelte.ts';

export type Tone = 'paper' | 'yellow' | 'red' | 'blue' | 'green';

export const TONES: Array<{ id: Tone; name: MessageKey; swatch: string }> = [
	{ id: 'paper', name: 'settings.tone.paper', swatch: '#f4efe6' },
	{ id: 'yellow', name: 'settings.tone.yellow', swatch: '#f2ead6' },
	{ id: 'red', name: 'settings.tone.red', swatch: '#f5ebe7' },
	{ id: 'blue', name: 'settings.tone.blue', swatch: '#ebf0f5' },
	{ id: 'green', name: 'settings.tone.green', swatch: '#eef1ec' }
];

export const DEFAULT_TONE: Tone = 'paper';
const STORAGE_KEY = 'gotv.tone';

function loadTone(): Tone {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		return TONES.some((tone) => tone.id === saved) ? (saved as Tone) : DEFAULT_TONE;
	} catch {
		return DEFAULT_TONE; // storage disabled
	}
}

class ToneState {
	current: Tone = $state(typeof localStorage === 'undefined' ? DEFAULT_TONE : loadTone());

	set(tone: Tone) {
		this.current = tone;
		document.documentElement.dataset.tone = tone;
		try {
			localStorage.setItem(STORAGE_KEY, tone);
		} catch {
			// not remembered without storage
		}
	}
}

export const tone = new ToneState();
