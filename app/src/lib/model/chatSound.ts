// When a chat message should sound (wish of the user, 26.11.2026, as in
// CGoban): someone writes to me privately, or my opponent writes in the
// chat of my running game - e.g. to wake me up when I forget to move.
// Never for my own messages, never for games I only watch or rooms.
// KGS sends the chat of a game as COMMENT props of its moves (GAME_UPDATE),
// lines like "anna [2d]: schöner Zug" - commentAuthor reads who wrote last.
import { isGamePlayer, isGamePlaying } from './game';
import type { AppState, KgsMessage } from './types';

type ChatState = Pick<AppState, 'currentUser' | 'conversationsById' | 'gamesById'>;

export function isChatForMe(state: ChatState, channelId: number, from: string): boolean {
	const me = state.currentUser?.name;
	if (!me || from.toLowerCase() === me.toLowerCase()) return false;
	const convo = state.conversationsById[channelId];
	if (convo) return !!convo.user && convo.status !== 'closed';
	const game = state.gamesById[channelId];
	return !!game && isGamePlayer(me, game.players) && isGamePlaying(game);
}

// The author of the newest chat line in a game update, or null.
export function commentAuthor(msg: KgsMessage): string | null {
	const events: Array<Record<string, any>> = Array.isArray(msg.sgfEvents) ? msg.sgfEvents : [];
	let text: string | null = null;
	for (const event of events) {
		const props =
			event.type === 'PROP_GROUP_ADDED'
				? event.props
				: event.type === 'PROP_ADDED' || event.type === 'PROP_CHANGED'
					? [event.prop]
					: [];
		for (const prop of props ?? []) {
			if (prop?.name === 'COMMENT' && typeof prop.text === 'string') text = prop.text;
		}
	}
	if (!text) return null;
	const lines = text.split('\n').filter((line) => line.trim());
	const last = lines[lines.length - 1];
	const author = last ? /^([^\s:[\]]+)\s*(\[[^\]]*\])?\s*:/.exec(last) : null;
	return author ? author[1] : null;
}
