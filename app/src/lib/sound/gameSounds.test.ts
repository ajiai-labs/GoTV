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

	it('plays one of the recorded stone clicks, loaded once', async () => {
		const started = vi.fn();
		const decoded = vi.fn((data: ArrayBuffer) => Promise.resolve({ length: data.byteLength }));
		vi.stubGlobal(
			'AudioContext',
			class {
				state = 'running';
				destination = {};
				decodeAudioData = decoded;
				createBufferSource() {
					return { buffer: null, connect: vi.fn(), start: started };
				}
			}
		);
		const fetchFn = vi.fn((url: string) => {
			expect(url).toMatch(/stone\d\.wav/);
			return Promise.resolve(new Response(new ArrayBuffer(8)));
		});
		vi.stubGlobal('fetch', fetchFn);
		playStoneClick();
		await vi.waitFor(() => expect(started).toHaveBeenCalledTimes(1));
		playStoneClick();
		await vi.waitFor(() => expect(started).toHaveBeenCalledTimes(2));
		expect(fetchFn).toHaveBeenCalledTimes(5);
		expect(decoded).toHaveBeenCalledTimes(5);
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
