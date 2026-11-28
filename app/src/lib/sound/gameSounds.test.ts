import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	DEFAULT_SOUND_PREFS,
	loadSoundPrefs,
	playCountdown,
	playStoneClick,
	resetSoundsForTests,
	saveSoundPrefs,
	SOUND_PREFS_KEY
} from './gameSounds';

describe('game sounds', () => {
	afterEach(() => {
		localStorage.clear();
		vi.unstubAllGlobals();
		resetSoundsForTests();
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

	it('ticks the last seconds with the recorded clock, the last three higher', async () => {
		const played: Array<string> = [];
		vi.stubGlobal(
			'AudioContext',
			class {
				state = 'running';
				destination = {};
				decodeAudioData = (data: ArrayBuffer) =>
					Promise.resolve({ name: new TextDecoder().decode(data) });
				createBufferSource() {
					const source = {
						buffer: null as { name: string } | null,
						connect: vi.fn(),
						start: () => played.push(source.buffer?.name ?? '')
					};
					return source;
				}
			}
		);
		vi.stubGlobal('fetch', (url: string) =>
			Promise.resolve(new Response(/last/.test(url) ? 'last' : 'tick'))
		);
		playCountdown(5);
		await vi.waitFor(() => expect(played).toEqual(['tick']));
		playCountdown(3);
		await vi.waitFor(() => expect(played).toEqual(['tick', 'last']));
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
