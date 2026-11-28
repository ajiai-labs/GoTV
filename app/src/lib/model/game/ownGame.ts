import type { AppState } from '#lib/model/types.ts';
import { isGamePlayer, isGamePlaying } from './tree.ts';

// Your own running KGS game (joined, you are a player, not over): while it
// runs, nothing may cut the KGS connection - no update of the script
// installation, no restart, no reload (user, 28.11.2026: he plays in GoTV
// while it updates, and tests its stability that way).
export function hasOwnRunningGame(state: AppState): boolean {
	const me = state.currentUser?.name;
	if (!me) return false;
	return Object.values(state.gamesById).some(
		(game) =>
			!!game &&
			!!state.channelMembership[game.id] &&
			!!game.players &&
			isGamePlayer(me, game.players) &&
			isGamePlaying(game)
	);
}

// Is this game your own running one? (A game window with it stays open when
// the main window closes - windowFamily.ts.)
export function isOwnRunningGame(state: AppState, gameId: number): boolean {
	const me = state.currentUser?.name;
	const game = state.gamesById[gameId];
	return !!me && !!game?.players && isGamePlayer(me, game.players) && isGamePlaying(game);
}
