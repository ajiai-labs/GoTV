// The English interface texts. Every section is typed as a Translation of
// its German section (types.ts), so a missing or extra key fails
// `npm run check`.
import type { Messages } from './de.ts';
import { app } from './en/app.ts';
import { chat } from './en/chat.ts';
import { community } from './en/community.ts';
import { game } from './en/game.ts';
import { play } from './en/play.ts';
import { replay } from './en/replay.ts';
import { settings } from './en/settings.ts';
import { tv } from './en/tv.ts';

export const SECTIONS = { app, chat, community, game, play, replay, settings, tv };

export const en: Messages = {
	...app,
	...chat,
	...community,
	...game,
	...play,
	...replay,
	...settings,
	...tv
};
