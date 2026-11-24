import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BackupPanel from './BackupPanel.svelte';
import * as backupModule from './BackupPanel.svelte';
import type { BackupSummary } from '#lib/model/Backup.ts';
import { language } from '#lib/i18n/index.svelte.ts';

// The helper lives in the component's module script (as in the old app).
const { formatSummary } = backupModule as unknown as {
	formatSummary: (summary: BackupSummary) => string;
};

function chooseFile(text: string) {
	const input = document.querySelector('.BackupPanel-input') as HTMLInputElement;
	const transfer = new DataTransfer();
	transfer.items.add(new File([text], 'gotv-sicherung.json', { type: 'application/json' }));
	input.files = transfer.files;
	input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('BackupPanel', () => {
	beforeEach(() => window.localStorage.clear());
	afterEach(() => {
		vi.restoreAllMocks();
		window.localStorage.clear();
	});

	it('summarises a backup in words', () => {
		expect(
			formatSummary({
				favoriteChannels: 1,
				favoriteEvents: 2,
				games: 3,
				bookmarks: 1,
				variationMoves: 12,
				settings: 4
			})
		).toBe(
			'1 Lieblingskanal, 2 Lieblingsturniere, 3 nachgespielte Partien' +
				' (1 Lesezeichen, 12 Variantenzüge), 4 Einstellungen'
		);
		expect(
			formatSummary({
				favoriteChannels: 0,
				favoriteEvents: 0,
				games: 0,
				bookmarks: 0,
				variationMoves: 0,
				settings: 0
			})
		).toBe('keine Daten');
	});

	it('speaks English after a language switch', async () => {
		await render(BackupPanel);
		await expect.element(page.getByRole('heading', { name: 'Meine Daten' })).toBeVisible();
		language.current = 'en';
		await expect.element(page.getByRole('heading', { name: 'My data' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Save backup' })).toBeVisible();
		expect(
			formatSummary({
				favoriteChannels: 1,
				favoriteEvents: 2,
				games: 1,
				bookmarks: 3,
				variationMoves: 1,
				settings: 0
			})
		).toBe(
			'1 favourite channel, 2 favourite tournaments, 1 replayed game (3 bookmarks, 1 variation move)'
		);
	});

	it("saves this browser's data as a file", async () => {
		window.localStorage.setItem(
			'gotv.favorites',
			JSON.stringify({ channels: ['jupptube'], events: [] })
		);
		let saved: Blob | null = null;
		vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
			saved = blob as Blob;
			return 'blob:backup';
		});
		vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
		await render(BackupPanel, {});
		await page.getByRole('button', { name: 'Sicherung speichern' }).click();
		expect(click).toHaveBeenCalled();
		expect((saved as Blob | null)?.type).toBe('application/json');
		await expect
			.element(page.getByRole('status'))
			.toHaveTextContent('Sicherung gespeichert: 1 Lieblingskanal.');
	});

	it('shows what a file holds and merges it on request', async () => {
		window.localStorage.setItem(
			'gotv.favorites',
			JSON.stringify({ channels: ['egf'], events: [] })
		);
		const onRestored = vi.fn();
		await render(BackupPanel, { onRestored });
		chooseFile(
			JSON.stringify({
				format: 'gotv-backup',
				version: 1,
				createdAt: '2026-11-23T18:30:00.000Z',
				data: {
					'gotv.favorites': JSON.stringify({ channels: ['jupptube'], events: [] })
				}
			})
		);
		await expect.element(page.getByText(/Sicherung vom .*1 Lieblingskanal/)).toBeVisible();
		await page.getByRole('button', { name: 'Einspielen', exact: true }).click();
		expect(JSON.parse(window.localStorage.getItem('gotv.favorites') ?? '{}')).toEqual({
			channels: ['egf', 'jupptube'],
			events: []
		});
		await expect
			.element(page.getByRole('status'))
			.toHaveTextContent('Sicherung übernommen. GoTV lädt neu …');
		await expect.poll(() => onRestored.mock.calls.length, { timeout: 3000 }).toBe(1);
	});

	it('says why a file is refused', async () => {
		await render(BackupPanel, { onRestored: vi.fn() });
		chooseFile('hallo');
		await expect.element(page.getByRole('alert')).toBeVisible();
		expect(document.querySelector('.BackupPanel-error')?.textContent).toContain(
			'keine GoTV-Sicherung'
		);
		expect(document.querySelector('.BackupPanel-confirm')).toBeNull();
	});
});
