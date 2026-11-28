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
		actions = { onViewGame: vi.fn(), onUnviewGame: vi.fn() };
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

	it('closes itself when the last board is taken off', async () => {
		const close = vi.spyOn(window, 'close').mockImplementation(() => {});
		await render(Page);
		await page
			.getByRole('region', { name: 'Brett 1' })
			.getByRole('button', { name: 'Vom Brett nehmen' })
			.click();
		expect(close).not.toHaveBeenCalled();
		await page
			.getByRole('region', { name: 'Brett 3' })
			.getByRole('button', { name: 'Vom Brett nehmen' })
			.click();
		expect(close).toHaveBeenCalledOnce();
		close.mockRestore();
	});

	it('closes itself after "Alle entfernen"', async () => {
		const close = vi.spyOn(window, 'close').mockImplementation(() => {});
		await render(Page);
		await page.getByRole('button', { name: 'Alle entfernen' }).click();
		expect(close).toHaveBeenCalledOnce();
		close.mockRestore();
	});

	it('says that a private game has no board instead of loading for ever', async () => {
		const privateGame = game(92, lukan, anna, { private: true, tree: undefined });
		const refused = game(93, anna, lukan, { tree: undefined, accessDenied: 'Private Game' });
		app.state = {
			...app.state,
			gamesById: { ...app.state.gamesById, 92: privateGame, 93: refused },
			activeGames: [privateGame, refused]
		};
		localStorage.setItem('gotv.team', JSON.stringify([92, 93, null, null, null, null]));
		await render(Page);
		for (const board of ['Brett 1', 'Brett 2']) {
			await expect
				.element(page.getByRole('region', { name: board }).getByText(/Private Partie/))
				.toBeVisible();
		}
		await expect.element(page.getByText('Brett lädt', { exact: false })).not.toBeInTheDocument();
	});

	it('shows the boards in their places and joins the running games', async () => {
		await render(Page);
		await expect.element(page.getByRole('region', { name: 'Brett 1' })).toBeVisible();
		await expect.element(page.getByRole('region', { name: 'Brett 3' })).toBeVisible();
		await expect.element(page.getByRole('region', { name: 'Brett 2' })).not.toBeInTheDocument();
		await expect.element(page.getByText('Lukan [7d] – anna [5d]')).toBeVisible();
		// Both boards are registered as shown here with the KGS connection.
		expect(actions.onViewGame).toHaveBeenCalledWith(90, expect.any(String));
		expect(actions.onViewGame).toHaveBeenCalledWith(91, expect.any(String));
		// The overview: positions only, nothing to type in.
		await expect.element(page.getByRole('textbox')).not.toBeInTheDocument();
	});

	it('shows one board with the full game screen and goes back to all boards', async () => {
		actions.onSendGameChat = vi.fn();
		await render(Page);
		await page.getByRole('button', { name: /Lukan \[7d\] – anna/ }).click();
		expect(localStorage.getItem('gotv.teamView')).toBe('1');
		// The same game screen as a game window: players, chat to write in.
		await expect.element(page.getByRole('button', { name: /Alle Bretter/ })).toBeVisible();
		await page.getByRole('textbox').fill('viel Glück');
		await userEvent.keyboard('{Enter}');
		expect(actions.onSendGameChat).toHaveBeenCalledWith('viel Glück', 90);
		// Esc in the chat field stays there; Esc elsewhere goes back.
		await userEvent.keyboard('{Escape}');
		await expect.element(page.getByRole('button', { name: /Alle Bretter/ })).toBeVisible();
		(document.activeElement as HTMLElement | null)?.blur();
		await userEvent.keyboard('{Escape}');
		await expect.element(page.getByRole('region', { name: 'Brett 3' })).toBeVisible();
		await page.getByRole('button', { name: /Lukan \[7d\] – anna/ }).click();
		await page.getByRole('button', { name: /Alle Bretter/ }).click();
		await expect.element(page.getByRole('region', { name: 'Brett 3' })).toBeVisible();
	});

	it('shows your own running game framed; a click goes back to its window', async () => {
		app.state = {
			...app.state,
			gamesById: { ...app.state.gamesById, 95: game(95, me, anna) },
			channelMembership: { 95: { type: 'game', complete: true, stale: false } }
		};
		const popup = {
			closed: false,
			focus: vi.fn(),
			close: vi.fn(),
			location: { href: 'http://x/partie?id=95' }
		};
		const open = vi.fn(() => popup);
		vi.stubGlobal('open', open);
		await render(Page);
		const own = page.getByRole('region', { name: 'Deine Partie' });
		await expect.element(own).toBeVisible();
		await own.getByRole('button').click();
		// The open game window is opened afresh, so it shows in front.
		expect(open).toHaveBeenCalledWith('', 'gotv-partie-95', expect.any(String));
		expect(open).toHaveBeenLastCalledWith(
			expect.stringMatching(/\/partie\?id=95$/),
			'_blank',
			expect.any(String)
		);
		expect(popup.close).toHaveBeenCalled();
		// Switched off: no own game here.
		await page.getByRole('checkbox', { name: 'Eigene Partie zeigen' }).click();
		await expect.element(own).not.toBeInTheDocument();
		localStorage.removeItem('gotv.boardsOwnGame');
		vi.unstubAllGlobals();
	});

	it('removes all boards with one click and lets KGS go of their games', async () => {
		await render(Page);
		await page.getByRole('button', { name: 'Alle entfernen' }).click();
		await expect.element(page.getByRole('region', { name: 'Brett 1' })).not.toBeInTheDocument();
		expect(JSON.parse(localStorage.getItem('gotv.team') ?? '[]')).toEqual([
			null,
			null,
			null,
			null,
			null,
			null
		]);
		expect(actions.onUnviewGame).toHaveBeenCalledWith(90, expect.any(String));
		expect(actions.onUnviewGame).toHaveBeenCalledWith(91, expect.any(String));
	});

	it('offers no local copy of a running game and never makes my own game a board', async () => {
		app.state = {
			...app.state,
			gamesById: { ...app.state.gamesById, 95: game(95, me, anna) },
			channelMembership: { 95: { type: 'game', complete: true, stale: false } }
		};
		localStorage.setItem('gotv.team', JSON.stringify([90, 95, null, null, null, null]));
		await render(Page);
		// My own running game, brought in by hand: only the framed preview.
		await expect.element(page.getByRole('region', { name: 'Deine Partie' })).toBeVisible();
		await expect.element(page.getByRole('region', { name: 'Brett 2' })).not.toBeInTheDocument();
		// A team mate's running game, enlarged: the score estimate as in CGoban
		// (user, 27.11.2026), but no local copy.
		await page.getByRole('button', { name: /Lukan \[7d\] – anna/ }).click();
		await page.getByRole('button', { name: /Mehr/ }).click();
		await expect.element(page.getByText('Ergebnis schätzen')).toBeVisible();
		await expect.element(page.getByText('Lokal betrachten')).not.toBeInTheDocument();
	});

	it('takes a board off', async () => {
		await render(Page);
		await page
			.getByRole('region', { name: 'Brett 3' })
			.getByRole('button', { name: 'Vom Brett nehmen' })
			.click();
		await expect.element(page.getByRole('region', { name: 'Brett 3' })).not.toBeInTheDocument();
		expect(JSON.parse(localStorage.getItem('gotv.team') ?? '[]')).toEqual([
			90,
			null,
			null,
			null,
			null,
			null
		]);
		// Taken off: no longer shown here, the KGS connection may let it go.
		expect(actions.onUnviewGame).toHaveBeenCalledWith(91, expect.any(String));
		expect(actions.onUnviewGame).not.toHaveBeenCalledWith(90, expect.any(String));
	});
});
