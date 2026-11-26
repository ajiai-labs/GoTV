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

// A window as window.open returns it: new and still empty.
function newPopup() {
	return {
		closed: false,
		focus: vi.fn(),
		close: vi.fn(),
		location: { href: 'about:blank', replace: vi.fn() }
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
		const popup = newPopup();
		const open = vi.fn(() => popup);
		vi.stubGlobal('open', open);
		setState();
		await render(Page);
		await page.getByRole('button', { name: /Zweite Partie/ }).click();
		// Opened empty by name (an open one would come back as it is), then loaded.
		expect(open).toHaveBeenCalledWith('', 'gotv-partie-12', expect.any(String));
		expect(popup.location.replace).toHaveBeenCalledWith(expect.stringMatching(/\/partie\?id=12$/));
		expect(actions.onJoinGame).not.toHaveBeenCalled();
		// Clicked again while it is open: closed and opened afresh, so it shows
		// in front (Wayland lets no page bring another window forward).
		popup.location.href = 'http://localhost/partie?id=12';
		await page.getByRole('button', { name: /Zweite Partie/ }).click();
		expect(popup.close).toHaveBeenCalled();
		expect(open).toHaveBeenLastCalledWith(
			expect.stringMatching(/\/partie\?id=12$/),
			'gotv-partie-12',
			expect.any(String)
		);
		localStorage.removeItem('gotv.gameWindows');
	});

	it('brings clicked games to the board overview while that is ticked', async () => {
		localStorage.setItem('gotv.gameWindows', 'on');
		localStorage.removeItem('gotv.team');
		const popup = newPopup();
		const open = vi.fn(() => popup);
		vi.stubGlobal('open', open);
		setState();
		await render(Page);
		await page.getByRole('checkbox', { name: /Partien in die Brettübersicht holen/ }).click();
		await page.getByRole('button', { name: /Zweite Partie/ }).click();
		expect(JSON.parse(localStorage.getItem('gotv.team') ?? '[]')).toEqual([12, null, null, null]);
		expect(open).toHaveBeenCalledWith('', 'gotv-bretter', expect.any(String));
		expect(popup.location.replace).toHaveBeenCalledWith(expect.stringMatching(/\/bretter$/));
		expect(actions.onJoinGame).not.toHaveBeenCalled();
		// All four boards taken: the game opens in its own window all the same,
		// and the page says why - a click never does nothing.
		app.state = {
			...app.state,
			gamesById: {
				...app.state.gamesById,
				1: game(1, 'A'),
				2: game(2, 'B'),
				3: game(3, 'C'),
				4: game(4, 'D')
			}
		};
		localStorage.setItem('gotv.team', '[1,2,3,4]');
		await page.getByRole('button', { name: /Erste Partie/ }).click();
		await expect.element(page.getByText(/Die Brettübersicht ist voll/)).toBeVisible();
		expect(open).toHaveBeenCalledWith('', 'gotv-partie-11', expect.any(String));
		popup.closed = true; // the next test opens game 11 afresh
		localStorage.removeItem('gotv.boardsMode');
		localStorage.removeItem('gotv.team');
		localStorage.removeItem('gotv.gameWindows');
	});

	it('shows the game here when the browser blocks the window', async () => {
		localStorage.setItem('gotv.gameWindows', 'on');
		vi.stubGlobal(
			'open',
			vi.fn(() => null)
		);
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
