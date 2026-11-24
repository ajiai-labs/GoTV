// Registers src/service-worker.ts (offline support) in the web version on
// GitHub Pages only - not in the desktop app (served from this computer)
// and not in the development server (it would serve stale files).
import { config } from '../config';

export function shouldRegisterServiceWorker(settings: { dev: boolean; guestOnly: boolean }) {
	return !settings.dev && settings.guestOnly;
}

export function registerServiceWorker() {
	const container = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker;
	if (!container || !shouldRegisterServiceWorker(config)) return;
	container
		.register(`${config.basePath}/service-worker.js`, { scope: `${config.basePath}/` })
		.catch((err: unknown) => console.warn('[tv] Offline support unavailable:', err));
}
