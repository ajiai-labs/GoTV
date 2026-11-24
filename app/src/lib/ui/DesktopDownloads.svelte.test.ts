import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DesktopDownloads from './DesktopDownloads.svelte';
import { detectOs, downloadUrl } from '#lib/desktopDownloads.ts';

describe('DesktopDownloads', () => {
	it('recognises the visitor system (iPad counts as mobile)', () => {
		const nav = (userAgent: string, maxTouchPoints = 0) => ({ userAgent, maxTouchPoints });
		expect(detectOs(nav('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'))).toBe('windows');
		expect(detectOs(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)'))).toBe('macos');
		expect(detectOs(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)', 5))).toBe('mobile');
		expect(detectOs(nav('Mozilla/5.0 (X11; Linux x86_64)'))).toBe('linux');
		expect(detectOs(nav('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)'))).toBe('mobile');
	});

	it('links every system to the latest release with fixed file names', async () => {
		await render(DesktopDownloads);
		await expect
			.element(page.getByRole('heading', { name: 'GoTV-Desktop-App herunterladen' }))
			.toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Installer (.exe)' }))
			.toHaveAttribute('href', downloadUrl('GoTV-windows-x64-setup.exe'));
		await expect
			.element(page.getByRole('link', { name: 'Apple Silicon und Intel (.dmg)' }))
			.toHaveAttribute(
				'href',
				'https://github.com/ajiai-labs/GoTV/releases/latest/download/GoTV-macos-universal.dmg'
			);
		await expect.element(page.getByRole('link', { name: 'AppImage' })).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'So öffnest du sie' })).toBeVisible();
	});
});
