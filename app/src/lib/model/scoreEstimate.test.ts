import { describe, expect, it } from 'vitest';
import { estimateScore } from './scoreEstimate';
import type { BoardState } from './types';

// Rows top to bottom: X black, O white, . empty.
function board(rows: Array<string>): BoardState {
	return rows.map((row) => [...row].map((c) => (c === 'X' ? 'black' : c === 'O' ? 'white' : null)));
}

const SPLIT = board([
	'..X.O....',
	'..X.O....',
	'..X.O....',
	'..X.O....',
	'..X.O....',
	'..X.O....',
	'..X.O....',
	'..X.O....',
	'..X.O....'
]);

describe('score estimate', () => {
	it('gives each side its walled-off area', () => {
		const estimate = estimateScore(SPLIT, { komi: 0, blackCaptures: 0, whiteCaptures: 0 });
		expect(estimate.blackTerritory).toBe(18); // columns a and b
		expect(estimate.whiteTerritory).toBe(36); // columns f to j
		expect(estimate.deadBlack + estimate.deadWhite).toBe(0);
		// Japanese counting: territory only, komi to white.
		expect(estimate.margin).toBe(18 - 36);
		expect(estimate.markup.marks[0]?.[0]).toBe('blackTerritory');
		expect(estimate.markup.marks[0]?.[8]).toBe('whiteTerritory');
		// The shared column between the walls is nobody's.
		expect(estimate.markup.marks[0]?.[3]).toBeUndefined();
	});

	it('counts komi and captures, or stones under area rules', () => {
		const japanese = estimateScore(SPLIT, { komi: 6.5, blackCaptures: 3, whiteCaptures: 1 });
		expect(japanese.blackScore).toBe(18 + 3);
		expect(japanese.whiteScore).toBe(36 + 1 + 6.5);
		const chinese = estimateScore(SPLIT, {
			komi: 7.5,
			rules: 'chinese',
			blackCaptures: 3,
			whiteCaptures: 1
		});
		expect(chinese.blackScore).toBe(18 + 9);
		expect(chinese.whiteScore).toBe(36 + 9 + 7.5);
	});

	it('marks a lone stone inside the other side as dead', () => {
		// Both sides alive with two eyes each; a black stone inside white.
		const rows = board([
			'.X.XO.O.O',
			'XXXXOOOOO',
			'.X.XO.O.O',
			'XXXXOOOOO',
			'...XO..X.',
			'XXXXOOOOO',
			'.X.XO.O.O',
			'XXXXOOOOO',
			'.X.XO..O.'
		]);
		const estimate = estimateScore(rows, { komi: 0, blackCaptures: 0, whiteCaptures: 0 });
		expect(estimate.deadBlack).toBe(1);
		expect(estimate.deadWhite).toBe(0);
		expect(estimate.markup.marks[4]?.[7]).toBe('dead');
		// Its point and the prisoner both go to white.
		expect(estimate.whiteTerritory).toBe(13);
		expect(estimate.whiteScore).toBe(13 + 1);
	});

	it('marks a framework still open for its side, but counts it only in part', () => {
		// Black's wall on the third line from the left, white's on the right,
		// the middle open: the points near each wall lean to its side.
		const rows = Array.from({ length: 19 }, () => Array<string>(19).fill('.'));
		for (let y = 2; y < 17; y += 2) {
			rows[y][2] = 'X';
			rows[y][16] = 'O';
		}
		const estimate = estimateScore(board(rows.map((row) => row.join(''))), {
			komi: 0,
			blackCaptures: 0,
			whiteCaptures: 0
		});
		const marks = estimate.markup.marks;
		expect(marks[9]?.[4]).toBe('blackTerritory');
		expect(marks[9]?.[14]).toBe('whiteTerritory');
		const markedBlack = Object.values(marks)
			.flatMap((row) => Object.values(row))
			.filter((mark) => mark === 'blackTerritory').length;
		expect(estimate.blackTerritory).toBeGreaterThan(0);
		expect(estimate.blackTerritory).toBeLessThan(markedBlack);
	});

	it('finds a two-stone group without eyes inside the other side dead', () => {
		const estimate = estimateScore(
			board([
				'.X.X.X...',
				'XXXXXXXXX',
				'.........',
				'.........',
				'...OO....',
				'.........',
				'.........',
				'XXXXXXXXX',
				'.X.X.X...'
			]),
			{ komi: 0, blackCaptures: 0, whiteCaptures: 0 }
		);
		expect(estimate.deadWhite).toBe(2);
		expect(estimate.markup.marks[4]?.[3]).toBe('dead');
	});

	it('gives the same answer for the same position', () => {
		const a = estimateScore(SPLIT, { komi: 6.5, blackCaptures: 0, whiteCaptures: 0, playouts: 50 });
		const b = estimateScore(SPLIT, { komi: 6.5, blackCaptures: 0, whiteCaptures: 0, playouts: 50 });
		expect(a.ownership).toEqual(b.ownership);
	});

	it('is fast enough on a full 19x19 board', () => {
		const empty: BoardState = Array.from({ length: 19 }, () => Array(19).fill(null));
		empty[3][3] = 'black';
		empty[15][15] = 'white';
		const started = performance.now();
		estimateScore(empty, { komi: 6.5, blackCaptures: 0, whiteCaptures: 0 });
		expect(performance.now() - started).toBeLessThan(3000);
	});
});
