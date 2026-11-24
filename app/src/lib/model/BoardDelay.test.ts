import { clampDelay, getDelayChannelKey, loadDelay, saveDelay, stepDelay } from './BoardDelay';
const EGF_EVENT = {
	id: 'speed-go',
	name: 'Speed Go',
	date_start: '2026-11-29',
	platform: 'twitch',
	stream_url: 'https://www.twitch.tv/europeangofederation',
	channel: {
		platform: 'twitch',
		id: 'EuropeanGoFederation'
	}
};
const JUPP_EVENT = {
	id: 'jupp',
	name: 'JuppTube',
	date_start: '2026-11-29',
	platform: 'youtube',
	stream_url: 'https://www.youtube.com/@JuppTube/'
};
describe('BoardDelay', () => {
	beforeEach(() => window.localStorage.clear());
	it('keeps the delay between 0 and 120 seconds', () => {
		expect(clampDelay('15')).toBe(15);
		expect(clampDelay(-3)).toBe(0);
		expect(clampDelay('x')).toBe(0);
		expect(clampDelay(500)).toBe(120);
	});
	it('steps by five seconds', () => {
		expect(stepDelay(10, 1)).toBe(15);
		expect(stepDelay(3, -1)).toBe(0);
		expect(stepDelay(118, 1)).toBe(120);
	});
	it('names the stream by its channel, else by its URL', () => {
		expect(getDelayChannelKey(EGF_EVENT)).toBe('twitch/europeangofederation');
		expect(getDelayChannelKey(JUPP_EVENT)).toBe('https://www.youtube.com/@jupptube');
	});
	it('remembers the delay per channel, the last one as the default', () => {
		expect(loadDelay(EGF_EVENT)).toBe(0);
		saveDelay(EGF_EVENT, 20);
		expect(loadDelay(EGF_EVENT)).toBe(20);
		// A channel without its own value starts from the last one set.
		expect(loadDelay(JUPP_EVENT)).toBe(20);
		saveDelay(JUPP_EVENT, 5);
		expect(loadDelay(JUPP_EVENT)).toBe(5);
		expect(loadDelay(EGF_EVENT)).toBe(20);
	});
	it('reads the old single setting as the default', () => {
		window.localStorage.setItem('gotv.boardDelay', '30');
		expect(loadDelay(EGF_EVENT)).toBe(30);
	});
});
