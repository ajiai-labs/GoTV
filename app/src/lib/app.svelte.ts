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
import type { AppState, GameChannel, KgsClientState, NavOption } from './model/types';

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
		goto(`${resolve('/nachspielen')}?sgf=${encodeURIComponent(url)}`).catch(() => {});
	}

	// "Nachspielen" after a KGS game ended (old onSuggestGameReplay): the
	// game's tree goes to the Nachspielen page.
	suggestGameReplay(game: GameChannel) {
		this.store?.dispatch({ type: 'TV_REPLAY_GAME', gameId: game.id });
		goto(resolve('/nachspielen')).catch(() => {});
	}

	// Keep state.nav in line with the page shown (back/forward, links).
	syncNav(path: string) {
		const nav = navForPath(path);
		if (nav && this._actions && this.state.nav !== nav) {
			this._actions.onChangeNav(nav, { push: false });
		}
	}
}

export const app = new GoTvApp();
