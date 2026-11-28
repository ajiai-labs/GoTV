// Sounds of an own KGS game, played with the Web Audio API from sound files -
// so you hear it from the kitchen: a stone click for every move (stones/),
// a sound when the game starts (start/), a tick for each of the last ten
// seconds on our clock, higher for the last three (clock/), and one when
// someone writes to you (chat/; chatSound.ts decides when). Each can be
// switched off in Einstellungen (gotv.sounds), and each comes in four
// variants to choose from (28.11.2026, wish of the user; SOUND_VARIANTS).

import stone1 from './stones/stone1.wav';
import stone2 from './stones/stone2.wav';
import stone3 from './stones/stone3.wav';
import stone4 from './stones/stone4.wav';
import stone5 from './stones/stone5.wav';
import clockTick from './clock/tick.wav';
import clockLast from './clock/last.wav';
import bowlTick from './clock/bowl-tick.wav';
import bowlLast from './clock/bowl-last.wav';
import ebowlTick from './clock/ebowl-tick.wav';
import ebowlLast from './clock/ebowl-last.wav';
import pulseTick from './clock/pulse-tick.wav';
import pulseLast from './clock/pulse-last.wav';
import startGongChord from './start/game-start.wav';
import startDeepGong from './start/deep-gong.wav';
import startBowl from './start/bowl.wav';
import startBassPulse from './start/bass-pulse.wav';
import chatDingDong from './chat/ding-dong.wav';
import chatSmallBowl from './chat/small-bowl.wav';
import chatTwoBowls from './chat/two-bowls.wav';
import chatDrop from './chat/drop.wav';

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

// Recorded sounds, loaded and decoded once on first use (per set).
const recordings = new Map<string, Promise<Array<AudioBuffer>>>();

// Test-only: forget the audio context and the loaded recordings.
export function resetSoundsForTests() {
	context = null;
	recordings.clear();
}

function loadRecordings(ctx: AudioContext, urls: Array<string>): Promise<Array<AudioBuffer>> {
	const key = urls.join('|');
	let loading = recordings.get(key);
	if (!loading) {
		loading = Promise.all(
			urls.map(async (url) => {
				const response = await fetch(url);
				return ctx.decodeAudioData(await response.arrayBuffer());
			})
		).catch((error: unknown) => {
			recordings.delete(key); // try again with the next sound
			throw error;
		});
		recordings.set(key, loading);
	}
	return loading;
}

// Plays one of the recordings (picked by `pick`); no sound is better than
// a broken game screen.
function playRecording(
	ctx: AudioContext,
	urls: Array<string>,
	pick: (count: number) => number = () => 0,
	shape?: (ctx: AudioContext, source: AudioBufferSourceNode) => AudioNode
) {
	loadRecordings(ctx, urls)
		.then((buffers) => {
			const source = ctx.createBufferSource();
			source.buffer = buffers[pick(buffers.length)];
			(shape ? shape(ctx, source) : source).connect(ctx.destination);
			source.start();
		})
		.catch(() => {});
}

// The four variants of each sound (28.11.2026, wish of the user: a choice
// like the countdown's for every sound), chosen in the settings and kept in
// gotv.stoneSound / gotv.startSound / gotv.countdownSound /
// gotv.messageSound. The first one is the default.
export const SOUND_VARIANTS = {
	// Real recordings of a stone on a wooden board (KaTrain, MIT -
	// stones/NOTICE.txt), one of five at random; the other boards are the same
	// recordings shaped: deeper and warmer, brighter and shorter, in a room.
	stones: ['kaya', 'thick', 'table', 'room'],
	// GoTV's own (tools/sounds): gong over a low chord, deep gong, big singing
	// bowl, bass pulse - deep, so it differs from the chat sounds.
	gameStart: ['gongChord', 'deepGong', 'bowl', 'bassPulse'],
	// A tick for 10-4 s and a higher one for the last three: electronic bowl,
	// singing bowl, low pulse (GoTV's own) or KaTrain's clock (MIT).
	countdown: ['ebowl', 'bowl', 'pulse', 'katrain'],
	// Brighter than the game start, so a message is known by ear: the former
	// ding-dong, a small bowl, two bowls, an electronic drop.
	messages: ['dingDong', 'smallBowl', 'twoBowls', 'drop']
} as const satisfies Record<GameSoundKind, ReadonlyArray<string>>;
export type SoundVariant<K extends GameSoundKind> = (typeof SOUND_VARIANTS)[K][number];
export type CountdownSound = SoundVariant<'countdown'>;

export const SOUND_VARIANT_KEYS: Record<GameSoundKind, string> = {
	stones: 'gotv.stoneSound',
	gameStart: 'gotv.startSound',
	countdown: 'gotv.countdownSound',
	messages: 'gotv.messageSound'
};

export function loadSoundVariant<K extends GameSoundKind>(kind: K): SoundVariant<K> {
	const variants: ReadonlyArray<string> = SOUND_VARIANTS[kind];
	try {
		const saved = localStorage.getItem(SOUND_VARIANT_KEYS[kind]);
		if (saved && variants.includes(saved)) return saved as SoundVariant<K>;
	} catch {
		// storage disabled: the default
	}
	return variants[0] as SoundVariant<K>;
}

export function saveSoundVariant<K extends GameSoundKind>(kind: K, variant: SoundVariant<K>) {
	try {
		localStorage.setItem(SOUND_VARIANT_KEYS[kind], variant);
	} catch {
		// not remembered without storage
	}
}

const STONE_URLS = [stone1, stone2, stone3, stone4, stone5];

// A short, soft room: an echo of decaying noise (made once per context).
let roomImpulse: { ctx: AudioContext; buffer: AudioBuffer } | null = null;
function room(ctx: AudioContext): AudioBuffer {
	if (roomImpulse?.ctx === ctx) return roomImpulse.buffer;
	const length = Math.floor(ctx.sampleRate * 0.45);
	const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < length; i++) {
		data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3) * 0.6;
	}
	data[0] = 1; // the dry stone itself
	roomImpulse = { ctx, buffer };
	return buffer;
}

function shapeStone(
	variant: SoundVariant<'stones'>
): ((ctx: AudioContext, source: AudioBufferSourceNode) => AudioNode) | undefined {
	if (variant === 'kaya') return undefined;
	return (ctx, source) => {
		if (variant === 'room') {
			const convolver = ctx.createConvolver();
			convolver.buffer = room(ctx);
			return source.connect(convolver);
		}
		const filter = ctx.createBiquadFilter();
		if (variant === 'thick') {
			source.playbackRate.value = 0.8; // a thicker board rings lower
			filter.type = 'lowpass';
			filter.frequency.value = 2600;
		} else {
			source.playbackRate.value = 1.18; // a thin table board, brighter
			filter.type = 'highpass';
			filter.frequency.value = 350;
		}
		return source.connect(filter);
	};
}

function click(ctx: AudioContext, variant = loadSoundVariant('stones')) {
	playRecording(ctx, STONE_URLS, (count) => Math.floor(Math.random() * count), shapeStone(variant));
}

const START_URLS: Record<SoundVariant<'gameStart'>, string> = {
	gongChord: startGongChord,
	deepGong: startDeepGong,
	bowl: startBowl,
	bassPulse: startBassPulse
};

const CLOCK_URLS: Record<CountdownSound, [string, string]> = {
	ebowl: [ebowlTick, ebowlLast],
	bowl: [bowlTick, bowlLast],
	pulse: [pulseTick, pulseLast],
	katrain: [clockTick, clockLast]
};

const CHAT_URLS: Record<SoundVariant<'messages'>, string> = {
	dingDong: chatDingDong,
	smallBowl: chatSmallBowl,
	twoBowls: chatTwoBowls,
	drop: chatDrop
};

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
	play('stones', (ctx) => click(ctx));
}

export function playGameStart() {
	if (relayed('gameStart')) return;
	play('gameStart', (ctx) => playRecording(ctx, [START_URLS[loadSoundVariant('gameStart')]]));
}

// A chat message for me.
export function playMessage() {
	if (relayed('message')) return;
	play('messages', (ctx) => playRecording(ctx, [CHAT_URLS[loadSoundVariant('messages')]]));
}

// One beep for `seconds` left (1 to COUNTDOWN_SECONDS).
export function playCountdown(seconds: number) {
	if (seconds < 1 || seconds > COUNTDOWN_SECONDS) return;
	if (relayed('countdown', seconds)) return;
	play('countdown', (ctx) => {
		const urgent = seconds <= URGENT_SECONDS;
		playRecording(ctx, CLOCK_URLS[loadSoundVariant('countdown')], () => (urgent ? 1 : 0));
	});
}
