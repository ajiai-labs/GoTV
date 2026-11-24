import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { app } from '#lib/app.svelte.ts';
import { getInitialState } from '#lib/model/appState.ts';
import { parseSgf } from '#lib/model/sgf.ts';
import { getKataGoEngine } from '#lib/model/KataGoEngine.ts';
import type { GameChannel } from '#lib/model/types.ts';
import type { TvEvent } from '#lib/model/tv.ts';

const mocked = vi.hoisted(() => ({
	url: new URL('http://localhost/nachspielen'),
	events: [] as Array<unknown>
}));

vi.mock('$app/state', () => ({
	page: {
		get url() {
			return mocked.url;
		}
	}
}));

vi.mock('#lib/model/tv.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('#lib/model/tv.ts')>()),
	fetchTvEvents: () => Promise.resolve(mocked.events)
}));

const { default: Page } = await import('./+page.svelte');

const LOGGED_OUT = { status: 'loggedOut', network: 'online', retryTimes: 0 } as const;

describe('Nachspielen', () => {
	beforeEach(() => {
		window.localStorage.clear();
		mocked.url = new URL('http://localhost/nachspielen');
		mocked.events = [];
		app.state = getInitialState(LOGGED_OUT);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		window.localStorage.clear();
	});

	it('offers the loader when nothing is to be opened', async () => {
		await render(Page);
		await expect.element(page.getByRole('heading', { name: 'Partie laden' })).toBeVisible();
		await expect.element(page.getByLabelText('SGF einfügen:')).toBeVisible();
		await expect
			.element(page.getByRole('heading', { name: 'Turnierpartien der letzten 3 Monate' }))
			.toBeVisible();
	});

	it('opens the game of ?sgf=', async () => {
		mocked.url = new URL(
			'http://localhost/nachspielen?sgf=' + encodeURIComponent('https://example.org/g.sgf')
		);
		const fetch = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('(;SZ[9]PB[Ann]PW[Bob];B[aa])'));
		await render(Page);
		await expect.element(page.getByRole('img', { name: /Ann gegen Bob/ })).toBeVisible();
		expect(fetch).toHaveBeenCalledWith('https://example.org/g.sgf');
		await expect.element(page.getByRole('heading', { name: 'Andere Partie laden' })).toBeVisible();
	});

	it('opens the KGS game handed over after it ended', async () => {
		const game = { id: 77, type: 'free', tree: parseSgf('(;SZ[9]PB[kim]PW[lee];B[aa])') };
		app.state = {
			...getInitialState(LOGGED_OUT),
			tvReplayGameId: 77,
			gamesById: { 77: game as unknown as GameChannel }
		};
		await render(Page);
		await expect.element(page.getByRole('img', { name: /kim gegen lee/ })).toBeVisible();
		// Its place is remembered under the KGS game.
		await page.getByRole('button', { name: 'Ein Zug vor' }).click();
		expect(
			Object.keys(JSON.parse(window.localStorage.getItem('gotv.replays') ?? '{}') as object)
		).toEqual(['game:kgs-77']);
	});

	it('opens a shared link at its move (zug)', async () => {
		mocked.url = new URL(
			'http://localhost/nachspielen?sgf=' +
				encodeURIComponent('https://example.org/g.sgf') +
				'&zug=2'
		);
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('(;SZ[9]PB[Ann]PW[Bob];B[aa];W[bb];B[cc])')
		);
		await render(Page);
		await expect
			.element(page.getByRole('img', { name: /Ann gegen Bob, Brett nach Zug 2/ }))
			.toBeVisible();
	});

	it('ignores an invalid zug', async () => {
		mocked.url = new URL(
			'http://localhost/nachspielen?sgf=' +
				encodeURIComponent('https://example.org/g.sgf') +
				'&zug=abc'
		);
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('(;SZ[9]PB[Ann]PW[Bob];B[aa];W[bb];B[cc])')
		);
		await render(Page);
		await expect
			.element(page.getByRole('img', { name: /Ann gegen Bob, Brett nach Zug 0/ }))
			.toBeVisible();
	});

	it('switches KataGo on with katago=1 only for a KGS game that is over', async () => {
		const engine = getKataGoEngine();
		vi.spyOn(engine, 'analyze').mockReturnValue(new Promise(() => {}));
		vi.spyOn(engine, 'cancel').mockImplementation(() => {});
		mocked.url = new URL('http://localhost/nachspielen?katago=1');
		const tree = parseSgf('(;SZ[9]PB[kim]PW[lee];B[aa])');
		app.state = {
			...getInitialState(LOGGED_OUT),
			tvReplayGameId: 77,
			gamesById: { 77: { id: 77, type: 'free', over: true, tree } as unknown as GameChannel }
		};
		const over = await render(Page);
		await expect.element(page.getByRole('checkbox', { name: 'KataGo-Analyse' })).toBeChecked();
		expect(window.localStorage.getItem('gotv.katago')).toBeNull();
		await over.unmount();

		// A running game: KataGo stays off.
		app.state = {
			...getInitialState(LOGGED_OUT),
			tvReplayGameId: 78,
			gamesById: { 78: { id: 78, type: 'free', tree } as unknown as GameChannel }
		};
		await render(Page);
		await expect.element(page.getByRole('checkbox', { name: 'KataGo-Analyse' })).not.toBeChecked();
	});

	it('opens a tournament game on this page', async () => {
		const event: TvEvent = {
			id: 'finale',
			name: 'Finale',
			date_start: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().slice(0, 10),
			platform: 'other',
			stream_url: 'https://example.org/finale',
			sgf_url: 'https://example.org/finale.sgf'
		};
		mocked.events = [event];
		const open = vi.spyOn(app, 'openReplay').mockImplementation(() => {});
		await render(Page);
		await page.getByRole('button', { name: 'SGF nachspielen' }).click();
		expect(open).toHaveBeenCalledWith('https://example.org/finale.sgf');
	});
});
