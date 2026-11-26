// KGS games in their own windows, as in CGoban (26.11.2026): the main window
// keeps the lists, rooms and chats; each game you open gets a window of its
// own (route /partie?id=N). A game that already has its window brings that
// window to the front instead of opening a second one. All windows share
// one KGS connection (windowLink.ts).
//
// An own game that starts without a click (a found opponent) is tried as
// well; browsers may block a window that opens by itself - then it shows up
// in the main window, where "Eigenes Fenster" moves it out.
import { resolve } from '$app/paths';
import { config } from './config';
import { addBoard, emptyBoards, loadBoards, saveBoards } from './model/team';

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

// A window by name. A new one opens empty and then loads `url`. One that is
// open already (also opened by another GoTV window) is closed and opened
// afresh: Wayland desktops (GNOME) do not let a page bring another window to
// the front - window.focus() silently does nothing there, so the click would
// seem to do nothing (found by the user, 26.11.2026). A new window always
// appears in front; what it shows lives at KGS and in the browser storage.
function openNamed(url: string, name: string): Window | null {
	const win = window.open('', name, FEATURES);
	if (!win) return null;
	try {
		if (win.location.href === 'about:blank') {
			win.location.replace(url);
			win.focus();
			return win;
		}
	} catch {
		// not readable: open it afresh below
	}
	win.close();
	const fresh = window.open(url, name, FEATURES);
	fresh?.focus();
	return fresh;
}

// Opens (or brings to the front) the window of a game. False if the browser
// refused it - then the caller shows the game here.
export function openGameWindow(gameId: number): boolean {
	return !!openNamed(gameWindowUrl(gameId), `gotv-partie-${gameId}`);
}

// The Brettübersicht (routes/bretter): one window for several games.
export function openBoardsWindow(): boolean {
	return !!openNamed(resolve('/bretter'), 'gotv-bretter');
}

// "Zur Brettübersicht" (Beobachten, player profile): the game goes on the
// next free board and the window opens or comes to the front. 'full' if all
// boards are taken, 'refused' if the browser blocked the window.
// If the overview is open already it takes the new board by itself (storage
// event) and is left as it is - position, enlarged board - 'added'; the
// "Brettübersicht" button brings it to the front.
// The boards belong to the open overview: with the window closed, the next
// game starts an empty one (user, 26.11.2026: closed boards kept the
// overview "full", and every click opened a single window instead).
export function bringToBoards(
	gameId: number,
	isKnown?: (id: number) => boolean
): 'shown' | 'added' | 'full' | 'refused' {
	const start = isBoardsWindowOpen() ? loadBoards() : emptyBoards();
	const boards = addBoard(start, gameId, isKnown);
	if (!boards) return 'full';
	saveBoards(boards);
	const win = window.open('', 'gotv-bretter', FEATURES);
	if (!win) return 'refused';
	try {
		if (win.location.href !== 'about:blank') return 'added';
	} catch {
		return 'added';
	}
	win.location.replace(resolve('/bretter'));
	win.focus();
	return 'shown';
}

// "Partien in die Brettübersicht holen" (switch on Beobachten): while it is
// on, every game clicked in the list goes to the Brettübersicht.
export const BOARDS_MODE_KEY = 'gotv.boardsMode';

export function loadBoardsMode(): boolean {
	try {
		return localStorage.getItem(BOARDS_MODE_KEY) === 'on';
	} catch {
		return false;
	}
}

export function saveBoardsMode(on: boolean) {
	try {
		localStorage.setItem(BOARDS_MODE_KEY, on ? 'on' : 'off');
	} catch {
		// not remembered without storage
	}
}

// The open Brettübersicht says so every few seconds (routes/bretter); a
// closed one stops, so its boards no longer count.
export const BOARDS_OPEN_KEY = 'gotv.boardsOpenAt';
export const BOARDS_HEARTBEAT_MS = 2000;

export function isBoardsWindowOpen(now: number = Date.now()): boolean {
	try {
		const at = Number(localStorage.getItem(BOARDS_OPEN_KEY));
		return at > 0 && now - at < BOARDS_HEARTBEAT_MS * 3;
	} catch {
		return false;
	}
}

export function markBoardsWindowOpen(open: boolean) {
	try {
		if (open) localStorage.setItem(BOARDS_OPEN_KEY, String(Date.now()));
		else localStorage.removeItem(BOARDS_OPEN_KEY);
	} catch {
		// without storage every click starts a new overview
	}
}
