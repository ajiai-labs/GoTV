// Sample content for the design drafts (docs/umbau-svelte.md, phase 2a):
// the European Championship 2026 final (Kravets - Jabarin, bundled since the
// current app) read with the ported SGF logic, plus a few real calendar
// entries. Replaced by live data in phase 2b.
import finalSgf from './em-finale-2026.sgf?raw';
import { parseSgf, getSgfPlayerNames } from '#lib/model/sgf.ts';
import { getMainLine } from '#lib/model/ReplayVariation.ts';
import type { BoardState, GameTree, Point } from '#lib/model/types.ts';

let cached: { tree: GameTree; mainLine: Array<number> } | null = null;

function game() {
	if (!cached) {
		const tree = parseSgf(finalSgf);
		cached = { tree, mainLine: getMainLine(tree) };
	}
	return cached;
}

export function finalPlayers(): { black: string; white: string } {
	const names = getSgfPlayerNames(game().tree);
	return { black: names.black ?? 'Schwarz', white: names.white ?? 'Weiß' };
}

export function finalMoveCount(): number {
	return game().mainLine.length - 1;
}

// The position after `move` moves, with the move just played.
export function finalPosition(move: number): { board: BoardState; lastMove: Point | null } {
	const { tree, mainLine } = game();
	const nodeId = mainLine[Math.max(0, Math.min(move, mainLine.length - 1))];
	const board = tree.computedState[nodeId].board;
	const moveProp = tree.nodes[nodeId].props.find((prop) => prop.name === 'MOVE');
	const loc = moveProp?.loc;
	return { board, lastMove: loc && loc !== 'PASS' ? loc : null };
}

// A smooth sample curve (black's chance to win) for the draft only - the
// real one comes from KataGo in phase 4.
export function sampleCurve(moves: number): Array<number> {
	return Array.from({ length: moves + 1 }, (_, i) => {
		const t = i / moves;
		return 0.5 + 0.18 * Math.sin(t * 5.2) * (1 - t * 0.4) + 0.22 * t * t;
	});
}

export const upcoming = [
	{
		id: 'speedgo-2026-11-29',
		day: '2026-11-29',
		time: '18:00',
		title: 'Speed Go Championship',
		detail: 'Valerii Krushelnytskyi 7d gegen Denis Dobranis 6d',
		where: 'EGF auf Twitch',
		starred: true
	},
	{
		id: 'kranich-2026',
		day: '2026-11-28',
		time: 'ganztägig',
		title: 'Berliner Kranich',
		detail: 'Turnier in Berlin, Partien auf KGS',
		where: 'KGS',
		starred: false
	},
	{
		id: 'speedgo-2026-12-01',
		day: '2026-12-01',
		time: '18:00',
		title: 'Speed Go Championship',
		detail: 'Lukáš Podpěra 7d gegen Benjamin Dréan-Guénaïzia 1p',
		where: 'EGF auf Twitch',
		starred: false
	}
];

export const channels = [
	{
		id: 'jupptube',
		name: 'JuppTube',
		who: 'Franz-Josef Dickhut',
		schedule: 'Sonntag 10:30',
		platform: 'YouTube',
		starred: true,
		player: true
	},
	{
		id: 'dojang',
		name: 'Yunguseng Dojang',
		who: 'In-seong Hwang',
		schedule: null,
		platform: 'Twitch',
		starred: false,
		player: true
	},
	{
		id: 'egf',
		name: 'European Go Federation',
		who: null,
		schedule: null,
		platform: 'Twitch',
		starred: true,
		player: false
	},
	{
		id: 'baduk-tv',
		name: 'Baduk TV',
		who: null,
		schedule: null,
		platform: 'YouTube',
		starred: false,
		player: false
	}
];
