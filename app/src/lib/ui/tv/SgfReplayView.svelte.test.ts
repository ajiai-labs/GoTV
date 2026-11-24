import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { parseSgf } from '#lib/model/sgf.ts';
import { getKataGoEngine } from '#lib/model/KataGoEngine.ts';
import type { KataGoAnalysis } from '#lib/model/KataGoEngine.ts';
import { language } from '#lib/i18n/index.svelte.ts';
import SgfReplayView from './SgfReplayView.svelte';
import * as replayModule from './SgfReplayView.svelte';

// The helper lives in the component's module script (as in the old app).
const { getReadableComment } = replayModule as unknown as {
	getReadableComment: (text: unknown) => string | null;
};

const GAME = '(;SZ[9]PB[a]PW[b]RE[B+R];B[aa];W[bb])';

// A click on the board point (x, y) of a 9x9 board.
function clickPoint(container: HTMLElement, x: number, y: number) {
	const hits = container.querySelectorAll('rect.hit');
	hits[y * 9 + x].dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

const next = () => page.getByRole('button', { name: 'Ein Zug vor' }).click();
const back = () => page.getByRole('button', { name: 'Ein Zug zurück' }).click();
const last = () => page.getByRole('button', { name: 'Zum letzten Zug' }).click();

describe('SgfReplayView', () => {
	beforeEach(() => window.localStorage.clear());
	afterEach(() => {
		vi.restoreAllMocks();
		window.localStorage.clear();
	});

	it('loads pasted SGF text and steps through the moves', async () => {
		await render(SgfReplayView, {});
		await expect.element(page.getByRole('button', { name: 'Laden', exact: true })).toBeDisabled();
		await page.getByLabelText('SGF einfügen:').fill(GAME);
		await page.getByRole('button', { name: 'Laden', exact: true }).click();
		await expect.element(page.getByText(/Zug 0 · Gefangene/)).toBeVisible();
		await expect
			.element(page.getByRole('img', { name: 'a gegen b, Brett nach Zug 0' }))
			.toBeVisible();
		await next();
		await expect.element(page.getByText(/Zug 1 · Gefangene/)).toBeVisible();
		// The result only at the last move.
		expect(document.body.textContent).not.toContain('B+R');
		await last();
		await expect.element(page.getByText(/· B\+R/)).toBeVisible();
	});

	it('speaks English, also for an error already shown', async () => {
		await render(SgfReplayView, {});
		await page.getByLabelText('SGF einfügen:').fill('kein sgf');
		await page.getByRole('button', { name: 'Laden', exact: true }).click();
		await expect.element(page.getByRole('alert').getByText(/SGF konnte nicht/)).toBeVisible();
		language.current = 'en';
		await expect.element(page.getByRole('alert').getByText(/Could not read the SGF/)).toBeVisible();
		await page.getByLabelText('Paste SGF:').fill(GAME);
		await page.getByRole('button', { name: 'Load', exact: true }).click();
		await expect.element(page.getByText(/Move 0 · Captures: Black 0, White 0/)).toBeVisible();
		await expect
			.element(page.getByRole('img', { name: 'a vs b, board after move 0' }))
			.toBeVisible();
	});

	it('reports SGF that cannot be read', async () => {
		await render(SgfReplayView, {});
		await page.getByLabelText('SGF einfügen:').fill('kein sgf');
		await page.getByRole('button', { name: 'Laden', exact: true }).click();
		await expect
			.element(page.getByRole('alert').getByText(/SGF konnte nicht gelesen werden/))
			.toBeVisible();
	});

	it('lets the viewer try an own move and return to the game', async () => {
		const { container } = await render(SgfReplayView, { initialTree: parseSgf(GAME) });
		await next();
		// White to play after B[aa]; an own move instead of the game's W[bb].
		clickPoint(container, 4, 4);
		await expect.element(page.getByText(/Variante ab Zug 1 · Schwarz ist am Zug/)).toBeVisible();
		// The end of the own line is not the end of the game: no result.
		expect(container.textContent).not.toContain('B+R');
		await page.getByRole('button', { name: 'Zurück zur Partie' }).click();
		await expect.element(page.getByText(/Variante ab Zug/)).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Partie B8' })).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Variante E5' }))
			.toHaveAttribute('aria-pressed', 'false');
		await last();
		await expect.element(page.getByText(/· B\+R/)).toBeVisible();
	});

	it('removes an own variation', async () => {
		const { container } = await render(SgfReplayView, { initialTree: parseSgf(GAME) });
		await next();
		clickPoint(container, 4, 4);
		await page.getByRole('button', { name: 'Variante löschen' }).click();
		await expect.element(page.getByText('Weiter mit:')).not.toBeInTheDocument();
		await expect.element(page.getByText(/Zug 1 · Gefangene/)).toBeVisible();
	});

	it('explains why a ko retake is not played', async () => {
		const tree = parseSgf('(;SZ[9]AB[ba][ab][bc]AW[bb][ca][db][cc];B[cb])');
		const { container } = await render(SgfReplayView, { initialTree: tree });
		await last();
		clickPoint(container, 1, 1);
		await expect
			.element(page.getByRole('status'))
			.toHaveTextContent('Ko: sofort zurückschlagen ist verboten – erst woanders spielen.');
		expect(container.textContent).not.toContain('Variante ab Zug');
		await back();
		await expect.element(page.getByText(/Ko: sofort/)).not.toBeInTheDocument();
	});

	it('continues where the viewer stopped and keeps bookmarks', async () => {
		const sgf = '(;SZ[9]PB[a]PW[b];B[aa];W[bb];B[cc])';
		const first = await render(SgfReplayView, { initialTree: parseSgf(sgf), replayKey: 'kgs-1' });
		await next();
		await next();
		await page.getByRole('button', { name: 'Lesezeichen bei Zug 2' }).click();
		await page.getByLabelText('Notiz zu Zug 2').fill('Kampf unklar');
		await page.getByRole('button', { name: 'Speichern' }).click();
		await expect.element(page.getByRole('button', { name: 'Zug 2: Kampf unklar' })).toBeVisible();
		await first.unmount();

		await render(SgfReplayView, { initialTree: parseSgf(sgf), replayKey: 'kgs-1' });
		await expect.element(page.getByText(/Weiter bei Zug 2/)).toBeVisible();
		await expect.element(page.getByText(/Zug 2 · Gefangene/)).toBeVisible();
		await page.getByRole('button', { name: 'Von vorn' }).click();
		await expect.element(page.getByText(/Zug 0 · Gefangene/)).toBeVisible();
		await page.getByRole('button', { name: 'Zug 2: Kampf unklar' }).click();
		await expect.element(page.getByText(/Zug 2 · Gefangene/)).toBeVisible();
		await page.getByRole('button', { name: 'Lesezeichen bei Zug 2 löschen' }).click();
		await expect
			.element(page.getByRole('button', { name: 'Zug 2: Kampf unklar' }))
			.not.toBeInTheDocument();
	});

	it('keeps variations for next time and saves the game as SGF', async () => {
		const sgf = '(;SZ[9]PB[a]PW[b];B[aa];W[bb];B[cc])';
		const first = await render(SgfReplayView, { initialTree: parseSgf(sgf), replayKey: 'kgs-7' });
		await next();
		clickPoint(first.container, 4, 4);
		await expect.element(page.getByText(/Variante ab Zug 1/)).toBeVisible();
		await first.unmount();

		await render(SgfReplayView, { initialTree: parseSgf(sgf), replayKey: 'kgs-7' });
		// Reopened at the game's move 1, where the variation leaves the game.
		await expect.element(page.getByRole('button', { name: 'Partie B8' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Variante E5' })).toBeVisible();

		let saved: Blob | null = null;
		vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
			saved = blob as Blob;
			return 'blob:sgf';
		});
		vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
		await page.getByRole('button', { name: 'Als SGF speichern' }).click();
		expect(click).toHaveBeenCalled();
		expect(saved).not.toBe(null);
		expect(await (saved as unknown as Blob).text()).toBe(
			'(;FF[4]GM[1]CA[UTF-8]SZ[9]PB[a]PW[b];B[aa](;W[bb];B[cc])(;W[ee]))\n'
		);
	});

	it('lists a game from an address as soon as it is opened', async () => {
		const url = 'https://online-go.com/api/v1/games/1/sgf';
		const fetch = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('(;SZ[9]PB[Ann]PW[Bob];B[aa])'));
		await render(SgfReplayView, { initialUrl: url });
		await expect.element(page.getByText(/Zug 0 · Gefangene/)).toBeVisible();
		expect(fetch).toHaveBeenCalledWith(url);
		const stored = JSON.parse(window.localStorage.getItem('gotv.replays') ?? '{}') as Record<
			string,
			unknown
		>;
		expect(stored['url:' + url]).toMatchObject({ move: 0, title: 'Ann – Bob', url });
	});

	it('explains a failed download', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 403 }));
		await render(SgfReplayView, { initialUrl: 'https://example.org/game.sgf' });
		await expect.element(page.getByRole('alert').getByText(/CORS/)).toBeVisible();
	});

	it('shows board and navigation only in compact mode', async () => {
		await render(SgfReplayView, { initialTree: parseSgf(GAME), compact: true });
		await expect.element(page.getByText(/Zug 0 · Gefangene/)).toBeVisible();
		expect(document.body.textContent).not.toContain('KataGo-Analyse');
		expect(document.body.textContent).not.toContain('SGF einfügen');
		expect(document.body.textContent).not.toContain('Als SGF speichern');
	});

	it("lays KataGo's line as a variation and switches between the lines", async () => {
		window.localStorage.setItem('gotv.katago', '1');
		const engine = getKataGoEngine();
		const analysis: KataGoAnalysis = {
			winRate: 0.6,
			scoreLead: 1,
			visits: 100,
			toPlay: 'white',
			backend: 'wasm',
			moves: [
				{
					x: 4,
					y: 4,
					winRate: 0.6,
					scoreLead: 1,
					visits: 80,
					pointsLost: 0,
					order: 0,
					pv: ['E5', 'F4']
				}
			]
		};
		vi.spyOn(engine, 'analyze').mockResolvedValue(analysis);
		vi.spyOn(engine, 'cancel').mockImplementation(() => {});
		const { container } = await render(SgfReplayView, {
			initialTree: parseSgf('(;SZ[9]PB[a]PW[b];B[aa];W[bb];B[cc])')
		});
		await next();
		// KataGo's candidate as digit 1 on the board.
		await expect.poll(() => container.querySelector('.label text')?.textContent).toBe('1');
		await page.getByRole('button', { name: 'Variante legen' }).click();
		await expect.element(page.getByText('Kommentar:')).toBeVisible();
		await expect.element(page.getByText(/^KataGo-Variante: E5/)).toBeVisible();
		await back();
		await expect
			.element(page.getByRole('button', { name: 'KataGo E5' }))
			.toHaveAttribute('aria-pressed', 'true');
		await page.getByRole('button', { name: 'Partie B8' }).click();
		await expect.element(page.getByText(/Variante ab Zug/)).not.toBeInTheDocument();
	});
});

describe('getReadableComment', () => {
	it('drops OGS chat lines without readable text', () => {
		expect(getReadableComment('Kravets: [object Object]')).toBe(null);
		expect(getReadableComment('Fan: schöner Zug\nKravets: [object Object]\n')).toBe(
			'Fan: schöner Zug'
		);
		expect(getReadableComment(undefined)).toBe(null);
	});
});
