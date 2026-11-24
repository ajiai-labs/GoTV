import { shouldRegisterServiceWorker } from './serviceWorker';

describe('shouldRegisterServiceWorker', () => {
	it('registers only in the production web version', () => {
		expect(shouldRegisterServiceWorker({ dev: false, guestOnly: true })).toBe(true);
		expect(shouldRegisterServiceWorker({ dev: false, guestOnly: false })).toBe(false);
		expect(shouldRegisterServiceWorker({ dev: true, guestOnly: true })).toBe(false);
	});
});
