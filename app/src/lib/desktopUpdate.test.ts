import { describe, expect, it, vi } from 'vitest';
import {
	fetchLatestDesktopVersion,
	isNewerVersion,
	openDownload,
	parseVersion,
	updateDownloads
} from './desktopUpdate';

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { status });
}

describe('desktop update', () => {
	it('compares versions number by number', () => {
		expect(parseVersion('0.10.2')).toEqual([0, 10, 2]);
		expect(parseVersion('desktop-v1.0.0')).toBeNull();
		expect(isNewerVersion('0.3.0', '0.2.0')).toBe(true);
		expect(isNewerVersion('0.10.0', '0.9.9')).toBe(true);
		expect(isNewerVersion('0.2.0', '0.2.0')).toBe(false);
		expect(isNewerVersion('0.1.9', '0.2.0')).toBe(false);
		expect(isNewerVersion('kaputt', '0.2.0')).toBe(false);
	});

	it('reads the newest desktop release from GitHub', async () => {
		const fetchFn = vi.fn(() => Promise.resolve(jsonResponse({ tag_name: 'desktop-v0.3.0' })));
		await expect(fetchLatestDesktopVersion(fetchFn as typeof fetch)).resolves.toBe('0.3.0');
		expect(fetchFn).toHaveBeenCalledWith(
			'https://api.github.com/repos/ajiai-labs/GoTV/releases/latest',
			expect.anything()
		);
	});

	it('ignores releases that are no desktop release', async () => {
		const fetchFn = vi.fn(() => Promise.resolve(jsonResponse({ tag_name: 'v9.0.0' })));
		await expect(fetchLatestDesktopVersion(fetchFn as typeof fetch)).resolves.toBeNull();
	});

	it('fails on a GitHub error', async () => {
		const fetchFn = vi.fn(() => Promise.resolve(jsonResponse({}, 403)));
		await expect(fetchLatestDesktopVersion(fetchFn as typeof fetch)).rejects.toThrow('403');
	});

	it('offers the installers of this system', () => {
		expect(updateDownloads('macos').map((d) => d.file)).toEqual(['GoTV-macos-universal.dmg']);
		expect(updateDownloads('other')).toHaveLength(5);
	});

	it('asks the desktop server to open the installer', async () => {
		const fetchFn = vi.fn(() => Promise.resolve(new Response('OK', { status: 200 })));
		await expect(openDownload('GoTV-linux-amd64.deb', fetchFn as typeof fetch)).resolves.toBe(true);
		expect(fetchFn).toHaveBeenCalledWith('/desktop/open-download/GoTV-linux-amd64.deb', {
			method: 'POST'
		});
		const failing = vi.fn(() => Promise.reject(new Error('offline')));
		await expect(openDownload('x', failing as typeof fetch)).resolves.toBe(false);
	});
});
