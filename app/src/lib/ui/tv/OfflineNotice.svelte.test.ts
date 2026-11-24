import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import OfflineNotice from './OfflineNotice.svelte';

describe('OfflineNotice', () => {
	afterEach(() => vi.restoreAllMocks());

	it('appears while the device is offline', async () => {
		let onLine = true;
		vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => onLine);
		await render(OfflineNotice, {});
		expect(document.querySelector('.OfflineNotice')).toBeNull();
		onLine = false;
		window.dispatchEvent(new Event('offline'));
		await expect.element(page.getByText(/Nachspielen und KataGo gehen weiter/)).toBeVisible();
		onLine = true;
		window.dispatchEvent(new Event('online'));
		await expect.poll(() => document.querySelector('.OfflineNotice')).toBeNull();
	});
});
