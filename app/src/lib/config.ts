// Build settings of the new app. Replaces the old app's process.env
// (Create React App), which does not exist in the browser here.
//
//   VITE_API_URL     KGS endpoint; the desktop app sets "/json/access"
//                    (its local proxy, see desktop/goTV_local.py)
//   VITE_GUEST_ONLY  "true" for GitHub Pages: guest TV only, no KGS login
//                    (KGS only accepts requests from its own website)
//   BASE_PATH        path prefix, "/GoTV" on GitHub Pages (vite.config.ts)
//   VITE_EVENTS_REMOTE_FIRST  "true" for the Tauri desktop apps (Windows,
//                    macOS, Linux): no daily calendar timer there, so the
//                    desktop case loads events.json from GitHub first and
//                    the bundled copy only as a fallback (desktop/tauri/)
//   VITE_DESKTOP_VERSION  version of the Tauri desktop app ("0.3.0"), set by
//                    .github/workflows/desktop.yml; enables the update notice
//                    (desktopUpdate.ts)
import { resolve } from '$app/paths';

const env = import.meta.env;

export const config: {
	basePath: string;
	apiUrl: string | null;
	dev: boolean;
	guestOnly: boolean;
	eventsRemoteFirst: boolean;
} = {
	basePath: resolve('/').replace(/\/$/, ''),
	apiUrl: (env.VITE_API_URL as string | undefined) || null,
	dev: env.DEV,
	guestOnly: env.VITE_GUEST_ONLY === 'true',
	eventsRemoteFirst: env.VITE_EVENTS_REMOTE_FIRST === 'true'
};

// The desktop app talks to KGS through its local proxy.
export function isDesktop(): boolean {
	return config.apiUrl === '/json/access';
}
