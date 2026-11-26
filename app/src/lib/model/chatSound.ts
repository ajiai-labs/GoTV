// When a chat message should sound (wish of the user, 26.11.2026, as in
// CGoban): someone writes to me privately, or my opponent writes in the
// chat of my running game - e.g. to wake me up when I forget to move.
// Never for my own messages, never for games I only watch or rooms.
import { isGamePlayer, isGamePlaying } from './game';
import type { AppState } from './types';

type ChatState = Pick<AppState, 'currentUser' | 'conversationsById' | 'gamesById'>;

export function isChatForMe(state: ChatState, channelId: number, from: string): boolean {
	const me = state.currentUser?.name;
	if (!me || from.toLowerCase() === me.toLowerCase()) return false;
	const convo = state.conversationsById[channelId];
	if (convo) return !!convo.user && convo.status !== 'closed';
	const game = state.gamesById[channelId];
	return !!game && isGamePlayer(me, game.players) && isGamePlaying(game);
}
