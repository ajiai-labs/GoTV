import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { parseSgf } from '#lib/model/sgf.ts';
import { computeGameNodeStates } from '#lib/model/game/tree.ts';
import type { GameChannel } from '#lib/model/types.ts';
import ScoreEstimateDialog from './ScoreEstimateDialog.svelte';

// Black walls off the left two columns, white the right four (9x9).
function gameWithWalls(): GameChannel {
	const black = Array.from({ length: 9 }, (_, y) => `[c${'abcdefghi'[y]}]`).join('');
	const white = Array.from({ length: 9 }, (_, y) => `[e${'abcdefghi'[y]}]`).join('');
	const tree = parseSgf(`(;SZ[9]KM[0.5]AB${black}AW${white})`);
	const node = tree.rootNode;
	return {
		id: 1,
		type: 'free',
		rules: { size: 9, komi: 0.5, rules: 'japanese' },
		tree: { ...tree, currentNode: node, computedState: computeGameNodeStates(tree, node) }
	} as unknown as GameChannel;
}

describe('ScoreEstimateDialog', () => {
	it('shows who leads and by how much, with the territory on the board', async () => {
		const onclose = vi.fn();
		await render(ScoreEstimateDialog, { game: gameWithWalls(), onclose });
		const dialog = page.getByRole('dialog', { name: 'Ergebnis schätzen' });
		await expect.element(dialog.getByText(/Weiß liegt etwa .* Punkte vorn/)).toBeVisible();
		await expect.element(dialog.getByText(/mit 0,5 Komi/)).toBeVisible();
		await expect.element(dialog.getByText(/ohne KI/)).toBeVisible();
		await dialog.getByRole('button', { name: /Schließen/ }).click();
		expect(onclose).toHaveBeenCalled();
	});
});
