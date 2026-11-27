import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ReviewTools from './ReviewTools.svelte';

function props(extra = {}) {
	return {
		editor: 'andy1975',
		editing: true,
		owner: true,
		saved: false,
		users: ['andy1975', 'Zaharka'],
		me: 'andy1975',
		onGiveControl: vi.fn(),
		onSave: vi.fn(),
		...extra
	};
}

describe('ReviewTools', () => {
	it('chooses a tool, gives the control and saves', async () => {
		const p = props();
		await render(ReviewTools, p);
		await page.getByRole('radio', { name: 'Dreieck' }).click();
		await expect.element(page.getByRole('radio', { name: 'Dreieck' })).toBeChecked();
		await page.getByRole('combobox').selectOptions('Zaharka');
		await page.getByRole('button', { name: 'Kontrolle geben' }).click();
		expect(p.onGiveControl).toHaveBeenCalledWith('Zaharka');
		await page.getByRole('button', { name: 'Im KGS-Archiv speichern' }).click();
		expect(p.onSave).toHaveBeenCalled();
	});

	it('lets the owner take the control back, and shows no tools then', async () => {
		const p = props({ editor: 'Zaharka', editing: false, saved: true });
		await render(ReviewTools, p);
		await expect.element(page.getByText('Kontrolle: Zaharka')).toBeVisible();
		await expect.element(page.getByRole('radio', { name: 'Dreieck' })).not.toBeInTheDocument();
		await page.getByRole('button', { name: 'Kontrolle zurücknehmen' }).click();
		expect(p.onGiveControl).toHaveBeenCalledWith('andy1975');
		await expect.element(page.getByText('Im KGS-Archiv gespeichert')).toBeVisible();
	});

	it('shows a guest only who has the control', async () => {
		await render(ReviewTools, props({ editor: 'Zaharka', editing: false, owner: false }));
		await expect.element(page.getByText('Kontrolle: Zaharka')).toBeVisible();
		await expect.element(page.getByRole('button')).not.toBeInTheDocument();
	});
});
