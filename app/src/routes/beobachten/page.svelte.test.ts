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
		const open = vi.fn<(url: string, name: string) => ReturnType<typeof newPopup>>(() => popup);
		vi.stubGlobal('open', open);
		setState();
		await render(Page);
		await page.getByRole('button', { name: /Zweite Partie/ }).click();
		// Opened empty by name (an open one would come back as it is), then loaded.
		expect(open).toHaveBeenCalledWith('', 'gotv-partie-12', expect.any(String));
		expect(popup.location.replace).toHaveBeenCalledWith(expect.stringMatching(/\/partie\?id=12$/));
		expect(actions.onJoinGame).not.toHaveBeenCalled();
		// Clicked again while it is open: opened afresh, so it shows in front
		// (Wayland lets no page bring another window forward); the old one is
		// closed only once the new one is there, which takes over the name.
		popup.location.href = 'http://localhost/partie?id=12';
		const fresh = newPopup() as ReturnType<typeof newPopup> & { name?: string };
		open.mockImplementation((_url: string, name: string) => (name === '_blank' ? fresh : popup));
		await page.getByRole('button', { name: /Zweite Partie/ }).click();
		expect(open).toHaveBeenLastCalledWith(
			expect.stringMatching(/\/partie\?id=12$/),
			'_blank',
			expect.any(String)
		);
		expect(popup.close).toHaveBeenCalled();
		expect(fresh.name).toBe('gotv-partie-12');
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
		expect(JSON.parse(localStorage.getItem('gotv.team') ?? '[]')).toEqual([
			12,
			null,
			null,
			null,
			null,
			null
		]);
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
				4: game(4, 'D'),
				5: game(5, 'E'),
				6: game(6, 'F')
			}
		};
		// The overview closed (the browser has no window of that name, so the
		// next one is a new, empty window): its old boards are gone.
		const reopened = newPopup();
		open.mockReturnValue(reopened);
		localStorage.setItem('gotv.team', '[1,2,3,4,5,6]');
		await page.getByRole('button', { name: /Erste Partie/ }).click();
		expect(JSON.parse(localStorage.getItem('gotv.team') ?? '[]')).toEqual([
			11,
			null,
			null,
			null,
			null,
			null
		]);
		// The overview open: games of an earlier session (restored with the
		// saved state, not listed by KGS any more) do not hold their boards.
		reopened.location.href = 'http://localhost/bretter'; // the overview is open
		localStorage.setItem('gotv.team', '[1,2,3,4,5,6]');
		await page.getByRole('button', { name: /Erste Partie/ }).click();
		expect(JSON.parse(localStorage.getItem('gotv.team') ?? '[]')).toEqual([11, 2, 3, 4, 5, 6]);
		await expect.element(page.getByText(/Die Brettübersicht ist voll/)).not.toBeInTheDocument();
		// Listed games do: then the overview is full.
		app.state = {
			...app.state,
			activeGames: [
				...app.state.activeGames,
				...[1, 2, 3, 4, 5, 6].map((id) => app.state.gamesById[id])
			]
		};
		localStorage.setItem('gotv.team', '[1,2,3,4,5,6]');
		await page.getByRole('button', { name: /Erste Partie/ }).click();
		await expect.element(page.getByText(/Die Brettübersicht ist voll/)).toBeVisible();
		expect(open).toHaveBeenCalledWith('', 'gotv-partie-11', expect.any(String));
		popup.closed = true; // the next test opens game 11 afresh
		reopened.closed = true;
		localStorage.removeItem('gotv.boardsMode');
		localStorage.removeItem('gotv.team');
		localStorage.removeItem('gotv.gameWindows');
	});

	it('shows the Brettübersicht button only while an overview is open', async () => {
		localStorage.setItem('gotv.gameWindows', 'on');
		localStorage.setItem('gotv.boardsMode', 'on');
		localStorage.removeItem('gotv.team');
		const popup = newPopup();
		vi.stubGlobal(
			'open',
			vi.fn(() => popup)
		);
		setState();
		await render(Page);
		const button = page.getByRole('button', { name: 'Brettübersicht', exact: true });
		await expect.element(button).not.toBeInTheDocument();
		// The first game clicked opens the overview - and the button appears.
		await page.getByRole('button', { name: /Zweite Partie/ }).click();
		await expect.element(button).toBeVisible();
		// The overview closed itself with its last board: the button goes.
		popup.closed = true;
		await expect.element(button).not.toBeInTheDocument();
		localStorage.removeItem('gotv.boardsMode');
		localStorage.removeItem('gotv.team');
		localStorage.removeItem('gotv.gameWindows');
	});

	it('keeps both games on two fast clicks while the overview is still loading', async () => {
		localStorage.setItem('gotv.gameWindows', 'on');
		localStorage.setItem('gotv.boardsMode', 'on');
		localStorage.removeItem('gotv.team');
		const popup = newPopup(); // stays about:blank: the overview is still loading
		vi.stubGlobal(
			'open',
			vi.fn(() => popup)
		);
		setState();
		await render(Page);
		await page.getByRole('button', { name: /Zweite Partie/ }).click();
		await page.getByRole('button', { name: /Erste Partie/ }).click();
		expect(JSON.parse(localStorage.getItem('gotv.team') ?? '[]')).toEqual([
			12,
			11,
			null,
			null,
			null,
			null
		]);
		expect(popup.location.replace).toHaveBeenCalledTimes(1);
		popup.closed = true;
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
