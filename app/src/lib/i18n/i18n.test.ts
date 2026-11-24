import { SECTIONS as DE_SECTIONS, de } from './de.ts';
import { SECTIONS as EN_SECTIONS, en } from './en.ts';
import { formatMessage, language, languageFromBrowser, locale, t } from './index.svelte.ts';
import type { Message, Translation } from './types.ts';

// Placeholders of a text, sorted: "{count} Partien von {name}" -> count, name.
function placeholders(message: Message): string {
	const texts = typeof message === 'string' ? [message] : [message.one, message.other];
	const names = new Set(texts.flatMap((text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1])));
	return [...names].sort().join(',');
}

describe('formatMessage', () => {
	it('fills placeholders and leaves unknown ones', () => {
		expect(formatMessage('{name} spielt gegen {other}', { name: 'Ana', other: 'Bo' })).toBe(
			'Ana spielt gegen Bo'
		);
		expect(formatMessage('Zug {move}', {})).toBe('Zug {move}');
		expect(formatMessage('Ohne Platzhalter')).toBe('Ohne Platzhalter');
	});

	it('picks the plural form by count', () => {
		const games = { one: '{count} Partie', other: '{count} Partien' };
		expect(formatMessage(games, { count: 1 })).toBe('1 Partie');
		expect(formatMessage(games, { count: 2 })).toBe('2 Partien');
		expect(formatMessage(games, { count: 0 })).toBe('0 Partien');
	});
});

describe('t', () => {
	it('answers in the current language', () => {
		expect(t('settings.title')).toBe('Einstellungen');
		expect(locale()).toBe('de-DE');
		language.current = 'en';
		expect(t('settings.title')).toBe('Settings');
		expect(locale()).toBe('en-GB');
	});

	it('remembers the choice and sets <html lang>', () => {
		language.set('en');
		expect(localStorage.getItem('gotv.language')).toBe('en');
		expect(document.documentElement.lang).toBe('en');
		language.set('de');
		expect(localStorage.getItem('gotv.language')).toBe('de');
		expect(document.documentElement.lang).toBe('de');
	});
});

describe('languageFromBrowser', () => {
	it('chooses German for every German browser, else English', () => {
		expect(languageFromBrowser('de-DE')).toBe('de');
		expect(languageFromBrowser('de-AT')).toBe('de');
		expect(languageFromBrowser('DE')).toBe('de');
		expect(languageFromBrowser('en-US')).toBe('en');
		expect(languageFromBrowser('fr')).toBe('en');
		expect(languageFromBrowser(undefined)).toBe('en');
	});
});

describe('texts', () => {
	// The type system already makes en.ts carry exactly the keys of de.ts
	// (types.ts, Translation): a missing or extra key fails `npm run check`.
	it('makes a missing English key a type error', () => {
		// @ts-expect-error - "b" is missing
		const missing: Translation<{ a: string; b: string }> = { a: 'A' };
		const extra: Translation<{ a: string }> = {
			a: 'A',
			// @ts-expect-error - "c" does not exist in German
			c: 'C'
		};
		expect(Object.keys(missing).length + Object.keys(extra).length).toBe(3);
	});

	it('has the same keys in German and English', () => {
		expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
	});

	it('uses every key in one section only', () => {
		const sizes = Object.values(DE_SECTIONS).map((section) => Object.keys(section).length);
		expect(sizes.reduce((a, b) => a + b, 0)).toBe(Object.keys(de).length);
		expect(Object.keys(EN_SECTIONS)).toEqual(Object.keys(DE_SECTIONS));
	});

	it('keeps the placeholders of every German text in English', () => {
		const de2: Record<string, Message> = de;
		const en2: Record<string, Message> = en;
		const differing = Object.keys(de2).filter(
			(key) => placeholders(de2[key]) !== placeholders(en2[key])
		);
		expect(differing).toEqual([]);
	});

	it('has no empty texts', () => {
		const empty = [...Object.entries(de), ...Object.entries(en)].filter(([, message]) =>
			typeof message === 'string' ? !message.trim() : !message.one.trim() || !message.other.trim()
		);
		expect(empty).toEqual([]);
	});
});
