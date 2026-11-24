import { describe, expect, it } from 'vitest';
import { getPublicSgfUrl, getReplayShareLink, parseMoveParam } from './ReplayLink';
import { PUBLIC_BASE_URL } from '../publicUrl';

describe('getPublicSgfUrl', () => {
	it('keeps http(s) addresses', () => {
		expect(getPublicSgfUrl('https://online-go.com/api/v1/games/1/sgf')).toBe(
			'https://online-go.com/api/v1/games/1/sgf'
		);
		expect(getPublicSgfUrl('http://example.org/a.sgf')).toBe('http://example.org/a.sgf');
	});

	it('puts the public base in front of bundled files', () => {
		expect(getPublicSgfUrl('/tv/em-finale-2026.sgf')).toBe(
			PUBLIC_BASE_URL + '/tv/em-finale-2026.sgf'
		);
		// Already with this app's base path (GitHub Pages build).
		expect(getPublicSgfUrl('/GoTV/neu/tv/demo.sgf', '/GoTV/neu')).toBe(
			PUBLIC_BASE_URL + '/tv/demo.sgf'
		);
	});

	it('never shares a local or unusable address', () => {
		expect(getPublicSgfUrl('blob:http://127.0.0.1:8788/abc')).toBeNull();
		expect(getPublicSgfUrl('data:text/plain,(;SZ[9])')).toBeNull();
		expect(getPublicSgfUrl('tv/demo.sgf')).toBeNull();
		expect(getPublicSgfUrl('//example.org/a.sgf')).toBe('https://example.org/a.sgf');
	});
});

describe('getReplayShareLink', () => {
	it('links the public Nachspielen page at the move', () => {
		expect(getReplayShareLink('https://example.org/a b.sgf', 42)).toBe(
			PUBLIC_BASE_URL +
				'/nachspielen?sgf=' +
				encodeURIComponent('https://example.org/a%20b.sgf') +
				'&zug=42'
		);
		expect(getReplayShareLink('/tv/demo.sgf', 0)).toBe(
			PUBLIC_BASE_URL + '/nachspielen?sgf=' + encodeURIComponent(PUBLIC_BASE_URL + '/tv/demo.sgf')
		);
		expect(getReplayShareLink('blob:x', 3)).toBeNull();
	});

	it('never points at the local address', () => {
		expect(getReplayShareLink('/tv/demo.sgf', 5)).not.toContain('127.0.0.1');
		expect(getReplayShareLink('/tv/demo.sgf', 5)!.startsWith('https://')).toBe(true);
	});
});

describe('parseMoveParam', () => {
	it('reads move numbers and ignores everything else', () => {
		expect(parseMoveParam('0')).toBe(0);
		expect(parseMoveParam('17')).toBe(17);
		expect(parseMoveParam(null)).toBeNull();
		expect(parseMoveParam('')).toBeNull();
		expect(parseMoveParam('-3')).toBeNull();
		expect(parseMoveParam('2.5')).toBeNull();
		expect(parseMoveParam('abc')).toBeNull();
		expect(parseMoveParam('9999999')).toBeNull();
	});
});
