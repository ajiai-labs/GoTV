import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

describe('Live (draft)', () => {
	it('shows the stage with the stream behind a click', async () => {
		await render(Page);
		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent('Europameisterschaft 2026');
		await expect.element(page.getByRole('button', { name: 'Stream laden' })).toBeVisible();
		await expect
			.element(page.getByRole('img', { name: /Kravets gegen Jabarin nach Zug 142/ }))
			.toBeVisible();
	});

	it('steps back through the live game and returns to the current move', async () => {
		await render(Page);
		await page.getByRole('button', { name: 'Ein Zug zurück' }).click();
		await expect.element(page.getByRole('img', { name: /nach Zug 141/ })).toBeVisible();
		await expect.element(page.getByText('Zug 141, live ist Zug 142')).toBeVisible();
		await page.getByRole('button', { name: 'Zum aktuellen Zug' }).first().click();
		await expect.element(page.getByRole('img', { name: /nach Zug 142/ })).toBeVisible();
	});
});
