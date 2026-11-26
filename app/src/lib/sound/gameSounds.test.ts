import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	DEFAULT_SOUND_PREFS,
	loadSoundPrefs,
	playCountdown,
	playStoneClick,
	saveSoundPrefs,
	SOUND_PREFS_KEY
} from './gameSounds';

describe('game sounds', () => {
	afterEach(() => {
		localStorage.clear();
		vi.unstubAllGlobals();
	});

	it('has every sound on by default and keeps what was chosen', () => {
		expect(loadSoundPrefs()).toEqual({
			stones: true,
			gameStart: true,
			countdown: true,
			messages: true
		});
		saveSoundPrefs({ stones: false, gameStart: true, countdown: false, messages: false });
		expect(loadSoundPrefs()).toEqual({
			stones: false,
			gameStart: true,
			countdown: false,
			messages: false
		});
	});

	it('ignores broken or foreign entries', () => {
		localStorage.setItem(SOUND_PREFS_KEY, '{"stones":"no","countdown":false}');
		expect(loadSoundPrefs()).toEqual({ ...DEFAULT_SOUND_PREFS, countdown: false });
		localStorage.setItem(SOUND_PREFS_KEY, 'not json');
		expect(loadSoundPrefs()).toEqual(DEFAULT_SOUND_PREFS);
	});

	it('plays nothing that is switched off, and only the last ten seconds', () => {
		const created = vi.fn();
		vi.stubGlobal(
			'AudioContext',
			class {
				constructor() {
					created();
				}
			}
		);
		saveSoundPrefs({ ...DEFAULT_SOUND_PREFS, stones: false });
		playStoneClick();
		playCountdown(11);
		playCountdown(0);
		expect(created).not.toHaveBeenCalled();
	});
});
