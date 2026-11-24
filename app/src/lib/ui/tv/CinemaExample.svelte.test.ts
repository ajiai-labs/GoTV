import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CinemaExample from './CinemaExample.svelte';

const SGF = '(;SZ[9]PB[Andrii Kravets]PW[Ali Jabarin]RE[B+R];B[aa];W[bb])';

describe('CinemaExample', () => {
	afterEach(() => vi.restoreAllMocks());

	it('loads the final only on click and keeps the board when the video is hidden', async () => {
		const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(SGF));
		await render(CinemaExample, {});
		await expect.element(page.getByText(/keine Live-Partie/)).toBeVisible();
		await expect.element(page.getByText(/unabhängig vom Video/)).toBeVisible();
		expect(fetch).not.toHaveBeenCalled();
		expect(document.querySelector('iframe')).toBeNull();

		await page.getByRole('button', { name: 'Stream laden' }).click();
		await expect
			.poll(() =>
				fetch.mock.calls.map(([url]) => (url instanceof Request ? url.url : url.toString()))
			)
			.toEqual(['/tv/em-finale-2026.sgf']);
		expect(document.querySelector('iframe')?.src).toContain(
			'player.twitch.tv/?channel=europeangofederation'
		);
		await expect
			.element(page.getByText('Finalpartie zum Nachspielen · Aufzeichnung'))
			.toBeVisible();
		await expect.element(page.getByText(/Andrii Kravets/).first()).toBeVisible();
		// No delay or chat for a recording.
		expect(document.querySelector('.BroadcastCard-delay')).toBeNull();

		await page.getByRole('button', { name: 'Ein Zug vor' }).click();
		const replay = document.querySelector('.replay');
		await page.getByRole('button', { name: 'Nur Brett' }).click();
		await expect.poll(() => document.querySelector('iframe')).toBeNull();
		expect(document.querySelector('.replay')).toBe(replay);
		await page.getByRole('button', { name: 'Video zuschalten' }).click();
		await expect.poll(() => document.querySelector('iframe')).not.toBeNull();
		expect(document.querySelector('.replay')).toBe(replay);
		expect(fetch).toHaveBeenCalledTimes(1);
	});
});
