// Wording for the English messages set by the ported session logic
// (src/lib/model/session.ts): German in German, the original text in
// English. Texts that come from KGS itself (msg.text) are shown as they are.
import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';

const MESSAGES: Record<string, MessageKey> = {
	'Enter username and password': 'app.kgs.enterLogin',
	'Login failed - no such user': 'app.kgs.noSuchUser',
	'Login failed - you are temporarily banned': 'app.kgs.banned',
	'Login failed - bad password': 'app.kgs.badPassword',
	'Login failed - user already exists': 'app.kgs.userExists',
	'Automatically logged out because your account has been logged into another system':
		'app.kgs.loggedInElsewhere',
	'Previous session expired or became invalid': 'app.kgs.sessionExpired'
};

export function kgsMessage(text: string | null | undefined): string | null {
	if (!text) return null;
	const key = MESSAGES[text];
	return key ? t(key) : text;
}
