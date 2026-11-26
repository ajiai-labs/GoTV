import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { app } from '#lib/app.svelte.ts';
import type { AppActions } from '#lib/model/AppActions.ts';
import { getInitialState } from '#lib/model/index.ts';
import { parseSgf } from '#lib/model/sgf.ts';
import type { GameChannel, User } from '#lib/model/types.ts';

const pageState = vi.hoisted(() => ({ url: new URL('http://localhost/partie?id=31') }));
vi.mock('$app/state', () => ({
	page: {
		get url() {
			return pageState.url;
		},
		route: { id: '/partie' }
	}
}));
import Page from './+page.svelte';

const me: User = { name: 'gotvfan', rank: '3k', flags: { connected: true } };
const anna: User = { name: 'anna', rank: '2d', flags: { connected: true } };
const bert: User = { name: 'bert', rank: '1k', flags: { connected: true } };

function game(id: number, white: User, black: User): GameChannel {
	return {
		id,
		type: 'ranked',
		time: 0,
		players: { white, black },
		moveNum: 1,
		roomId: 1,
		name: 'Bundesliga Brett 2',
		rules: { size: 9, komi: 6.5 },
		tree: parseSgf('(;GM[1]SZ[9];B[cg])')
	};
}

describe('Partie im eigenen Fenster', () => {
	let actions: Record<string, ReturnType<typeof vi.fn>>;

	beforeEach(() => {
		vi.stubGlobal(
			'fetch',
			vi.fn(() => Promise.reject(new Error('offline')))
		);
		actions = {
			onViewGame: vi.fn(),
			onUnviewGame: vi.fn(),
			onLeaveGame: vi.fn(),
			onChangeCurrentNode: vi.fn()
		};
		app._actions = actions as unknown as AppActions;
		app.state = {
			...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
			initialized: true,
			currentUser: me,
			usersByName: { gotvfan: me, anna, bert },
			gamesById: { 31: game(31, anna, bert), 32: game(32, me, anna) }
		};
	});

	afterEach(() => {
		app._actions = null;
		vi.unstubAllGlobals();
	});

	it('shows the game of its id, joins it and closes with "Fenster schließen"', async () => {
		pageState.url = new URL('http://localhost/partie?id=31');
		const close = vi.fn();
		vi.stubGlobal('close', close);
		await render(Page);
		await expect.element(page.getByRole('heading', { name: 'Bundesliga Brett 2' })).toBeVisible();
		expect(actions.onViewGame).toHaveBeenCalledWith(31, expect.any(String));
		// No way back to the main window's pages in here, and no second window.
		await expect
			.element(page.getByRole('button', { name: 'Eigenes Fenster' }))
			.not.toBeInTheDocument();
		await page.getByRole('button', { name: 'Fenster schließen' }).click();
		expect(actions.onLeaveGame).toHaveBeenCalled();
		expect(close).toHaveBeenCalled();
	});

	it('says so when the game is gone', async () => {
		pageState.url = new URL('http://localhost/partie?id=abc');
		await render(Page);
		await expect.element(page.getByText('Diese Partie gibt es nicht (mehr).')).toBeVisible();
	});
});
