// Chooses which OGS game belongs to a calendar broadcast that names its
// players (events.json "ogs_players") instead of a fixed game id - e.g. a
// best-of-five, where each game gets its id only when it starts.
function normalize(name: unknown): string {
	return typeof name === 'string' ? name.trim().toLowerCase() : '';
}

function getPlayerNames(game: Record<string, any>): Array<string> {
	const players = (game && game.players) || {};
	return [players.black, players.white]
		.map((player) => normalize(player && player.username))
		.filter(Boolean);
}

// games: entries of OGS' /players/<id>/games/ list. A game counts only if
// every listed player takes part and it started inside the broadcast window,
// so no unrelated game of a player can show up. A running game wins; without
// one the latest finished game stays until the next one begins.
export function pickOgsGameId(
	games: Array<Record<string, any>>,
	players: Array<string>,
	windowStartMs: number
): number | null | undefined {
	const wanted = players.map(normalize).filter(Boolean);

	if (!wanted.length) {
		return null;
	}

	const candidates = games.filter((game) => {
		if (!game || typeof game.id !== 'number') {
			return false;
		}

		const names = getPlayerNames(game);
		const started = Date.parse(game.started);
		return (
			wanted.every((name) => names.indexOf(name) !== -1) &&
			!isNaN(started) &&
			started >= windowStartMs
		);
	});
	const running = candidates.filter((game) => !game.ended);
	const pool = running.length ? running : candidates;
	return pool.length ? Math.max(...pool.map((game) => game.id)) : null;
}
