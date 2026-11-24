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
});
