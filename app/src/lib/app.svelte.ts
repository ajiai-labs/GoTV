// The running GoTV app: the store, the KGS connection and the actions of
// the old app (taken over unchanged in src/lib/model), wired to Svelte.
// Components read `app.state` (reactive) and call `app.actions.onX(...)`,
// exactly as the old React screens did with props.appState / props.actions.
//
// Navigation: the old app kept a "nav" (watch, tv, play, chat, search, more)
// in its state and pushed "/<nav>" to a history object. Here every nav has its
// own page; `history` below translates between the two, so AppActions stays
// as it was.
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';
import { AppActions } from './model/AppActions';
import { AppStore } from './model/AppStore';
import { KgsClient } from './model/KgsClient';
import { getInitialState, handleMessage } from './model/index';
import type { AppState, GameChannel, GameTree, KgsClientState, NavOption } from './model/types';
import { getMainLine } from './model/ReplayVariation';

// The page of each nav. "tv" is GoTV itself (Live); Kalender, Kanäle and
// Nachspielen belong to it as well.
export const NAV_PATHS: Record<NavOption, string> = {
	tv: '/',
	watch: '/beobachten',
	play: '/spielen',
	chat: '/chat',
	search: '/suche',
	more: '/konto'
};

const TV_PATHS = ['/', '/kalender', '/kanaele', '/nachspielen', '/einstellungen'];

// The route path of the current page without the base path ("/kalender").
export function currentPath(): string {
	const root = resolve('/');
	const path = page.url.pathname;
	const inside = path.startsWith(root) ? '/' + path.slice(root.length) : path;
	return inside.replace(/\.html$/, '').replace(/(.)\/+$/, '$1') || '/';
}

// The nav a page belongs to, or null (a page outside the old app's navs).
export function navForPath(path: string): NavOption | null {
	if (TV_PATHS.includes(path)) return 'tv';
	for (const [nav, navPath] of Object.entries(NAV_PATHS)) {
		if (navPath !== '/' && (path === navPath || path.startsWith(navPath + '/'))) {
			return nav as NavOption;
		}
	}
	return null;
}

function go(target: string, replaceState: boolean) {
	const nav = target.replace(/^\/+/, '') as NavOption;
	// Already on a page of that nav (e.g. Kalender for "tv"): stay there.
	if (navForPath(currentPath()) === (nav || 'tv')) return;
	const path = NAV_PATHS[nav] ?? '/';
	goto(resolve(path as '/'), { replaceState }).catch(() => {
		// navigation before the router is ready: the page syncs itself later
	});
}

// What AppActions expects from the "history" package.
const history = {
	get location() {
		return { pathname: '/' + (navForPath(currentPath()) ?? '') };
	},
	push: (path: string) => go(path, false),
	replace: (path: string) => go(path, true)
};

const LOGGED_OUT: KgsClientState = { status: 'loggedOut', network: 'online', retryTimes: 0 };

class GoTvApp {
	// The whole app state, replaced (never mutated) on every message.
	state: AppState = $state.raw(getInitialState(LOGGED_OUT));
	// "Lokal betrachten": a copy of a watched game for Nachspielen, taken at
	// one moment - later moves on KGS do not change it. `running`: the game
	// was still going on KGS, so KataGo stays off for this copy.
	localCopy: {
		tree: GameTree;
		gameId: number;
		running: boolean;
		move: number;
		serial: number;
	} | null = $state.raw(null);
	private localCopySerial = 0;
	store: AppStore | null = null;
	client: KgsClient | null = null;
	// Reactive, so pages waiting for the start (KgsGate) update once it ran.
	_actions: AppActions | null = $state.raw(null);

	get actions(): AppActions {
		if (!this._actions) throw new Error('GoTV app not started');
		return this._actions;
	}

	get started(): boolean {
		return this._actions !== null;
	}

	get loggedIn(): boolean {
		return !!this.state.currentUser;
	}

	// Called once from the layout, in the browser.
	start() {
		if (this._actions) return;
		const client = new KgsClient();
		const store = new AppStore(handleMessage, getInitialState(client.state));
		const actions = new AppActions(store, client, history);
		this.client = client;
		this.store = store;
		this._actions = actions;
		this.state = store.getState();

		store.subscribe(() => {
			this.state = store.getState();
		});
		client.setOnChange((clientState) => actions.onClientStateChange(clientState));
		client.setOnMessages(actions.onReceiveServerMessages);
		actions.onRestoreAppState();

		const save = () => actions.onSaveAppState();
		window.addEventListener('beforeunload', save);
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden') save();
		});
	}

	// Opens an SGF (tournament game, calendar entry, recent replay) on the
	// Nachspielen page - in the old app this switched the TV tab.
	openReplay(url: string) {
		const target = new URL(resolve('/nachspielen'), window.location.href);
		target.searchParams.set('sgf', url);
		// The path comes from resolve(); only the query is added.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(target.pathname + target.search).catch(() => {});
	}

	// "Nachspielen" after a KGS game ended (old onSuggestGameReplay): the
	// game's tree goes to the Nachspielen page. `kataGo`: "Mit KataGo
	// auswerten" (an own game) - KataGo starts switched on there, but only for
	// a game that is over: no help during a running game.
	suggestGameReplay(game: GameChannel, options: { kataGo?: boolean } = {}) {
		this.store?.dispatch({ type: 'TV_REPLAY_GAME', gameId: game.id });
		const target = new URL(resolve('/nachspielen'), window.location.href);
		if (options.kataGo && game.over) target.searchParams.set('katago', '1');
		// The path comes from resolve(); only the query is added.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(target.pathname + target.search).catch(() => {});
	}

	// "Lokal betrachten" (CGoban): the watched game as it stands now, on
	// Nachspielen at the current move - variations and bookmarks as usual,
	// KataGo only if the game is already over.
	openLocalCopy(game: GameChannel) {
		const tree = game.tree;
		if (!tree) return;
		const mainLine = getMainLine(tree);
		const index = tree.currentLine.indexOf(tree.currentNode);
		const move = index >= 0 ? index : mainLine.length - 1;
		this.localCopy = {
			tree,
			gameId: game.id,
			running: isRunningMatch(game),
			move,
			serial: ++this.localCopySerial
		};
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() gives the path
		goto(resolve('/nachspielen')).catch(() => {});
	}

	// "Zurück" on the Nachspielen board: forget the handed-over KGS game, so
	// Nachspielen opens with its lists again.
	closeReplay() {
		this.localCopy = null;
		const id = this.state.tvReplayGameId;
		this.store?.dispatch({ type: 'TV_REPLAY_GAME', gameId: null });
		// A game loaded from the archive only for Nachspielen: leave KGS's
		// review of it too.
		if (id != null && id === this.archiveReplayId) {
			this.archiveReplayId = null;
			this.actions.onLeaveGame(id);
		}
	}

	// A finished game from a KGS archive, loaded by KGS as a review
	// (UserGameSummary): opens on Nachspielen (KataGo, variations, bookmarks).
	archiveReplayId: number | null = null;
	openArchiveReplay(gameId: number) {
		const game = this.state.gamesById[gameId];
		if (!game) return;
		this.archiveReplayId = gameId;
		this.suggestGameReplay(game);
	}

	// Keep state.nav in line with the page shown (back/forward, links).
	syncNav(path: string) {
		const nav = navForPath(path);
		if (nav && this._actions && this.state.nav !== nav) {
			this._actions.onChangeNav(nav, { push: false });
		}
	}
}

// A game still being played (not over, not a review or demonstration):
// its local copy gets no KataGo.
function isRunningMatch(game: GameChannel): boolean {
	if (game.over) return false;
	return !['review', 'rengo_review', 'demonstration'].includes(game.type);
}

export const app = new GoTvApp();
