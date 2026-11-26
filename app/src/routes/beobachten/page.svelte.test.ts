import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { app } from '#lib/app.svelte.ts';
import type { AppActions } from '#lib/model/AppActions.ts';
import { getInitialState } from '#lib/model/index.ts';
import { parseSgf } from '#lib/model/sgf.ts';
import type { GameChannel, User } from '#lib/model/types.ts';
import Page from './+page.svelte';

const me: User = { name: 'gotvfan', rank: '3k', flags: { connected: true } };
const anna: User = { name: 'anna', rank: '2d', flags: { connected: true } };
const bert: User = { name: 'bert', rank: '1k', flags: { connected: true } };

function game(id: number, name: string): GameChannel {
	return {
		id,
		type: 'ranked',
		time: 0,
		players: { white: anna, black: bert },
		moveNum: 0,
		roomId: 1,
		name,
		rules: { size: 9, komi: 6.5 },
		tree: parseSgf('(;GM[1]SZ[9];B[cg])')
	};
}

function setState(extra: Record<string, unknown> = {}) {
	const games = [game(11, 'Erste Partie'), game(12, 'Zweite Partie')];
	app.state = {
		...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
		initialized: true,
		currentUser: me,
		usersByName: { gotvfan: me, anna, bert },
		roomsById: { 1: { id: 1, name: 'Deutscher Raum' } } as never,
		gamesById: { 11: games[0], 12: games[1] },
		activeGames: games,
		...extra
	};
}

describe('Beobachten', () => {
	let actions: Record<string, ReturnType<typeof vi.fn>>;

	beforeEach(() => {
		vi.stubGlobal(
			'fetch',
			vi.fn(() => Promise.reject(new Error('offline')))
		);
		actions = {
			onJoinGame: vi.fn(),
			onShowGames: vi.fn(),
			onLeaveGame: vi.fn(),
			onChangeCurrentNode: vi.fn()
		};
		app._actions = actions as unknown as AppActions;
	});

	afterEach(() => {
		app._actions = null;
		vi.unstubAllGlobals();
	});

	it('lists the running games; a click joins the game', async () => {
		setState();
		await render(Page);
		await expect.element(page.getByRole('heading', { name: 'Partien beobachten' })).toBeVisible();
		await page.getByRole('button', { name: /Zweite Partie/ }).click();
		expect(actions.onJoinGame).toHaveBeenCalledWith(12);
	});

	it('opens a clicked game in its own window when that is switched on', async () => {
		localStorage.setItem('gotv.gameWindows', 'on');
		const open = vi.fn(() => ({ closed: false, focus: vi.fn() }));
		vi.stubGlobal('open', open);
		actions.onJoinGameQuietly = vi.fn();
		setState();
		await render(Page);
		await page.getByRole('button', { name: /Zweite Partie/ }).click();
		expect(actions.onJoinGameQuietly).toHaveBeenCalledWith(12);
		expect(open).toHaveBeenCalledWith(
			expect.stringMatching(/\/partie\?id=12$/),
			'gotv-partie-12',
			expect.any(String)
		);
		expect(actions.onJoinGame).not.toHaveBeenCalled();
		// Clicked again: the open window comes to the front, no second one.
		await page.getByRole('button', { name: /Zweite Partie/ }).click();
		expect(open).toHaveBeenCalledTimes(1);
		localStorage.removeItem('gotv.gameWindows');
	});

	it('shows the game here when the browser blocks the window', async () => {
		localStorage.setItem('gotv.gameWindows', 'on');
		vi.stubGlobal(
			'open',
			vi.fn(() => null)
		);
		actions.onJoinGameQuietly = vi.fn();
		setState();
		await render(Page);
		await page.getByRole('button', { name: /Erste Partie/ }).click();
		expect(actions.onJoinGame).toHaveBeenCalledWith(11);
		localStorage.removeItem('gotv.gameWindows');
	});

	it('changes the remembered filter', async () => {
		setState();
		await render(Page);
		await page.getByRole('checkbox', { name: 'Bots' }).click();
		expect(actions.onShowGames).toHaveBeenCalledWith({ type: 'game', excludeBots: true });
	});

	it('shows the watched game instead of the list', async () => {
		setState({ watchGameId: 11 });
		await render(Page);
		await expect.element(page.getByRole('heading', { name: 'Erste Partie' })).toBeVisible();
		await expect.element(page.getByRole('img', { name: /anna \(Weiß\) gegen bert/ })).toBeVisible();
		await page.getByRole('button', { name: 'Zurück' }).click();
		expect(actions.onLeaveGame).toHaveBeenCalled();
	});
});
