import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Board from './Board.svelte';
import type { BoardState } from '#lib/model/types.ts';

function emptyBoard(size: number): BoardState {
	return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
}

describe('Board', () => {
	it('draws stones, star points and the last move', async () => {
		const board = emptyBoard(19);
		board[3][3] = 'black';
		board[15][15] = 'white';
		const screen = await render(Board, { board, lastMove: { x: 15, y: 15 } });
		const svg = screen.container.querySelector('svg')!;
		expect(svg.querySelectorAll('.stone')).toHaveLength(2);
		expect(svg.querySelectorAll('.star')).toHaveLength(9);
		expect(svg.querySelector('.last.white')).not.toBeNull();
	});

	it('shows territory as small stones for the score estimate (as CGoban)', async () => {
		const board = emptyBoard(9);
		board[0][1] = 'white';
		const markup = {
			marks: {
				0: { 0: 'blackTerritory' as const, 1: 'dead' as const, 2: 'whiteTerritory' as const }
			},
			labels: {}
		};
		const plain = await render(Board, { board, markup });
		expect(plain.container.querySelectorAll('.territory')).toHaveLength(2);
		await plain.unmount();
		const screen = await render(Board, { board, markup, territoryStones: true });
		const small = screen.container.querySelectorAll('.territory-stone');
		// Two territory points and the dead white stone with a black one on it.
		expect(small).toHaveLength(3);
		expect(small[1].getAttribute('fill')).toContain('-black');
		expect(screen.container.querySelectorAll('.territory')).toHaveLength(0);
	});

	it('marks the five star points of a 9x9 board and reports clicks', async () => {
		let clicked: { x: number; y: number } | null = null;
		const screen = await render(Board, {
			board: emptyBoard(9),
			coordinates: false,
			onpoint: (p: { x: number; y: number }) => (clicked = p)
		});
		const svg = screen.container.querySelector('svg')!;
		expect(svg.querySelectorAll('.star')).toHaveLength(5);
		(svg.querySelectorAll('.hit')[9 * 4 + 4] as SVGElement).dispatchEvent(
			new MouseEvent('click', { bubbles: true })
		);
		expect(clicked).toEqual({ x: 4, y: 4 });
	});
});
