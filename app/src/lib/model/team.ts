// Brettübersicht (wish of the user, 26.11.2026): several KGS games in one
// calm window of their own, apart from your own game - for a team match
// (Go-Bundesliga) or any games you want to follow. You bring the games in
// yourself, from Beobachten or a player's profile ("Zur Brettübersicht"); a
// board keeps its game until you take it off, also after the game ended.

import { isGamePlaying } from './game';
import type { GameChannel } from './types';

export const TEAM_KEY = 'gotv.team';
export const TEAM_BOARDS = 4;

// Board N (1..TEAM_BOARDS) shows boards[N - 1]: a KGS game id or null.
export type TeamBoards = Array<number | null>;

export function emptyBoards(): TeamBoards {
	return Array.from({ length: TEAM_BOARDS }, () => null);
}

export function loadBoards(storage: Storage = window.localStorage): TeamBoards {
	const boards = emptyBoards();
	try {
		const stored = JSON.parse(storage.getItem(TEAM_KEY) ?? '[]') as unknown;
		if (Array.isArray(stored)) {
			stored.slice(0, TEAM_BOARDS).forEach((id, i) => {
				boards[i] = typeof id === 'number' && id > 0 ? id : null;
			});
		}
	} catch {
		// broken entry: empty boards
	}
	return boards;
}

export function saveBoards(boards: TeamBoards, storage: Storage = window.localStorage) {
	try {
		storage.setItem(TEAM_KEY, JSON.stringify(boards));
	} catch {
		// not remembered without storage
	}
}

// A game on the first free board (unchanged if it is there already);
// null if all boards are taken. `isKnown`: whether a game id still means a
// game - ids of an earlier KGS session (before logging in again) do not,
// so their boards count as free.
export function addBoard(
	boards: TeamBoards,
	gameId: number,
	isKnown: (id: number) => boolean = () => true
): TeamBoards | null {
	if (boards.includes(gameId)) return boards;
	const free = boards.findIndex((id) => id == null || !isKnown(id));
	if (free === -1) return null;
	return boards.map((id, i) => (i === free ? gameId : id));
}

export function removeBoard(boards: TeamBoards, board: number): TeamBoards {
	return boards.map((id, i) => (i === board - 1 ? null : id));
}

// The running KGS games of a player (KGS list of active games), e.g. for
// "Zur Brettübersicht" in the player's profile.
export function findRunningGames(
	activeGames: Array<GameChannel>,
	name: string
): Array<GameChannel> {
	const wanted = name.toLowerCase();
	return activeGames.filter(
		(game) =>
			isGamePlaying(game) &&
			[game.players?.white?.name, game.players?.black?.name].some(
				(player) => !!player && player.toLowerCase() === wanted
			)
	);
}
