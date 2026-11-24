import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { parseSgf } from '#lib/model/sgf.ts';
import { getMainLine } from '#lib/model/ReplayVariation.ts';
import { getKataGoEngine } from '#lib/model/KataGoEngine.ts';
import type { GameMistake, KataGoAnalysis, PositionEval } from '#lib/model/KataGoEngine.ts';
import KataGoPanel from './KataGoPanel.svelte';

const ANALYSIS: KataGoAnalysis = {
	winRate: 0.7,
	scoreLead: -2.5,
	visits: 100,
	toPlay: 'white',
	backend: 'wasm',
	moves: [
		{
			x: 4,
			y: 4,
			winRate: 0.68,
			scoreLead: -2.4,
			visits: 70,
			pointsLost: 0,
			order: 0,
			pv: ['E5', 'F4', 'pass']
		},
		{
			x: 6,
			y: 6,
			winRate: 0.75,
			scoreLead: -1.2,
			visits: 20,
			pointsLost: 1.2,
			order: 1,
			pv: ['G3']
		}
	]
};

// The real worker never runs in tests: the shared engine is stubbed.
function stubEngine() {
	const engine = getKataGoEngine();
	return {
		analyze: vi.spyOn(engine, 'analyze').mockResolvedValue(ANALYSIS),
		evaluateGame: vi
			.spyOn(engine, 'evaluateGame')
			.mockImplementation((_tree, onProgress: (done: number, total: number) => unknown) => {
				onProgress(3, 3);
				const evals: Array<PositionEval> = [
					{ nodeId: 0, move: 0, winRate: 0.5, scoreLead: 0.5 },
					{ nodeId: 1, move: 1, winRate: 0.55, scoreLead: 1 },
					{ nodeId: 2, move: 2, winRate: 0.8, scoreLead: 6 }
				];
				return Promise.resolve(evals);
			}),
		verifyMistakes: vi
			.spyOn(engine, 'verifyMistakes')
			.mockImplementation(
				(
					_tree,
					candidates: Array<GameMistake>,
					onProgress: (done: number, total: number) => unknown
				) => {
					onProgress(candidates.length, candidates.length);
					// The search confirms a smaller loss than the network alone.
					return Promise.resolve(
						candidates.map((candidate) => ({ ...candidate, pointsLost: 4.2 }))
					);
				}
			),
		cancel: vi.spyOn(engine, 'cancel').mockImplementation(() => {}),
		setModelUrl: vi.spyOn(engine, 'setModelUrl').mockImplementation(() => {})
	};
}

describe('KataGoPanel', () => {
	let engine: ReturnType<typeof stubEngine>;

	beforeEach(() => {
		window.localStorage.clear();
		engine = stubEngine();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		window.localStorage.clear();
	});

	it("stays off until switched on, then rates the game's move", async () => {
		const tree = parseSgf('(;GM[1]SZ[9];B[cc];W[gg])');
		const nodeId = getMainLine(tree)[1];
		const onMoves = vi.fn();
		const onLayLine = vi.fn();
		await render(KataGoPanel, { tree, nodeId, onMoves, onLayLine });
		await expect.element(page.getByText(/rechnet im Browser/)).toBeVisible();
		expect(engine.analyze).not.toHaveBeenCalled();

		await page.getByRole('checkbox', { name: 'KataGo-Analyse' }).click();
		await expect.element(page.getByText(/Gewinnchance Schwarz 70 %/)).toBeVisible();
		expect(engine.analyze).toHaveBeenCalledWith(tree, nodeId, 100);
		await expect.element(page.getByText(/Weiß führt mit 2,5 Punkten/)).toBeVisible();
		// The game played G3 (6,6): KataGo's second choice, 1.2 points worse.
		await expect
			.element(page.getByText('Die Partie spielte G3: laut KataGo 1,2 Punkte schlechter als E5.'))
			.toBeVisible();
		expect(onMoves).toHaveBeenLastCalledWith(nodeId, ANALYSIS.moves);
		expect(window.localStorage.getItem('gotv.katago')).toBe('1');

		// KataGo's expected line becomes a variation.
		await expect.element(page.getByText(/erwartet E5 F4 pass/)).toBeVisible();
		await page.getByRole('button', { name: 'Variante legen' }).first().click();
		expect(onLayLine).toHaveBeenCalledWith(
			[
				{ x: 4, y: 4 },
				{ x: 5, y: 5 }
			],
			'KataGo-Variante: E5 · Schwarz 68 % · Weiß führt mit 2,4 Punkten'
		);

		// Switched off: the labels go, nothing is computed any more.
		await page.getByRole('checkbox', { name: 'KataGo-Analyse' }).click();
		expect(onMoves).toHaveBeenLastCalledWith(nodeId, null);
		expect(window.localStorage.getItem('gotv.katago')).toBe('0');
	});

	it('asks again with the chosen visits', async () => {
		window.localStorage.setItem('gotv.katago', '1');
		const tree = parseSgf('(;GM[1]SZ[9];B[cc];W[gg])');
		await render(KataGoPanel, { tree, nodeId: tree.rootNode, onMoves: vi.fn() });
		await expect.element(page.getByText(/Gewinnchance Schwarz 70 %/)).toBeVisible();
		await page.getByRole('combobox', { name: 'Visits' }).selectOptions('400');
		await expect.poll(() => engine.analyze.mock.lastCall?.[2]).toBe(400);
	});

	it('evaluates the whole game: curve and biggest mistakes', async () => {
		window.localStorage.setItem('gotv.katago', '1');
		const tree = parseSgf('(;GM[1]SZ[9];B[cc];W[gg])');
		const line = getMainLine(tree);
		const onJump = vi.fn();
		await render(KataGoPanel, { tree, nodeId: line[0], onMoves: vi.fn(), onJump });
		await page.getByRole('button', { name: 'Ganze Partie auswerten' }).click();
		await expect
			.element(page.getByRole('slider', { name: 'Gewinnchance Schwarz über die ganze Partie' }))
			.toBeVisible();
		expect(engine.evaluateGame).toHaveBeenCalled();
		expect(engine.verifyMistakes.mock.calls[0][1].map((c) => c.move)).toEqual([2]);
		// W G3 let black's lead go from 1 to 6: white lost there.
		const mistake = page.getByRole('button', {
			name: 'Zug 2 · Weiß G3: −25 % · −4,2 Punkte',
			exact: true
		});
		await expect.element(mistake).toBeVisible();
		await mistake.click();
		expect(onJump).toHaveBeenCalledWith(1);
	});
});
