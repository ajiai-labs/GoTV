// The German interface texts: the approved wording and the source of truth.
// One section per area, each with its own key prefix; en.ts mirrors them.
import type { Message } from './types.ts';
import { app } from './de/app.ts';
import { chat } from './de/chat.ts';
import { community } from './de/community.ts';
import { game } from './de/game.ts';
import { play } from './de/play.ts';
import { replay } from './de/replay.ts';
import { settings } from './de/settings.ts';
import { tv } from './de/tv.ts';

export const SECTIONS = { app, chat, community, game, play, replay, settings, tv };

export const de = {
	...app,
	...chat,
	...community,
	...game,
	...play,
	...replay,
	...settings,
	...tv
};

export type MessageKey = keyof typeof de;

export type Messages = Record<MessageKey, Message>;
