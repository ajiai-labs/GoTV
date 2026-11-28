// "Alle Partien herunterladen" (28.11.2026, wish of the user: an archive of
// international and city tournaments): the finished OGS games of a calendar
// tournament as one ZIP - each game as SGF (G1, G2 … with the players), plus
// a list of the games with their OGS links. Fetched one after the other with
// a short pause: OGS answers bursts with 429. Games that fail are listed as
// missing; the archive still comes.
import type { ReplayGame } from './OgsReplay';
import type { TvEvent } from './tv';
import { makeZip } from '../util/zip';

export const ARCHIVE_PAUSE_MS = 300;

// Characters file systems refuse, and runs of spaces.
export function safeFileName(text: string): string {
	return (
		text
			.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 120) || 'Partie'
	);
}

export function archiveGameName(game: ReplayGame, index: number): string {
	return safeFileName(`G${index + 1} ${game.black} - ${game.white}`) + '.sgf';
}

export type ArchiveResult = {
	zip: Uint8Array<ArrayBuffer>;
	fileName: string;
	missing: Array<number>; // G numbers that could not be loaded
};

export async function buildTournamentArchive(
	event: TvEvent,
	games: Array<ReplayGame>,
	options: {
		fetchFn?: typeof fetch;
		onProgress?: (done: number, total: number) => void;
		pauseMs?: number;
		listText: (lines: Array<string>, missing: Array<number>) => string;
	}
): Promise<ArchiveResult> {
	const fetchFn = options.fetchFn ?? fetch;
	const pause = options.pauseMs ?? ARCHIVE_PAUSE_MS;
	const folder = safeFileName(event.name);
	const encoder = new TextEncoder();
	const entries: Array<{ name: string; data: Uint8Array }> = [];
	const missing: Array<number> = [];
	const lines: Array<string> = [];

	for (const [index, game] of games.entries()) {
		if (index > 0 && pause > 0) await new Promise((resolve) => setTimeout(resolve, pause));
		const name = archiveGameName(game, index);
		lines.push(
			`G${index + 1}  ${game.black} - ${game.white}  https://online-go.com/game/${game.id}`
		);
		try {
			const response = await fetchFn(game.sgfUrl);
			if (!response.ok) throw new Error(String(response.status));
			const sgf = await response.text();
			if (!sgf.trim().startsWith('(')) throw new Error('no SGF');
			entries.push({ name: `${folder}/${name}`, data: encoder.encode(sgf) });
		} catch {
			missing.push(index + 1);
		}
		options.onProgress?.(index + 1, games.length);
	}

	entries.push({
		name: `${folder}/Partien.txt`,
		data: encoder.encode(options.listText(lines, missing))
	});
	return { zip: makeZip(entries), fileName: `${folder}.zip`, missing };
}
