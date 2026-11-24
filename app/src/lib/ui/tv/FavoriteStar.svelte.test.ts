import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FavoriteStar from './FavoriteStar.svelte';

describe('FavoriteStar', () => {
	it('adds with an empty star and says what it does', async () => {
		const onToggle = vi.fn();
		await render(FavoriteStar, { active: false, name: 'JuppTube', onToggle });
		const star = page.getByRole('button', { name: 'JuppTube zu Mein GoTV hinzufügen' });
		await expect.element(star).toHaveTextContent('☆');
		await expect.element(star).toHaveAttribute('aria-pressed', 'false');
		await star.click();
		expect(onToggle).toHaveBeenCalledTimes(1);
	});

	it('removes with a filled star', async () => {
		await render(FavoriteStar, { active: true, name: 'JuppTube', onToggle: vi.fn() });
		const star = page.getByRole('button', { name: 'JuppTube aus Mein GoTV entfernen' });
		await expect.element(star).toHaveTextContent('★');
		await expect.element(star).toHaveAttribute('aria-pressed', 'true');
	});
});
