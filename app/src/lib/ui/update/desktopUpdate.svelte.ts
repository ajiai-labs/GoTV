// Shared state of the update check: the notice at the top and "Über GoTV"
// in the settings show the same result; one check per app start.
import { fetchLatestDesktopVersion, isNewerVersion } from '#lib/desktopUpdate.ts';

export type UpdateStatus = 'idle' | 'checking' | 'upToDate' | 'available' | 'error';

class DesktopUpdateState {
	status: UpdateStatus = $state('idle');
	latest: string | null = $state(null);

	async check(current: string, fetchFn: typeof fetch = fetch) {
		if (this.status === 'checking') return;
		this.status = 'checking';
		try {
			const latest = await fetchLatestDesktopVersion(fetchFn);
			this.latest = latest;
			this.status = latest && isNewerVersion(latest, current) ? 'available' : 'upToDate';
		} catch {
			this.status = 'error';
		}
	}

	reset() {
		this.status = 'idle';
		this.latest = null;
	}
}

export const desktopUpdate = new DesktopUpdateState();
