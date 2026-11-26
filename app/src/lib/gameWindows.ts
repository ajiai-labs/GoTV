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

// The Brettübersicht (routes/bretter): one window for several games. Its
// boards belong to the open window: whether it is open is asked of the
// browser itself (a window by that name), and a closed one starts empty.
// (User, 26.11.2026: closed boards came back, filled the overview and made
// every click open a single window.)
const BOARDS_NAME = 'gotv-bretter';

function isBlank(win: Window): boolean {
	try {
		return win.location.href === 'about:blank';
	} catch {
		return false;
	}
}

// "Brettübersicht" button: open, or bring to the front (closed and opened
// afresh, see openNamed - its boards stay).
export function openBoardsWindow(): boolean {
	const win = window.open('', BOARDS_NAME, FEATURES);
	if (!win) return false;
	if (isBlank(win)) {
		saveBoards(emptyBoards());
		win.location.replace(resolve('/bretter'));
		win.focus();
		return true;
	}
	return !!openNamed(resolve('/bretter'), BOARDS_NAME);
}

// "Zur Brettübersicht" (Beobachten, player profile): the game goes on the
// next free board. 'shown' - the overview opened with it; 'added' - the
// overview is open already and takes it by itself (storage event), left as
// it is (position, enlarged board); 'full' - all boards taken; 'refused' -
// the browser blocked the window.
export function bringToBoards(
	gameId: number,
	isKnown?: (id: number) => boolean
): 'shown' | 'added' | 'full' | 'refused' {
	const win = window.open('', BOARDS_NAME, FEATURES);
	if (!win) return 'refused';
	const fresh = isBlank(win);
	const boards = addBoard(fresh ? emptyBoards() : loadBoards(), gameId, isKnown);
	if (!boards) return 'full'; // only an open overview can be full
	saveBoards(boards);
	if (!fresh) return 'added';
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
