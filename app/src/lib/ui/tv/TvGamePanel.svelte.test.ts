import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { app } from '#lib/app.svelte.ts';
import type { AppActions } from '#lib/model/AppActions.ts';
import { getInitialState } from '#lib/model/appState.ts';
import { parseSgf } from '#lib/model/sgf.ts';
import type { GameChannel } from '#lib/model/types.ts';
import TvGamePanel from './TvGamePanel.svelte';

function game(source: 'kgs' | 'ogs'): GameChannel {
	const tree = parseSgf('(;SZ[9];B[aa])');
	const last = tree.currentLine[1];
	return {
		id: source === 'ogs' ? 7 : 42,
		type: 'tournament',
		moveNum: 1,
		tvSource: source,
		players: { black: { name: 'anna', rank: '2d' }, white: { name: 'bert', rank: '1d' } },
		tree: { ...tree, activeNode: last, currentNode: last }
	} as GameChannel;
}

describe('TvGamePanel', () => {
	let actions: Record<string, ReturnType<typeof vi.fn>>;

	beforeEach(() => {
		actions = { onUserDetail: vi.fn(), onObserveTvGame: vi.fn(() => () => {}) };
		app._actions = actions as unknown as AppActions;
		app.state = getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 });
	});

	it('opens the KGS profile of a player on a KGS board', async () => {
		await render(TvGamePanel, { game: game('kgs') });
		await page.getByRole('button', { name: /anna/ }).first().click();
		expect(actions.onUserDetail).toHaveBeenCalledWith('anna');
	});

	it('does not look an OGS player up on KGS (may be someone else there)', async () => {
		await render(TvGamePanel, { game: game('ogs') });
		await page.getByRole('button', { name: /anna/ }).first().click();
		expect(actions.onUserDetail).not.toHaveBeenCalled();
	});

	it('estimates the score of a broadcast game (as CGoban, no AI)', async () => {
		await render(TvGamePanel, { game: game('ogs') });
		await page.getByRole('button', { name: /Mehr/ }).click();
		await page.getByRole('button', { name: 'Ergebnis schätzen' }).click();
		await expect
			.element(page.getByRole('dialog', { name: 'Ergebnis schätzen' }).getByText(/ohne KI/))
			.toBeVisible();
	});

	it('offers no estimate for my own running game', async () => {
		app.state = { ...app.state, currentUser: { name: 'anna', rank: '2d' } };
		await render(TvGamePanel, { game: game('kgs') });
		await page.getByRole('button', { name: /Mehr/ }).click();
		await expect.element(page.getByText('Partieinfo')).toBeVisible();
		await expect.element(page.getByText('Ergebnis schätzen')).not.toBeInTheDocument();
	});
});
