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
import { addBoard, loadBoards, saveBoards } from './model/team';

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

// The Brettübersicht (routes/bretter): one window for several games.
let boardsWindow: Window | null = null;
export function openBoardsWindow(): boolean {
	if (boardsWindow && !boardsWindow.closed) {
		boardsWindow.focus();
		return true;
	}
	const win = window.open(resolve('/bretter'), 'gotv-bretter', FEATURES);
	if (!win) return false;
	boardsWindow = win;
	win.focus();
	return true;
}

// "Zur Brettübersicht" (Beobachten, player profile): the game goes on the
// next free board and the window opens or comes to the front. 'full' if all
// boards are taken, 'refused' if the browser blocked the window.
export function bringToBoards(gameId: number): 'shown' | 'full' | 'refused' {
	const boards = addBoard(loadBoards(), gameId);
	if (!boards) return 'full';
	saveBoards(boards);
	return openBoardsWindow() ? 'shown' : 'refused';
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
