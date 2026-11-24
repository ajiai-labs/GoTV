import { kgsMessage } from './kgsText';

describe('kgsMessage', () => {
	it('translates the messages of the session logic and keeps KGS texts', () => {
		expect(kgsMessage('Login failed - bad password')).toBe(
			'Anmeldung fehlgeschlagen: Das Passwort stimmt nicht.'
		);
		expect(kgsMessage('Text von KGS')).toBe('Text von KGS');
		expect(kgsMessage(null)).toBeNull();
	});
});
