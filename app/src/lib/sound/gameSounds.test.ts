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

	it('shapes the stone recordings for the other boards', async () => {
		const sources: Array<{ playbackRate: { value: number }; via: Array<string> }> = [];
		const node = (kind: string, via: Array<string>) => ({
			type: '',
			frequency: { value: 0 },
			buffer: null,
			connect(target: { kind?: string }) {
				via.push(target.kind ?? 'out');
				return target;
			},
			kind
		});
		vi.stubGlobal(
			'AudioContext',
			class {
				state = 'running';
				sampleRate = 8000;
				destination = { kind: 'out' };
				decodeAudioData = () => Promise.resolve({});
				createBuffer = () => ({ getChannelData: () => new Float32Array(10) });
				createBiquadFilter = () => node('filter', []);
				createConvolver = () => node('room', []);
				createBufferSource() {
					const via: Array<string> = [];
					const source = {
						playbackRate: { value: 1 },
						via,
						buffer: null,
						start: vi.fn(),
						connect(target: { kind?: string; connect?: unknown }) {
							via.push(target.kind ?? 'out');
							return target;
						}
					};
					sources.push(source);
					return source;
				}
			}
		);
		vi.stubGlobal('fetch', () => Promise.resolve(new Response(new ArrayBuffer(8))));
		localStorage.setItem('gotv.stoneSound', 'thick');
		playStoneClick();
		await vi.waitFor(() => expect(sources).toHaveLength(1));
		expect(sources[0].playbackRate.value).toBe(0.8);
		expect(sources[0].via).toEqual(['filter']);
		localStorage.setItem('gotv.stoneSound', 'room');
		playStoneClick();
		await vi.waitFor(() => expect(sources).toHaveLength(2));
		expect(sources[1].via).toEqual(['room']);
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
