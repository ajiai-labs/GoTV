// Update notice of the Tauri desktop apps: which version runs, whether
// GitHub has a newer release, and opening its installer in the system
// browser (through the local desktop server, desktop/tauri/gotv-server).
// VITE_DESKTOP_VERSION is set only by .github/workflows/desktop.yml - the
// web version and the Linux script installation have none and never check.
import { DOWNLOADS } from '#lib/desktopDownloads.ts';
import type { DesktopOs, DownloadKind } from '#lib/desktopDownloads.ts';

export const DESKTOP_VERSION: string | null =
	(import.meta.env.VITE_DESKTOP_VERSION as string | undefined) || null;

const LATEST_RELEASE_API = 'https://api.github.com/repos/ajiai-labs/GoTV/releases/latest';
const TAG_PREFIX = 'desktop-v';
const DISMISSED_KEY = 'gotv.updateDismissed';

type Version = [number, number, number];

export function parseVersion(text: string): Version | null {
	const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(text.trim());
	return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

// True if `latest` is a higher version than `current` (both "X.Y.Z").
export function isNewerVersion(latest: string, current: string): boolean {
	const a = parseVersion(latest);
	const b = parseVersion(current);
	if (!a || !b) return false;
	for (let i = 0; i < 3; i++) {
		if (a[i] !== b[i]) return a[i] > b[i];
	}
	return false;
}

// The version of the newest published desktop release ("0.3.0"), or null if
// the newest release is no desktop release. Throws on network errors.
export async function fetchLatestDesktopVersion(
	fetchFn: typeof fetch = fetch
): Promise<string | null> {
	const response = await fetchFn(LATEST_RELEASE_API, {
		headers: { Accept: 'application/vnd.github+json' }
	});
	if (!response.ok) throw new Error(`GitHub ${response.status}`);
	const release = (await response.json()) as { tag_name?: unknown };
	const tag = typeof release.tag_name === 'string' ? release.tag_name : '';
	if (!tag.startsWith(TAG_PREFIX)) return null;
	const version = tag.slice(TAG_PREFIX.length);
	return parseVersion(version) ? version : null;
}

// The installers to offer on this system (all systems if unknown).
export function updateDownloads(os: DesktopOs): Array<{ file: string; kind: DownloadKind }> {
	if (os === 'windows' || os === 'macos' || os === 'linux') return DOWNLOADS[os];
	return [...DOWNLOADS.windows, ...DOWNLOADS.macos, ...DOWNLOADS.linux];
}

// Asks the desktop server to open the installer in the system browser,
// which downloads it. False if that did not work.
export async function openDownload(file: string, fetchFn: typeof fetch = fetch): Promise<boolean> {
	try {
		const response = await fetchFn(`/desktop/open-download/${encodeURIComponent(file)}`, {
			method: 'POST'
		});
		return response.ok;
	} catch {
		return false;
	}
}

// "Später" hides the notice for this one version.
export function loadDismissedVersion(): string | null {
	try {
		return localStorage.getItem(DISMISSED_KEY);
	} catch {
		return null;
	}
}

export function saveDismissedVersion(version: string) {
	try {
		localStorage.setItem(DISMISSED_KEY, version);
	} catch {
		// not remembered without storage
	}
}
