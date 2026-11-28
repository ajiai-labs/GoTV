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
import { DESKTOP_VERSION } from './desktopUpdate';

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
//
// - A window this one started loading a moment ago still reads about:blank:
//   it is not loaded a second time (fast double clicks).
// - The old window is closed only once the new one is there (a blocked
//   pop-up must not cost the open window).
// - The downloadable desktop apps (Tauri) do not replace windows: closing
//   from the page can leave an empty native window behind there (review
//   26.11.2026); a window that does not come forward is the smaller harm.
const loading = new Set<Window>();

function startLoading(win: Window, url: string) {
	loading.add(win);
	win.location.replace(url);
	win.focus();
	setTimeout(() => loading.delete(win), 5000);
}

function openNamed(url: string, name: string): Window | null {
	const win = window.open('', name, FEATURES);
	if (!win) return null;
	if (isBlank(win)) {
		if (!loading.has(win)) startLoading(win, url);
		return win;
	}
	if (DESKTOP_VERSION) {
		win.focus();
		return win;
	}
	const fresh = window.open(url, '_blank', FEATURES);
	if (!fresh) {
		win.focus();
		return win;
	}
	win.close();
	fresh.name = name;
	fresh.focus();
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

// The overview this window opened (or found open): the "Brettübersicht"
// button is only shown while it is open - an empty overview does not exist
// (user, 28.11.2026: it opens with the first board, goes with the last).
let boardsWindow: Window | null = null;

export function isBoardsWindowOpen(): boolean {
	return !!boardsWindow && !boardsWindow.closed;
}

// "Brettübersicht" button: bring the open overview to the front (closed and
// opened afresh, see openNamed - its boards stay). None open any more: the
// empty window the browser made is closed again at once.
export function openBoardsWindow(): boolean {
	const win = window.open('', BOARDS_NAME, FEATURES);
	if (!win) return false;
	if (isBlank(win) && !loading.has(win)) {
		win.close();
		boardsWindow = null;
		return true;
	}
	boardsWindow = openNamed(resolve('/bretter'), BOARDS_NAME);
	return !!boardsWindow;
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
	// Still loading from a click a moment ago counts as open (its boards).
	boardsWindow = win;
	const fresh = isBlank(win) && !loading.has(win);
	const boards = addBoard(fresh ? emptyBoards() : loadBoards(), gameId, isKnown);
	if (!boards) return 'full'; // only an open overview can be full
	saveBoards(boards);
	if (!fresh) return 'added';
	clearBoardsZoom(); // a new overview starts with all boards, none enlarged
	startLoading(win, resolve('/bretter'));
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

// The enlarged board of the Brettübersicht (routes/bretter) belongs to one
// overview; a new one starts with all boards.
export const BOARDS_ZOOM_KEY = 'gotv.teamView';

function clearBoardsZoom() {
	try {
		localStorage.removeItem(BOARDS_ZOOM_KEY);
	} catch {
		// nothing remembered without storage
	}
}
