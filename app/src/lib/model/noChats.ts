// "Keine Unterhaltungen" (CGoban, Benutzer menu): while on, GoTV declines
// every new private chat with KGS's CONVO_NO_CHATS. Kept in this browser.
const KEY = 'gotv.noChats';

export function loadNoChats(): boolean {
	try {
		return localStorage.getItem(KEY) === '1';
	} catch {
		return false;
	}
}

export function saveNoChats(on: boolean) {
	try {
		localStorage.setItem(KEY, on ? '1' : '0');
	} catch {
		// not remembered without storage
	}
}
