import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { ReplayGame } from '#lib/model/OgsReplay.ts';
import type { TvEvent } from '#lib/model/tv.ts';
import ReplayGameList from './ReplayGameList.svelte';

const event: TvEvent = {
	id: 'speedgo-2026-11-22',
	name: 'Speed Go Championship',
	date_start: '2026-11-22',
	platform: 'twitch',
	stream_url: 'https://www.twitch.tv/europeangofederation',
	ogs_game_ids: [1, 2]
};

const games: Array<ReplayGame> = [
	{ id: 1, black: 'Surma', white: 'Ovsiienko', started: 0, sgfUrl: 'sgf-1' },
	{ id: 2, black: 'Ovsiienko', white: 'Surma', started: 0, sgfUrl: 'sgf-2' }
];

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe('ReplayGameList', () => {
	it('loads after the click and lists the games as G1, G2', async () => {
		const pending = deferred<Array<ReplayGame>>();
		const fetchGames = vi.fn(() => pending.promise);
		const onOpenReplay = vi.fn();
		await render(ReplayGameList, { event, onOpenReplay, fetchGames });
		expect(fetchGames).not.toHaveBeenCalled();

		await page.getByRole('button', { name: 'Partien nachspielen' }).click();
		await expect.element(page.getByText('Partien werden bei OGS gesucht …')).toBeVisible();
		expect(fetchGames).toHaveBeenCalledWith(event);

		pending.resolve(games);
		await expect
			.element(page.getByRole('button', { name: /G1.*Surma – ○ Ovsiienko/ }))
			.toBeVisible();
		await page.getByRole('button', { name: /G2/ }).click();
		expect(onOpenReplay).toHaveBeenCalledWith('sgf-2');

		await page.getByRole('button', { name: 'Partien ausblenden' }).click();
		await expect.element(page.getByRole('button', { name: '2 Partien nachspielen' })).toBeVisible();
	});

	it('shows the error and loads again on "Erneut versuchen"', async () => {
		const fetchGames = vi
			.fn<(event: TvEvent) => Promise<Array<ReplayGame>>>()
			.mockRejectedValueOnce(new Error('HTTP 503'))
			.mockResolvedValueOnce([]);
		await render(ReplayGameList, { event, onOpenReplay: vi.fn(), fetchGames, defaultOpen: true });
		await expect
			.element(page.getByText(/Partien konnten nicht geladen werden \(HTTP 503\)\./))
			.toBeVisible();

		await page.getByRole('button', { name: 'Erneut versuchen' }).click();
		await expect.element(page.getByText('Noch keine beendete Partie gefunden.')).toBeVisible();
		expect(fetchGames).toHaveBeenCalledTimes(2);
	});
});
