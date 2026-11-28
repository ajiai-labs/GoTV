// The filters and the order of a game list (Beobachten, Spielen), from the
// data of KGS's game lists only - no extra requests (28.11.2026): room, bots,
// board size, pace, tournament games, a search for player/room/game names,
// and sorting by strength, observers or "just started".
import { getGameTimeSpeed } from './display';
import type { GameChannel, GameFilter, GameRules, GameSpeedFilter, Index, Room } from '../types';

const SPEEDS: Record<ReturnType<typeof getGameTimeSpeed>, GameSpeedFilter> = {
	'very fast': 'veryFast',
	fast: 'fast',
	normal: 'normal',
	slow: 'slow'
};

export function gameRules(game: GameChannel): GameRules | undefined {
	return game.initialProposal ? game.initialProposal.rules : game.rules;
}

export function gameSpeed(game: GameChannel): GameSpeedFilter | null {
	const rules = gameRules(game);
	return rules?.timeSystem ? SPEEDS[getGameTimeSpeed(rules)] : null;
}

function players(game: GameChannel) {
	return Object.values(game.players ?? {}).filter((user) => !!user);
}

function hasBot(game: GameChannel): boolean {
	return players(game).some((user) => !!user?.flags?.robot);
}

// The stronger player's rank value (unknown ranks last).
function strength(game: GameChannel): number {
	return Math.max(-9999, ...players(game).map((user) => user?.rankVal ?? -9999));
}

function matches(game: GameChannel, query: string, roomsById?: Index<Room>): boolean {
	const texts = [
		...players(game).map((user) => user?.name ?? ''),
		game.name ?? '',
		(roomsById && roomsById[game.roomId]?.name) || ''
	];
	return texts.some((text) => text.toLowerCase().includes(query));
}

export function filterGames(
	games: Array<GameChannel>,
	filter: GameFilter | undefined,
	roomsById?: Index<Room>
): Array<GameChannel> {
	if (!filter) return games;
	const query = (filter.query ?? '').trim().toLowerCase();
	const shown = games.filter((game) => {
		if (filter.roomId && game.roomId !== filter.roomId) return false;
		if (filter.excludeBots && hasBot(game)) return false;
		if (filter.size && gameRules(game)?.size !== filter.size) return false;
		if (filter.speed && gameSpeed(game) !== filter.speed) return false;
		if (filter.tournamentOnly && game.type !== 'tournament' && !game.event) return false;
		if (query && !matches(game, query, roomsById)) return false;
		return true;
	});
	const sort = filter.sort ?? 'default';
	if (sort === 'default') return shown;
	const ordered = [...shown];
	if (sort === 'strength') ordered.sort((a, b) => strength(b) - strength(a));
	else if (sort === 'observers') ordered.sort((a, b) => (b.observers ?? 0) - (a.observers ?? 0));
	else ordered.sort((a, b) => (a.moveNum ?? 0) - (b.moveNum ?? 0));
	return ordered;
}

// Whether the list knows any game's time system (then the pace filter
// makes sense - KGS may not send it in its lists).
export function hasKnownSpeed(games: Array<GameChannel>): boolean {
	return games.some((game) => gameSpeed(game) !== null);
}
