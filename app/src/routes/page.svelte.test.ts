import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

describe('start page', () => {
	it('names the app', async () => {
		await render(Page);
		await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('GoTV');
	});
});
