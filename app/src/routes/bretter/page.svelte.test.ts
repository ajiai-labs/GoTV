import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { app } from '#lib/app.svelte.ts';
import type { AppActions } from '#lib/model/AppActions.ts';
import { getInitialState } from '#lib/model/index.ts';
import { parseSgf } from '#lib/model/sgf.ts';
import type { GameChannel, User } from '#lib/model/types.ts';
import Page from './+page.svelte';

const me: User = { name: 'gotvfan', rank: '3k', flags: { connected: true } };
const lukan: User = { name: 'Lukan', rank: '7d', flags: { connected: true } };
const siasio: User = { name: 'Siasio', rank: '2p', flags: { connected: true } };
const anna: User = { name: 'anna', rank: '5d', flags: { connected: true } };

function game(id: number, white: User, black: User, extra: Partial<GameChannel> = {}): GameChannel {
	return {
		id,
		type: 'ranked',
		time: 0,
		players: { white, black },
		moveNum: 1,
		roomId: 1,
		rules: { size: 9, komi: 6.5 },
		tree: parseSgf('(;GM[1]SZ[9];B[cg])'),
		...extra
	};
}

describe('Brettübersicht', () => {
	let actions: Record<string, ReturnType<typeof vi.fn>>;

	beforeEach(() => {
		actions = { onJoinGameQuietly: vi.fn() };
		app._actions = actions as unknown as AppActions;
		app.state = {
			...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
			initialized: true,
			currentUser: me,
			gamesById: {
				90: game(90, lukan, anna),
				91: game(91, anna, siasio, { over: true, score: 'W+RESIGN' })
			}
		};
		localStorage.setItem('gotv.team', JSON.stringify([90, null, 91, null]));
		localStorage.removeItem('gotv.teamView');
	});

	afterEach(() => {
		app._actions = null;
		localStorage.removeItem('gotv.team');
		localStorage.removeItem('gotv.teamView');
	});

	it('shows the boards in their places and joins the running games', async () => {
		await render(Page);
		await expect.element(page.getByRole('region', { name: 'Brett 1' })).toBeVisible();
		await expect.element(page.getByRole('region', { name: 'Brett 3' })).toBeVisible();
		await expect.element(page.getByRole('region', { name: 'Brett 2' })).not.toBeInTheDocument();
		await expect.element(page.getByText('Lukan [7d] – anna [5d]')).toBeVisible();
		expect(actions.onJoinGameQuietly).toHaveBeenCalledWith(90);
		expect(actions.onJoinGameQuietly).not.toHaveBeenCalledWith(91); // over
		// No chat and nothing to type in: only positions.
		await expect.element(page.getByRole('textbox')).not.toBeInTheDocument();
	});

	it('shows one board big, remembers it, and goes back with Esc', async () => {
		await render(Page);
		await page.getByRole('button', { name: /Lukan \[7d\] – anna/ }).click();
		await expect.element(page.getByRole('button', { name: 'Alle Bretter' })).toBeVisible();
		expect(localStorage.getItem('gotv.teamView')).toBe('1');
		await userEvent.keyboard('{Escape}');
		await expect
			.element(page.getByRole('button', { name: 'Alle Bretter' }))
			.not.toBeInTheDocument();
		await expect.element(page.getByRole('region', { name: 'Brett 3' })).toBeVisible();
	});

	it('takes a board off', async () => {
		await render(Page);
		await page
			.getByRole('region', { name: 'Brett 3' })
			.getByRole('button', { name: 'Vom Brett nehmen' })
			.click();
		await expect.element(page.getByRole('region', { name: 'Brett 3' })).not.toBeInTheDocument();
		expect(JSON.parse(localStorage.getItem('gotv.team') ?? '[]')).toEqual([90, null, null, null]);
	});
});
