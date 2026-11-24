import { language } from '#lib/i18n/index.svelte.ts';
import { kgsMessage } from './kgsText';

describe('kgsMessage', () => {
	it('translates the messages of the session logic and keeps KGS texts', () => {
		expect(kgsMessage('Login failed - bad password')).toBe(
			'Anmeldung fehlgeschlagen: Das Passwort stimmt nicht.'
		);
		expect(kgsMessage('Text von KGS')).toBe('Text von KGS');
		expect(kgsMessage(null)).toBeNull();
	});

	it('shows the original English text in English', () => {
		language.current = 'en';
		expect(kgsMessage('Login failed - bad password')).toBe('Login failed - bad password');
	});
});
