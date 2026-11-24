import { isRecord } from '../util/error';
// Finished OGS games of a tournament, for the replay list. Results are left
// out on purpose: the list must not spoil a game before it is replayed
// (SgfReplayView shows the result only at the last move).
export const OGS_GAME_URL = 'https://online-go.com/game/';
const OGS_API_GAMES_URL = 'https://online-go.com/api/v1/games/';
export type ReplayGame = {
	id: number;
	black: string;
	white: string;
	started: number;
	sgfUrl: string;
};
export function getOgsSgfUrl(gameId: number): string {
	return OGS_API_GAMES_URL + gameId + '/sgf';
}

function getName(player: unknown): string {
	const name = isRecord(player) ? player.username : null;
	return typeof name === 'string' && name ? name : '?';
}

// A raw OGS game (list entry or detail) that is over and really played -
// cancelled/annulled games and games still running are not replayable.
export function toReplayGame(raw: unknown): ReplayGame | null | undefined {
	if (!isRecord(raw) || typeof raw.id !== 'number') {
		return null;
	}

	const game: Record<string, any> = raw;

	if (!game.ended || game.annulled || game.outcome === 'Cancellation') {
		return null;
	}

	const players = game.players || {};
	const started = Date.parse(game.started);
	return {
		id: game.id,
		black: getName(players.black),
		white: getName(players.white),
		started: isNaN(started) ? 0 : started,
		sgfUrl: getOgsSgfUrl(game.id)
	};
}
// Replayable games in playing order; with players given, only games in
// which every one of them took part (case-insensitive).
export function pickReplayGames(
	rawGames: Array<unknown>,
	players?: Array<string> | null | undefined
): Array<ReplayGame> {
	const wanted = (players || []).map((name) => name.trim().toLowerCase());
	return rawGames
		.map(toReplayGame)
		.filter((game): game is ReplayGame => !!game)
		.filter((game) => {
			const names = [game.black.toLowerCase(), game.white.toLowerCase()];
			return wanted.every((name) => names.indexOf(name) !== -1);
		})
		.sort((a, b) => a.started - b.started || a.id - b.id);
}
