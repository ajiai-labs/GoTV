// Sounds of an own KGS game, played with the Web Audio API: a stone click
// for every move (recordings, stones/), and generated: a chime when the game starts, and a beep for
// each of the last ten seconds on our clock (higher for the last three) -
// so you hear it from the kitchen. Plus a ding-dong when someone writes to
// you (chatSound.ts decides when). Each one can be switched off in
// Einstellungen (gotv.sounds); the switches are read at every sound.

import stone1 from './stones/stone1.wav';
import stone2 from './stones/stone2.wav';
import stone3 from './stones/stone3.wav';
import stone4 from './stones/stone4.wav';
import stone5 from './stones/stone5.wav';

export type GameSoundKind = 'stones' | 'gameStart' | 'countdown' | 'messages';
export type GameSoundPrefs = Record<GameSoundKind, boolean>;

export const SOUND_PREFS_KEY = 'gotv.sounds';
export const COUNTDOWN_SECONDS = 10;
const URGENT_SECONDS = 3;

export const DEFAULT_SOUND_PREFS: GameSoundPrefs = {
	stones: true,
	gameStart: true,
	countdown: true,
	messages: true
};
export function loadSoundPrefs(): GameSoundPrefs {
	try {
		const stored = JSON.parse(localStorage.getItem(SOUND_PREFS_KEY) ?? '{}') as unknown;
		const prefs = { ...DEFAULT_SOUND_PREFS };
		if (stored && typeof stored === 'object') {
			for (const kind of Object.keys(DEFAULT_SOUND_PREFS) as Array<GameSoundKind>) {
				const value = (stored as Record<string, unknown>)[kind];
				if (typeof value === 'boolean') prefs[kind] = value;
			}
		}
		return prefs;
	} catch {
		return { ...DEFAULT_SOUND_PREFS }; // storage disabled or broken entry
	}
}

export function saveSoundPrefs(prefs: GameSoundPrefs) {
	try {
		localStorage.setItem(SOUND_PREFS_KEY, JSON.stringify(prefs));
	} catch {
		// not remembered without storage
	}
}

let context: AudioContext | null = null;

function audio(): AudioContext | null {
	if (typeof AudioContext === 'undefined') return null;
	context = context ?? new AudioContext();
	// Browsers start it suspended until the first user gesture.
	if (context.state === 'suspended') context.resume().catch(() => {});
	return context;
}

// A short tone with a quick fade-out.
function tone(ctx: AudioContext, freq: number, start: number, length: number, volume: number) {
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = 'sine';
	osc.frequency.value = freq;
	gain.gain.setValueAtTime(volume, start);
	gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
	osc.connect(gain).connect(ctx.destination);
	osc.start(start);
	osc.stop(start + length);
}

// The stone click: real recordings of a stone set on a wooden board
// (from KaTrain, MIT - stones/NOTICE.txt), one of five at random so not
// every move sounds the same. Replaces a synthetic click that sounded like
// a tin drum (user, 28.11.2026). Loaded and decoded once, on first use.
const STONE_URLS = [stone1, stone2, stone3, stone4, stone5];
let stoneBuffers: Promise<Array<AudioBuffer>> | null = null;

function loadStones(ctx: AudioContext): Promise<Array<AudioBuffer>> {
	stoneBuffers =
		stoneBuffers ??
		Promise.all(
			STONE_URLS.map(async (url) => {
				const response = await fetch(url);
				return ctx.decodeAudioData(await response.arrayBuffer());
			})
		).catch((error: unknown) => {
			stoneBuffers = null; // try again with the next move
			throw error;
		});
	return stoneBuffers;
}

function click(ctx: AudioContext) {
	loadStones(ctx)
		.then((buffers) => {
			const source = ctx.createBufferSource();
			source.buffer = buffers[Math.floor(Math.random() * buffers.length)];
			source.connect(ctx.destination);
			source.start();
		})
		.catch(() => {
			// no click is better than a broken game screen
		});
}

// A window opened by GoTV itself (a game window) may not play sound before
// someone clicks in it (browser rule): such a window hands its sounds to the
// main window, which may (windowLink.ts). The relay returns true if it took
// the sound.
export type SoundName = 'stone' | 'gameStart' | 'message' | 'countdown';
let relay: ((name: SoundName, arg?: number) => boolean) | null = null;

export function setSoundRelay(next: typeof relay) {
	relay = next;
}

function relayed(name: SoundName, arg?: number): boolean {
	return !!relay && relay(name, arg);
}

// Plays a sound by name - for sounds handed over by another window.
export function playByName(name: SoundName, arg?: number) {
	if (name === 'stone') playStoneClick();
	else if (name === 'gameStart') playGameStart();
	else if (name === 'message') playMessage();
	else if (name === 'countdown' && typeof arg === 'number') playCountdown(arg);
}

function play(kind: GameSoundKind, sound: (ctx: AudioContext) => void) {
	if (!loadSoundPrefs()[kind]) return;
	const ctx = audio();
	if (!ctx) return;
	try {
		sound(ctx);
	} catch {
		// no sound is better than a broken game screen
	}
}

export function playStoneClick() {
	if (relayed('stone')) return;
	play('stones', click);
}

export function playGameStart() {
	if (relayed('gameStart')) return;
	play('gameStart', (ctx) => {
		const t = ctx.currentTime;
		// Rising three-note chime, played twice - meant to be heard.
		for (const offset of [0, 0.7]) {
			tone(ctx, 660, t + offset, 0.35, 0.4);
			tone(ctx, 880, t + offset + 0.15, 0.35, 0.4);
			tone(ctx, 1320, t + offset + 0.3, 0.5, 0.4);
		}
	});
}

// A chat message for me: ding-dong, twice, clearly audible.
export function playMessage() {
	if (relayed('message')) return;
	play('messages', (ctx) => {
		const t = ctx.currentTime;
		for (const offset of [0, 0.6]) {
			tone(ctx, 988, t + offset, 0.3, 0.4);
			tone(ctx, 740, t + offset + 0.22, 0.4, 0.4);
		}
	});
}

// One beep for `seconds` left (1 to COUNTDOWN_SECONDS).
export function playCountdown(seconds: number) {
	if (seconds < 1 || seconds > COUNTDOWN_SECONDS) return;
	if (relayed('countdown', seconds)) return;
	play('countdown', (ctx) => {
		const urgent = seconds <= URGENT_SECONDS;
		tone(ctx, urgent ? 1200 : 800, ctx.currentTime, urgent ? 0.18 : 0.1, 0.45);
	});
}
