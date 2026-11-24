import { describe, expect, it } from 'vitest';
import {
	HOME_HINT_KEY,
	isIosSafari,
	loadHomeHintDismissed,
	saveHomeHintDismissed,
	shouldShowHomeHint
} from './homeScreen';

const IPHONE =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1';
// iPadOS presents itself as a Mac.
const IPAD =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15';
const IPHONE_CHROME =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1';
const ANDROID =
	'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';

const device = (userAgent: string, maxTouchPoints = 5) => ({
	userAgent,
	maxTouchPoints,
	standalone: false,
	displayStandalone: false
});

describe('isIosSafari', () => {
	it('finds Safari on iPhone and iPad', () => {
		expect(isIosSafari(IPHONE, 5)).toBe(true);
		expect(isIosSafari(IPAD, 5)).toBe(true);
	});

	it('leaves out Macs, other browsers and Android', () => {
		expect(isIosSafari(IPAD, 0)).toBe(false); // a Mac without touch screen
		expect(isIosSafari(IPHONE_CHROME, 5)).toBe(false);
		expect(isIosSafari(ANDROID, 5)).toBe(false);
	});
});

describe('shouldShowHomeHint', () => {
	it('shows only in the web version, in Safari, not yet on the home screen', () => {
		expect(shouldShowHomeHint(device(IPHONE), true, false)).toBe(true);
		expect(shouldShowHomeHint(device(IPHONE), false, false)).toBe(false); // desktop app
		expect(shouldShowHomeHint(device(IPHONE), true, true)).toBe(false); // closed
		expect(shouldShowHomeHint({ ...device(IPHONE), standalone: true }, true, false)).toBe(false);
		expect(shouldShowHomeHint({ ...device(IPAD), displayStandalone: true }, true, false)).toBe(
			false
		);
		expect(shouldShowHomeHint(device(ANDROID), true, false)).toBe(false);
	});

	it('remembers a closed hint', () => {
		window.localStorage.clear();
		expect(loadHomeHintDismissed()).toBe(false);
		saveHomeHintDismissed();
		expect(window.localStorage.getItem(HOME_HINT_KEY)).toBe('1');
		expect(loadHomeHintDismissed()).toBe(true);
		window.localStorage.clear();
	});
});
