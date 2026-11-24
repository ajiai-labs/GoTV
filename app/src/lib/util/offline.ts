// Offline support of the web version (GitHub Pages, "yarn build:pages"):
// registers public/gotv-sw.js. The desktop app serves itself from this
// computer and needs no service worker; the development server must not
// get one (it would serve stale files).
// The build, from the main bundle's file name ("main.4341e0f5.chunk.js"):
// a new build means a new worker URL, so the browser installs it.
export function getBuildVersion(doc: Document = document): string {
	for (const script of Array.from(doc.getElementsByTagName('script'))) {
		const match = /\/main\.([0-9a-f]+)\.chunk\.js/.exec(script.src || '');

		if (match) {
			return match[1];
		}
	}

	return 'dev';
}
export function shouldRegisterOffline(env: Record<string, any>): boolean {
	return env.NODE_ENV === 'production' && env.REACT_APP_GUEST_ONLY === 'true';
}
export function registerOfflineSupport() {
	const container = navigator.serviceWorker;

	if (!shouldRegisterOffline(process.env) || !container) {
		return;
	}

	const base = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
	const url = base + '/gotv-sw.js?v=' + getBuildVersion();
	container
		.register(url, {
			scope: base + '/'
		})
		.catch((err) => console.warn('[tv] Offline support unavailable:', err));
}
