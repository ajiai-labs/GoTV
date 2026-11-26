// KGS games in their own windows, as in CGoban (26.11.2026): the main window
// keeps the lists, rooms and chats; each game you open gets a window of its
// own (route /partie?id=N). A game that already has its window brings that
// window to the front instead of opening a second one. All windows share
// one KGS connection (windowLink.ts).
//
// Opening needs a click: browsers block windows that open by themselves, so
// a game that starts without one (a found opponent) shows up in the main
// window, where "Eigenes Fenster" moves it out.
import { resolve } from '$app/paths';
import { config } from './config';

export const GAME_WINDOWS_KEY = 'gotv.gameWindows';
const FEATURES = 'popup,width=1180,height=820';

export function loadGameWindows(): boolean {
	if (config.guestOnly) return false; // the web version has no KGS
	try {
		const stored = localStorage.getItem(GAME_WINDOWS_KEY);
		if (stored) return stored !== 'off';
	} catch {
		// storage disabled: the default below
	}
	// On by default; component tests switch it on themselves where needed.
	return import.meta.env.MODE !== 'test';
}

export function saveGameWindows(on: boolean) {
	try {
		localStorage.setItem(GAME_WINDOWS_KEY, on ? 'on' : 'off');
	} catch {
		// not remembered without storage
	}
}

export function gameWindowUrl(gameId: number): string {
	return `${resolve('/partie')}?id=${gameId}`;
}

// The windows this window opened, to bring one back instead of a second.
const opened = new Map<number, Window>();

// Opens (or brings to the front) the window of a game. False if the browser
// refused it - then the caller shows the game here.
export function openGameWindow(gameId: number): boolean {
	const known = opened.get(gameId);
	if (known && !known.closed) {
		known.focus();
		return true;
	}
	const win = window.open(gameWindowUrl(gameId), `gotv-partie-${gameId}`, FEATURES);
	if (!win) return false;
	opened.set(gameId, win);
	win.focus();
	return true;
}
