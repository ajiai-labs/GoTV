import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { parseRankGraph } from '#lib/model/user.ts';
import UserRankGraph from './UserRankGraph.svelte';

describe('UserRankGraph', () => {
	it('draws a detailed graph: period, every rank, quarter ranks, years', async () => {
		await page.viewport(960, 600);
		// A year between about 1d and 2d.
		const data = Array.from({ length: 390 }, (_, i) => 20 + Math.round(30 * Math.sin(i / 20)));
		const view = await render(UserRankGraph, { graph: parseRankGraph(data), name: 'andy1975' });
		await expect.element(page.getByText(/^Ranggraph für andy1975 \(.+ bis .+\)$/)).toBeVisible();
		const svg = view.container.querySelector('svg')!;
		const labels = [...svg.querySelectorAll('text')].map((text) => text.textContent?.trim());
		expect(labels).toEqual(expect.arrayContaining(['1d', '2d']));
		// Rank lines 1k..2d plus three quarter lines between each two.
		expect(svg.querySelectorAll('.grid.rank')).toHaveLength(3);
		expect(svg.querySelectorAll('.grid.minor')).toHaveLength(6);
		expect(svg.querySelectorAll('.label.year').length).toBeGreaterThanOrEqual(2);
	});

	it('says when a player has no rank graph', async () => {
		await render(UserRankGraph, { graph: parseRankGraph([]), name: 'gast' });
		await expect.element(page.getByText(/keinen Rangverlauf/)).toBeVisible();
	});
});
