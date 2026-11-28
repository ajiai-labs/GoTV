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

	it('downloads all games as one ZIP and names the missing ones', async () => {
		const fetchSgf = vi.fn((url: string) =>
			Promise.resolve(
				url === 'sgf-2'
					? new Response('busy', { status: 429 })
					: new Response('(;GM[1]PB[Surma]PW[Ovsiienko];B[pd])')
			)
		);
		const saveFile = vi.fn();
		await render(ReplayGameList, {
			event,
			onOpenReplay: vi.fn(),
			fetchGames: () => Promise.resolve(games),
			fetchSgf: fetchSgf as typeof fetch,
			saveFile,
			defaultOpen: true
		});
		await page.getByRole('button', { name: 'Alle 2 Partien herunterladen (ZIP)' }).click();
		await expect.element(page.getByText(/G2 fehlen/)).toBeVisible();
		expect(saveFile).toHaveBeenCalledTimes(1);
		const [blob, fileName] = saveFile.mock.calls[0] as [Blob, string];
		expect(fileName).toBe('Speed Go Championship.zip');
		const content = new TextDecoder().decode(await blob.arrayBuffer());
		expect(content).toContain('Speed Go Championship/G1 Surma - Ovsiienko.sgf');
		expect(content).toContain('(;GM[1]PB[Surma]PW[Ovsiienko];B[pd])');
		expect(content).toContain('Speed Go Championship/Partien.txt');
		expect(content).toContain('https://online-go.com/game/2');
		expect(content).toContain('Nicht geladen: G2');
	});

	it('saves nothing when OGS delivers no game at all', async () => {
		const saveFile = vi.fn();
		await render(ReplayGameList, {
			event,
			onOpenReplay: vi.fn(),
			fetchGames: () => Promise.resolve(games),
			fetchSgf: (() => Promise.reject(new Error('offline'))) as typeof fetch,
			saveFile,
			defaultOpen: true
		});
		await page.getByRole('button', { name: /herunterladen/ }).click();
		await expect.element(page.getByText(/keine Partie geliefert/)).toBeVisible();
		expect(saveFile).not.toHaveBeenCalled();
	});
});
