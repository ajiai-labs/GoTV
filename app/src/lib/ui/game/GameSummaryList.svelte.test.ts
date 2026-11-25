import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { summaries } from '#lib/model/__fixtures__/challenge.ts';
import GameSummaryList from './GameSummaryList.svelte';

describe('GameSummaryList', () => {
	it('shows players, result and a game in play, and selects a game on click', async () => {
		const onSelect = vi.fn();
		await render(GameSummaryList, { games: summaries, player: 'gotvfan', onSelect });
		const items = page.getByRole('button');
		await expect.element(items.nth(0)).toMatchTextContent(/gotvfan\s*\[3k\]\s*bernd\s*\[5k\]/);
		// Won from gotvfan's view (white, won by resignation)
		await expect.element(items.nth(0)).toMatchTextContent('Gewonnen: W+Aufgabe');
		await expect.element(items.nth(1)).toMatchTextContent('Läuft gerade');
		// Open on KGS right now: bold, as in CGoban's "Fortsetzen" list.
		await expect.element(items.nth(1)).toHaveClass('GameSummaryList-item-open');
		await expect.element(items.nth(0)).not.toHaveClass('GameSummaryList-item-open');
		await items.nth(1).click();
		expect(onSelect).toHaveBeenCalledWith(summaries[1]);
	});

	it('renders long archives completely', async () => {
		const games = Array.from({ length: 20 }, (_, i) => ({
			...summaries[0],
			timestamp: `2026-10-${String(i + 1).padStart(2, '0')}T18:00:00.000Z`
		}));
		await render(GameSummaryList, { games, onSelect: vi.fn() });
		await expect.poll(() => page.getByRole('button').elements().length).toBe(20);
	});
});
