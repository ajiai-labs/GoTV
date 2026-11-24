// "Zum Home-Bildschirm" on iPad and iPhone: Safari has no install prompt of
// its own, so the web version (GitHub Pages) shows a small hint how to add
// GoTV via Teilen - only in Safari on iOS/iPadOS, only while GoTV is not
// already running from the home screen, and only until it is closed
// (gotv.homeHintDismissed, this device only).
export const HOME_HINT_KEY = 'gotv.homeHintDismissed';

export type DeviceInfo = {
	userAgent: string;
	maxTouchPoints: number;
	// navigator.standalone (Safari only): opened from the home screen.
	standalone: boolean;
	// display-mode: standalone (installed web app).
	displayStandalone: boolean;
};

// Other browsers and in-app views on iOS name themselves in the user agent.
const NOT_SAFARI_RE =
	/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo|YaBrowser|FBAN|FBAV|Instagram/;

export function isIosSafari(userAgent: string, maxTouchPoints: number): boolean {
	// iPadOS 13+ presents itself as a Mac; only the touch screen tells.
	const ios =
		/iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
	return ios && /Safari\//.test(userAgent) && !NOT_SAFARI_RE.test(userAgent);
}

export function shouldShowHomeHint(
	device: DeviceInfo,
	guestOnly: boolean,
	dismissed: boolean
): boolean {
	return (
		guestOnly &&
		!dismissed &&
		!device.standalone &&
		!device.displayStandalone &&
		isIosSafari(device.userAgent, device.maxTouchPoints)
	);
}

export function getDeviceInfo(): DeviceInfo {
	const nav = navigator as Navigator & { standalone?: boolean };
	let displayStandalone = false;
	try {
		displayStandalone = window.matchMedia('(display-mode: standalone)').matches;
	} catch {
		// no media queries: not installed
	}
	return {
		userAgent: nav.userAgent || '',
		maxTouchPoints: nav.maxTouchPoints || 0,
		standalone: nav.standalone === true,
		displayStandalone
	};
}

export function loadHomeHintDismissed(storage: Storage = window.localStorage): boolean {
	try {
		return storage.getItem(HOME_HINT_KEY) === '1';
	} catch {
		return false; // storage disabled
	}
}

export function saveHomeHintDismissed(storage: Storage = window.localStorage) {
	try {
		storage.setItem(HOME_HINT_KEY, '1');
	} catch {
		// shown again next time without storage
	}
}
