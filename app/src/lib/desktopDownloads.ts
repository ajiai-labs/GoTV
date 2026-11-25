// Downloads of the GoTV desktop apps (Tauri, GitHub Releases).
export type DesktopOs = 'windows' | 'macos' | 'linux' | 'mobile' | 'other';

const RELEASES = 'https://github.com/ajiai-labs/GoTV/releases';
// Fixed file names, uploaded next to the versioned ones by
// .github/workflows/desktop.yml, so "latest" always has them.
export type DownloadKind = 'exe' | 'msi' | 'dmg' | 'appimage' | 'deb';
export const DOWNLOADS: Record<
	'windows' | 'macos' | 'linux',
	Array<{ file: string; kind: DownloadKind }>
> = {
	windows: [
		{ file: 'GoTV-windows-x64-setup.exe', kind: 'exe' },
		{ file: 'GoTV-windows-x64.msi', kind: 'msi' }
	],
	macos: [{ file: 'GoTV-macos-universal.dmg', kind: 'dmg' }],
	linux: [
		{ file: 'GoTV-linux-x86_64.AppImage', kind: 'appimage' },
		{ file: 'GoTV-linux-amd64.deb', kind: 'deb' }
	]
};

export function downloadUrl(file: string): string {
	return `${RELEASES}/latest/download/${file}`;
}

export const RELEASES_URL = RELEASES;
export const INSTALL_HELP_URL =
	'https://github.com/ajiai-labs/GoTV/blob/master/desktop/tauri/README.md';

// The visitor's system, to offer the right download first.
export function detectOs(nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'>): DesktopOs {
	const ua = nav.userAgent;
	if (/iPhone|iPad|iPod|Android/i.test(ua)) return 'mobile';
	// iPadOS reports itself as a Mac, but has a touch screen.
	if (/Macintosh/i.test(ua)) return nav.maxTouchPoints > 1 ? 'mobile' : 'macos';
	if (/Windows/i.test(ua)) return 'windows';
	if (/Linux|X11/i.test(ua)) return 'linux';
	return 'other';
}
