// When a chat message should sound (wish of the user, 26.11.2026, as in
// CGoban): someone writes to me privately, or my opponent writes in the
// chat of my running game - e.g. to wake me up when I forget to move.
// Never for my own messages, never for games I only watch or rooms.
// KGS sends the chat of a game as COMMENT props of its moves (GAME_UPDATE),
// lines like "anna [2d]: schöner Zug" - newChatAuthors reads who wrote the
// new ones.
import { isGamePlayer, isGamePlaying } from './game';
import type { AppState, GameChannel, KgsMessage } from './types';

type ChatState = Pick<AppState, 'currentUser' | 'conversationsById' | 'gamesById'>;

export function isChatForMe(state: ChatState, channelId: number, from: string): boolean {
	const me = state.currentUser?.name;
	if (!me || from.toLowerCase() === me.toLowerCase()) return false;
	const convo = state.conversationsById[channelId];
	if (convo) return !!convo.user && convo.status !== 'closed';
	const game = state.gamesById[channelId];
	return !!game && isGamePlayer(me, game.players) && isGamePlaying(game);
}

const LINE_AUTHOR = /^([^\s:[\]]+)\s*(\[[^\]]*\])?\s*:/;

function commentProps(msg: KgsMessage): Array<{ nodeId: number; text: string }> {
	const events: Array<Record<string, any>> = Array.isArray(msg.sgfEvents) ? msg.sgfEvents : [];
	const found: Array<{ nodeId: number; text: string }> = [];
	for (const event of events) {
		const props =
			event.type === 'PROP_GROUP_ADDED'
				? event.props
				: event.type === 'PROP_ADDED' || event.type === 'PROP_CHANGED'
					? [event.prop]
					: [];
		for (const prop of props ?? []) {
			if (prop?.name === 'COMMENT' && typeof prop.text === 'string') {
				found.push({ nodeId: Number(event.nodeId), text: prop.text });
			}
		}
	}
	return found;
}

// Who wrote the chat lines that are new in a game update - compared with
// the comment the move had before (`game`: the game before the update).
// KGS resends a move's whole comment; only the added lines count, so an own
// line after the opponent's still sounds, and a repeated comment does not.
export function newChatAuthors(game: GameChannel | undefined, msg: KgsMessage): Array<string> {
	const authors: Array<string> = [];
	const known = new Map<number, string>();
	for (const { nodeId, text } of commentProps(msg)) {
		const before =
			known.get(nodeId) ??
			(
				game?.tree?.nodes[nodeId]?.props.find((prop) => prop.name === 'COMMENT') as
					{ text?: string } | undefined
			)?.text ??
			'';
		known.set(nodeId, text);
		const added = text.startsWith(before) ? text.slice(before.length) : text;
		for (const line of added.split('\n')) {
			const author = LINE_AUTHOR.exec(line.trim());
			if (author) authors.push(author[1]);
		}
	}
	return authors;
}
