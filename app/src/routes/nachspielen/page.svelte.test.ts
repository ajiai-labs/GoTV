import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { app } from '#lib/app.svelte.ts';
import { getInitialState } from '#lib/model/appState.ts';
import { parseSgf } from '#lib/model/sgf.ts';
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
