import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import StreamEmbed from './StreamEmbed.svelte';

const VIDEO = 'https://www.youtube.com/watch?v=abcdefghijk';

describe('StreamEmbed', () => {
	it('shows a placeholder first and loads the iframe only after the click', async () => {
		const onLoad = vi.fn();
		await render(StreamEmbed, { url: VIDEO, onLoad });
		await expect.element(page.getByText(/offiziellen YouTube-Player/)).toBeVisible();
		expect(document.querySelector('iframe')).toBeNull();

		await page.getByRole('button', { name: 'Stream laden' }).click();
		expect(onLoad).toHaveBeenCalledTimes(1);
		const frame = page.getByTitle(VIDEO);
		await expect.element(frame).toBeInTheDocument();
		expect(frame.element().getAttribute('src')).toContain('youtube-nocookie.com/embed/abcdefghijk');
	});

	it('opens externally in a new tab without referrer', async () => {
		await render(StreamEmbed, { url: VIDEO });
		const link = page.getByRole('link', { name: 'Extern öffnen' });
		await expect.element(link).toHaveAttribute('href', VIDEO);
		await expect.element(link).toHaveAttribute('target', '_blank');
		await expect.element(link).toHaveAttribute('rel', 'noopener noreferrer');
	});

	it('follows the loaded prop when the parent controls it', async () => {
		const view = await render(StreamEmbed, { url: VIDEO, loaded: true });
		await expect.element(page.getByTitle(VIDEO)).toBeInTheDocument();
		await view.rerender({ loaded: false });
		await expect.element(page.getByRole('button', { name: 'Stream laden' })).toBeVisible();
		expect(document.querySelector('iframe')).toBeNull();
	});

	it('offers only the external link when the stream cannot be embedded', async () => {
		await render(StreamEmbed, { url: 'https://www.youtube.com/@EuropeanGoFederation' });
		await expect.element(page.getByText(/kann nicht direkt eingebettet werden/)).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Extern öffnen' })).toBeVisible();
		expect(document.querySelector('button')).toBeNull();
	});
});
