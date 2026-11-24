import { page, userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BoardNav from './BoardNav.svelte';

describe('BoardNav', () => {
	it('steps with the buttons and stops at both ends', async () => {
		await render(BoardNav, { move: 1, total: 3 });
		const back = page.getByRole('button', { name: 'Ein Zug zurück' });
		await back.click();
		await expect.element(back).toBeDisabled();
		await page.getByRole('button', { name: 'Zum letzten Zug' }).click();
		await expect.element(page.getByRole('button', { name: 'Ein Zug vor' })).toBeDisabled();
	});

	it('moves with the arrow keys', async () => {
		await render(BoardNav, { move: 2, total: 5 });
		await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
		await expect.element(page.getByRole('button', { name: 'Zum Anfang' })).toBeDisabled();
	});
});
