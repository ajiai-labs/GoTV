// "Spielern folgen" (KGS only - the user plays on KGS; OGS is just a board
// source for broadcasts): names of KGS players the user follows, kept in
// this browser (gotv.followedPlayers, also in the "Meine Daten" backup), and
// which of them play right now according to the KGS list of running games.
import type { GameChannel, User } from './types';

export const FOLLOWED_PLAYERS_KEY = 'gotv.followedPlayers';
export const MAX_FOLLOWED_PLAYERS = 100;

function sameName(a: string, b: string): boolean {
	return a.toLowerCase() === b.toLowerCase();
}

export function loadFollowedPlayers(storage: Storage = window.localStorage): Array<string> {
	try {
		const value: unknown = JSON.parse(storage.getItem(FOLLOWED_PLAYERS_KEY) || '[]');
		return Array.isArray(value)
			? value.filter((name): name is string => typeof name === 'string' && !!name)
			: [];
	} catch {
		return []; // storage disabled or broken entry
	}
}

export function saveFollowedPlayers(names: Array<string>, storage: Storage = window.localStorage) {
	try {
		storage.setItem(FOLLOWED_PLAYERS_KEY, JSON.stringify(names));
	} catch {
		// not remembered without storage
	}
}

export function isFollowed(names: Array<string>, name: string): boolean {
	return names.some((followed) => sameName(followed, name));
}

// A new list with the player added or removed (newest first).
export function toggleFollowed(names: Array<string>, name: string): Array<string> {
	return isFollowed(names, name)
		? names.filter((followed) => !sameName(followed, name))
		: [name, ...names].slice(0, MAX_FOLLOWED_PLAYERS);
}

// Both lists together, without duplicates ("Meine Daten" restore).
export function mergeFollowed(own: unknown, incoming: unknown): Array<string> {
	const all = [
		...(Array.isArray(own) ? own : []),
		...(Array.isArray(incoming) ? incoming : [])
	].filter((name): name is string => typeof name === 'string' && !!name);
	return all.filter((name, index) => all.findIndex((other) => sameName(other, name)) === index);
}

export type FollowedGame = {
	name: string; // the followed player, spelled as KGS spells it
	game: GameChannel;
	opponent: User | null;
};

// Running games (not over, not deleted) in which a followed player plays.
export function getFollowedGames(
	games: Array<GameChannel>,
	names: Array<string>
): Array<FollowedGame> {
	const result: Array<FollowedGame> = [];
	for (const game of games) {
		if (game.over || game.deletedTime || game.type === 'challenge') continue;
		const players = Object.values(game.players || {}).filter((user): user is User => !!user);
		for (const player of players) {
			if (!isFollowed(names, player.name)) continue;
			const opponent = players.find((other) => other.name !== player.name) || null;
			result.push({ name: player.name, game, opponent });
		}
	}
	return result;
}
