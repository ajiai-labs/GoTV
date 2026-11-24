export const BOARD_RESIZE_MODES = ['fit', 'scroll'] as const;
type BoardResizeMode = (typeof BOARD_RESIZE_MODES)[number];

const STORAGE_KEY = 'gotv.gameBoardMode';

function load(): BoardResizeMode {
	try {
		if (localStorage.getItem(STORAGE_KEY) === 'fit') return 'fit';
	} catch {
		// Use the default when storage is unavailable.
	}
	return 'scroll';
}

class BoardResizeModeState {
	current = $state<BoardResizeMode>(load());

	set(mode: BoardResizeMode) {
		this.current = mode;
		try {
			localStorage.setItem(STORAGE_KEY, mode);
		} catch {
			// The choice still applies for the current session.
		}
	}
}

export const boardResizeMode = new BoardResizeModeState();
