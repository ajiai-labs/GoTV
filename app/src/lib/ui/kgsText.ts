// German wording for the English messages set by the ported session logic
// (src/lib/model/session.ts). Texts that come from KGS itself (msg.text)
// are shown as they are.
const MESSAGES: Record<string, string> = {
	'Enter username and password': 'Bitte Benutzername und Passwort eingeben.',
	'Login failed - no such user': 'Anmeldung fehlgeschlagen: Diesen Benutzer gibt es bei KGS nicht.',
	'Login failed - you are temporarily banned':
		'Anmeldung fehlgeschlagen: Das Konto ist vorübergehend gesperrt.',
	'Login failed - bad password': 'Anmeldung fehlgeschlagen: Das Passwort stimmt nicht.',
	'Login failed - user already exists': 'Anmeldung fehlgeschlagen: Den Benutzer gibt es schon.',
	'Automatically logged out because your account has been logged into another system':
		'Abgemeldet, weil das Konto anderswo angemeldet wurde',
	'Previous session expired or became invalid': 'Die vorige Sitzung ist abgelaufen'
};

export function kgsMessage(text: string | null | undefined): string | null {
	if (!text) return null;
	return MESSAGES[text] ?? text;
}
