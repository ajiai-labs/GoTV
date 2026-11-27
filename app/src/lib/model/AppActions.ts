import { AppStore } from './AppStore';
import { KgsClient } from './KgsClient';
import { tempId, isTempId } from './tempId';
import { prepareSavedAppState } from './appState';
import { isGamePlayer, isGamePlaying, isGameProposalPlayer, proposalsEqual } from './game';
import { playGameStart, playMessage } from '../sound/gameSounds';
import { isChatForMe, newChatAuthors } from './chatSound';
import { ChannelGuard, loadChannelGuardState, saveChannelGuardState } from './channelGuard';
import { activateMessage, canEditReview, reviewMoveMessage } from './game/review';
import { SOUNDS } from '../sound';
import { TvGameSubscriptions } from './TvGameSubscriptions';
import { DEFAULT_AUTOMATCH_PREFS, automatchMessage } from './automatch';

// How long after KGS ended the search a joined game still counts as found.
const AUTOMATCH_JOIN_GRACE_MS = 60000;
// After ROOM_LOAD_GAME: how long a GAME_JOIN counts as the loaded game.
const LOAD_JOIN_GRACE_MS = 30000;
// A review change KGS has not sent back after this long no longer blocks the next.
const REVIEW_PENDING_MS = 3000;
import type { FriendType } from './community';
import { loadNoChats } from './noChats';
import type {
	AutomatchPrefs,
	GameChannel,
	KgsClientState,
	GameFilter,
	GameProposal,
	GameRole,
	ProposalVisibility,
	NavOption,
	KgsMessage,
	User,
	UserDetails,
	Room,
	Point,
	PlayerColor
} from './types';
import { distinct } from '../util/collection';
// How long a game nobody shows stays joined (a window opened afresh).
const GAME_RELEASE_DELAY_MS = 3000;
const APP_STATE_SAVE_KEY = 'savedAppState';
export class AppActions {
	_store: AppStore;
	_client: KgsClient;
	_history: Record<string, any>;
	_tvGameSubscriptions: TvGameSubscriptions;
	// Channels KGS closed itself (UNJOIN/CLOSE). An UNJOIN_REQUEST for one of
	// them makes KGS log the user out ("Unknown channel N").
	_closedChannels = new Set<number>();
	_isClosedByServer = (channelId: unknown): boolean =>
		typeof channelId === 'number' && this._closedChannels.has(channelId);

	// When KGS ended a running automatch search on its own (it found a game),
	// 0 otherwise. The game itself may arrive in a later answer.
	_automatchEndedAt = 0;
	// When we last asked KGS to load a game from the archive (onLoadGame).
	_loadRequestedAt = 0;
	// When we last asked KGS to copy a game into a room (onCloneGame).
	_cloneRequestedAt = 0;

	// Every JOIN_REQUEST/UNJOIN_REQUEST passes this gate (channelGuard.ts).
	_channels = new ChannelGuard();

	constructor(store: AppStore, client: KgsClient, history: Record<string, any>) {
		this._store = store;
		this._client = client;
		this._history = history;
		// The gate sits on the client itself, so no part of GoTV goes around it.
		const send = client.sendMessage;
		client.sendMessage = (...args: Parameters<KgsClient['sendMessage']>) =>
			this._channels.allow(args[0]) ? send(...args) : Promise.resolve();
		// A state taken over from another window: the same KGS session goes on,
		// with what the gate knew there (closed channels, open requests).
		this._restoreChannels();
		// Stored after every change, once per turn of the event loop.
		let saving = false;
		this._channels.onChange = () => {
			if (saving) return;
			saving = true;
			queueMicrotask(() => {
				saving = false;
				saveChannelGuardState(this._channels.toJSON());
			});
		};
		this._tvGameSubscriptions = new TvGameSubscriptions(
			() => this._store.getState(),
			(message) => {
				if (message.type === 'UNJOIN_REQUEST' && this._isClosedByServer(message.channelId)) {
					return;
				}
				this._client.sendMessage(message);
			}
		);
	}

	_restoreChannels = () => {
		const joined = this._joinedChannels();
		if (this._store.getState().clientState.status === 'loggedIn') {
			this._channels.restore(loadChannelGuardState(), joined);
		} else {
			this._channels.reset(joined);
		}
	};

	_joinedChannels = (): Array<number> =>
		Object.keys(this._store.getState().channelMembership)
			.map(Number)
			.filter((id) => Number.isFinite(id));

	_isOffline = () => {
		const { status, network } = this._store.getState().clientState;

		return status === 'loggedOut' || network !== 'online';
	};
	onSaveAppState = () => {
		this._store.saveState(APP_STATE_SAVE_KEY, prepareSavedAppState);
	};
	onRestoreAppState = () => {
		this._store.restoreSavedState(APP_STATE_SAVE_KEY, (appState) => {
			this._client.setState(appState.clientState);
			// The same KGS session goes on (F5): the channels it is in and what
			// the gate knew before the reload.
			this._restoreChannels();

			this._store.dispatch({
				type: 'APP_STATE_INITIALIZED'
			});

			const clientStatus = appState.clientState.status;

			// TODO - if it's been longer than ~5 mins, log out
			if (clientStatus === 'loggedIn') {
				// Resume receive loop from previous session
				this._client.poll();
			} else if (clientStatus !== 'loggedOut') {
				// In transition; could be inconsistent - bail out
				this.onLogout();
			}
		});
	};
	onReceiveServerMessages = (msgs: Array<KgsMessage>) => {
		// KGS may switch the search off before it brings the game - in the same
		// batch or in an earlier answer (see _automatchEndedAt).
		const wasAutomatching =
			this._store.getState().automatchEnabled ||
			Date.now() - this._automatchEndedAt < AUTOMATCH_JOIN_GRACE_MS;
		for (const msg of Array.isArray(msgs) ? msgs : [msgs]) {
			this._channels.observe(msg);
			if (msg.type === 'GAME_UPDATE' && typeof msg.channelId === 'number') {
				this._reviewPending.delete(msg.channelId);
			}
			if (msg.type === 'LOGIN_SUCCESS' || msg.type === 'LOGOUT') this._endViewTimers();
			if (typeof msg.channelId !== 'number') continue;
			if (msg.type === 'UNJOIN' || msg.type === 'CLOSE') {
				this._closedChannels.add(msg.channelId);
			} else if (/_JOIN$/.test(msg.type)) {
				this._closedChannels.delete(msg.channelId);
			}
		}
		// The chat of my running game comes as comments of its moves: judged on
		// the state before the update (the game may end in the same answer).
		const before = this._store.getState();
		const chatForMe = (Array.isArray(msgs) ? msgs : [msgs]).some(
			(msg) =>
				msg.type === 'GAME_UPDATE' &&
				typeof msg.channelId === 'number' &&
				newChatAuthors(before.gamesById[msg.channelId], msg).some((from) =>
					isChatForMe(before, msg.channelId as number, from)
				)
		);
		// The game shown here became a review (GAME_REVIEW): it goes on on
		// Beobachten, like any review.
		const reviewed = (Array.isArray(msgs) ? msgs : [msgs]).some(
			(msg) =>
				msg.type === 'GAME_REVIEW' &&
				(before.playGameId === msg.originalId || before.watchGameId === msg.originalId)
		);
		this._store.dispatch(msgs);
		if (chatForMe) playMessage();
		if (reviewed) this.onChangeNav('watch');
		if (this._store.getState().automatchEnabled) {
			this._automatchEndedAt = 0;
		} else if (wasAutomatching && !this._automatchEndedAt) {
			this._automatchEndedAt = Date.now();
		}

		// Follow-up actions we know we need to take, even without user interaction
		msgs = Array.isArray(msgs) ? msgs : [msgs];

		// KGS confirmed an unjoin (e.g. of a window that was replaced) while a
		// window still shows the game: join it again for that window.
		for (const msg of msgs) {
			if (msg.type === 'UNJOIN' && typeof msg.channelId === 'number') {
				if (this._gameViews.has(msg.channelId)) this._joinForViews(msg.channelId);
			}
		}

		for (const msg of msgs) {
			if (msg.type === 'LOGIN_SUCCESS') {
				this.onLoginSuccess();
			} else if (
				msg.type === 'CONVO_JOIN' &&
				msg.channelId &&
				!msg.callbackKey &&
				!isTempId(msg.channelId) &&
				loadNoChats()
			) {
				// Someone else opened a private chat while "Keine Unterhaltungen" is on.
				this.onDeclineConversation(msg.channelId, msg.user?.name);
			} else if (msg.type === 'CHALLENGE_FINAL' && msg.channelId) {
				this.onChallengeFinalized(msg.proposal, msg.channelId, msg.gameChannelId);
			} else if (msg.type === 'CHALLENGE_PROPOSAL' && msg.channelId) {
				this.onReceiveChallengeProposal(msg.channelId, msg.proposal);
			} else if (msg.type === 'CHALLENGE_SUBMIT' && msg.channelId) {
				this.onReceiveChallengeSubmit(msg.channelId);
			} else if (msg.type === 'CHAT' && msg.channelId && msg.user) {
				this.onReceiveChat(msg.channelId, msg.user.name);
			} else if (msg.type === 'ARCHIVE_JOIN' && msg.channelId) {
				this.onArchiveJoinSuccess(msg.channelId, msg.user);
			} else if (msg.type === 'GLOBAL_GAMES_JOIN' || msg.type === 'GAME_LIST') {
				this.onCheckRoomNames(msg.games);
			} else if (msg.type === 'GAME_TIME_EXPIRED' && msg.channelId) {
				this.onGameTimeExpired(msg.channelId);
			} else if (msg.type === 'GAME_JOIN' && msg.channelId && wasAutomatching) {
				this.onAutomatchGameJoined(msg.channelId);
			} else if (
				msg.type === 'GAME_JOIN' &&
				msg.channelId &&
				Date.now() - this._loadRequestedAt < LOAD_JOIN_GRACE_MS
			) {
				this.onLoadedGameJoined(msg.channelId);
			} else if (
				msg.type === 'GAME_JOIN' &&
				msg.channelId &&
				Date.now() - this._cloneRequestedAt < LOAD_JOIN_GRACE_MS
			) {
				this.onClonedGameJoined(msg.channelId);
			}
		}
	};
	onLogin = (username: string | null | undefined, password: string | null | undefined) => {
		if (!username || !password) {
			this._store.dispatch({
				type: 'LOGIN_FAILED_MISSING_INFO'
			});

			return;
		}

		this._store.dispatch({
			type: 'LOGIN_START'
		});

		this._client.login(username, password);
	};
	onLoginSuccess = () => {
		const state = this._store.getState();

		// Make sure URL is sync'd with state
		this._history.replace('/' + state.nav);

		// Auto-join game lists
		this._client.sendMessage({
			type: 'GLOBAL_LIST_JOIN_REQUEST',
			list: 'ACTIVES'
		});

		this._client.sendMessage({
			type: 'GLOBAL_LIST_JOIN_REQUEST',
			list: 'CHALLENGES'
		});

		// Get own recent games list (mainly useful for showing unfinished games)
		if (state.currentUser) {
			this._client.sendMessage({
				type: 'JOIN_ARCHIVE_REQUEST',
				name: state.currentUser.name
			});
		}
	};
	onShowUnderConstruction = () => {
		this._store.dispatch({
			type: 'SHOW_UNDER_CONSTRUCTION'
		});
	};
	onHideUnderConstruction = () => {
		this._store.dispatch({
			type: 'HIDE_UNDER_CONSTRUCTION'
		});
	};
	onLogout = () => {
		this._history.push('/');

		this._store.dispatch({
			type: 'LOGOUT_START'
		});

		setTimeout(() => {
			this.onSaveAppState();
		}, 0);

		if (this._store.getState().clientState.status !== 'loggedOut') {
			this._client.logout();
		}
	};
	onChangeNav = (
		nav: NavOption,
		opts: {
			push?: boolean;
		} = {
			push: true
		}
	) => {
		if (opts.push && nav !== this._history.location.pathname.slice(1)) {
			this._history.push('/' + nav);
		}

		const state = this._store.getState();

		if (state.nav !== nav) {
			this._store.dispatch({
				type: 'NAV_CHANGE',
				nav
			});
		} else if (nav === 'watch') {
			if (typeof state.watchGameId === 'number') {
				this.onLeaveGame(state.watchGameId);
			}
		}
	};
	onJoinGame = (gameId: number | string) => {
		const state = this._store.getState();

		const { currentUser } = state;

		if (!currentUser) {
			return;
		}

		if (typeof state.watchGameId === 'number' && state.watchGameId !== gameId) {
			this.onLeaveGame(state.watchGameId);
		}

		if (gameId === state.playGameId) {
			// Already playing this game
			this.onChangeNav('play');
			return;
		}

		let players;
		// Only a game that is played is "ours" to play on Spielen; a review of
		// an own game (loaded from the archive) is shown like any other
		// (27.11.2026: it opened Spielen instead of the review).
		let played = false;

		if (typeof gameId === 'number') {
			const game = state.gamesById[gameId];
			players = game.players;
			played = isGamePlaying(game);
		} else {
			const gameSummaries = state.gameSummariesByUser[currentUser.name];
			const gameSummary = gameSummaries ? gameSummaries.find((g) => g.timestamp === gameId) : null;

			if (gameSummary) {
				players = gameSummary.players;
				played = !gameSummary.score && !String(gameSummary.type).includes('review');
			}
		}

		let joinType;

		if (players && played && isGamePlayer(currentUser.name, players)) {
			// Left game; rejoin
			joinType = 'PLAY_GAME';
			this.onChangeNav('play');
		} else {
			joinType = 'WATCH_GAME';
			this.onChangeNav('watch');
		}

		if (typeof gameId === 'number') {
			// By channel id
			this._store.dispatch([
				{
					type: 'GAME_JOIN',
					channelId: gameId
				},
				{
					type: joinType,
					gameId
				}
			]);

			if (!this._isOffline()) {
				this._client.sendMessage({
					type: 'JOIN_REQUEST',
					channelId: gameId
				});
			}
		} else {
			// By timestamp
			this._store.dispatch([
				{
					type: joinType,
					gameId
				}
			]);

			if (!this._isOffline()) {
				this._client.sendMessage({
					type: 'JOIN_GAME_BY_ID',
					timestamp: gameId
				});
			}
		}
	};
	// The game moved to its own window: this window stops showing it, but
	// stays joined (the game window needs the channel).
	onShowGameElsewhere = (gameId: number) => {
		const state = this._store.getState();
		const msgs: Array<KgsMessage> = [];
		if (state.playGameId === gameId) msgs.push({ type: 'PLAY_GAME', gameId: null });
		if (state.watchGameId === gameId) msgs.push({ type: 'WATCH_GAME', gameId: null });
		if (msgs.length) this._store.dispatch(msgs);
	};
	// Games shown in other windows (a game window, the Brettübersicht -
	// windowLink.ts): each view registers here. KGS gets a join only once and
	// an unjoin only when no view needs the game any more - KGS ends the whole
	// connection ("Unknown channel") on a request for a channel it does not
	// know, so nothing is sent for a removed game or a channel we are not in.
	_gameViews = new Map<number, Set<string>>();
	_releaseTimers = new Map<number, ReturnType<typeof setTimeout>>();

	onViewGame = (gameId: number, viewId: string) => {
		const views = this._gameViews.get(gameId) ?? new Set<string>();
		views.add(viewId);
		this._gameViews.set(gameId, views);
		clearTimeout(this._releaseTimers.get(gameId));
		this._releaseTimers.delete(gameId);
		this._joinForViews(gameId);
	};

	onUnviewGame = (gameId: number, viewId: string) => {
		const views = this._gameViews.get(gameId);
		if (!views) return;
		views.delete(viewId);
		if (views.size) return;
		this._gameViews.delete(gameId);
		// A window that is replaced (closed and opened afresh) registers again
		// a moment later; only then let go.
		clearTimeout(this._releaseTimers.get(gameId));
		this._releaseTimers.set(
			gameId,
			setTimeout(() => {
				this._releaseTimers.delete(gameId);
				if (!this._gameViews.has(gameId)) this._releaseGame(gameId);
			}, GAME_RELEASE_DELAY_MS)
		);
	};

	// A new session (login, logout): no timer of the old one may unjoin a
	// channel id of the new one.
	_endViewTimers = () => {
		for (const timer of this._releaseTimers.values()) clearTimeout(timer);
		this._releaseTimers.clear();
	};

	_isGameViewed = (gameId: number): boolean =>
		this._gameViews.has(gameId) || this._releaseTimers.has(gameId);

	_joinForViews = (gameId: number) => {
		const state = this._store.getState();
		const game = state.gamesById[gameId];
		if (!game || game.deletedTime || state.channelMembership[gameId] || this._isOffline()) return;
		// Only a game KGS still lists: a finished game whose channel is gone
		// would make KGS log us out. Its last position stays on the board.
		if (!state.activeGames.some((listed) => listed.id === gameId)) return;
		if (!this._channels.canJoin(gameId)) return;
		this._store.dispatch({ type: 'GAME_JOIN', channelId: gameId });
		this._client.sendMessage({ type: 'JOIN_REQUEST', channelId: gameId });
	};

	// Unjoin a game nobody shows any more: not the game this window shows,
	// not an own running game, and only a channel we are in.
	_releaseGame = (gameId: number) => {
		const state = this._store.getState();
		if (state.watchGameId === gameId || state.playGameId === gameId) return;
		if (!state.channelMembership[gameId]) return;
		const me = state.currentUser?.name;
		const game = state.gamesById[gameId];
		if (game && me && isGamePlayer(me, game.players) && isGamePlaying(game)) return;
		this.onUnjoin(gameId);
	};
	// `explicit`: the user confirmed leaving (own game) - not held back by
	// other windows that show the game.
	onLeaveGame = (game: GameChannel | number, options: { explicit?: boolean } = {}) => {
		const gameId = typeof game === 'number' ? game : game.id;

		const state = this._store.getState();

		const msgs = [];

		if (state.playGameId === gameId) {
			msgs.push({
				type: 'PLAY_GAME',
				gameId: null
			});
		}

		if (state.watchGameId === gameId) {
			msgs.push({
				type: 'WATCH_GAME',
				gameId: null
			});
		}

		if (msgs.length) {
			this._store.dispatch(msgs);
		}

		// Still shown in another window: stay joined there. Not joined at all
		// (neither a member nor shown here): nothing to leave.
		if (this._isGameViewed(gameId) && !options.explicit) return;
		const shownHere = state.watchGameId === gameId || state.playGameId === gameId;
		if (!state.channelMembership[gameId] && !shownHere) return;
		this.onUnjoin(gameId);
	};
	onSelectChallenge = (challengeId: number) => {
		if (this._isOffline()) {
			return;
		}

		const state = this._store.getState();

		const challenge: GameChannel | null | undefined = state.gamesById[challengeId];
		const proposal: GameProposal | null | undefined = challenge && challenge.initialProposal;

		if (proposal && (proposal.gameType === 'rengo' || proposal.gameType === 'simul')) {
			this.onShowUnderConstruction();
			return;
		}

		this._store.dispatch({
			type: 'PLAY_CHALLENGE',
			challengeId
		});

		this._client.sendMessage({
			type: 'JOIN_REQUEST',
			channelId: challengeId
		});
	};
	onCloseChallenge = (challengeId: number) => {
		this._store.dispatch({
			type: 'CLOSE_CHALLENGE',
			channelId: challengeId
		});

		this.onUnjoin(challengeId);
	};
	onSubmitChallengeProposal = (challengeId: number, proposal: GameProposal) => {
		this._store.dispatch({
			type: 'START_CHALLENGE_SUBMIT',
			channelId: challengeId,
			proposal
		});

		this._client.sendMessage({ ...proposal, type: 'CHALLENGE_SUBMIT', channelId: challengeId });
	};
	onCreateChallenge = (
		proposal: GameProposal,
		roomId: number,
		visibility: ProposalVisibility,
		notes?: string
	) => {
		this._store.dispatch({
			type: 'UPDATE_PREFERENCES',
			preferences: {
				lastProposal: {
					proposal,
					visibility,
					notes
				}
			}
		});

		const finalProposal = { ...proposal, private: visibility === 'private' };

		this._client.sendMessage({
			type: 'CHALLENGE_CREATE',
			proposal: finalProposal,
			channelId: roomId,
			text: notes,
			global: visibility === 'public',
			callbackKey: 12345 // Note - we don't use this
		});
	};
	onAcceptChallengeProposal = (challengeId: number, proposal: GameProposal) => {
		// Users must be name-only
		const normProposal = {
			...proposal,
			players: proposal.players.map((p) => {
				p = { ...p, name: p.user ? p.user.name : p.name };
				delete p.user;
				return p;
			})
		};

		this._client.sendMessage({
			...normProposal,
			type: 'CHALLENGE_PROPOSAL',
			channelId: challengeId
		});
	};
	// We accept the changed terms the creator sent back (counterProposal).
	onAcceptCounterProposal = (challengeId: number) => {
		const challenge = this._store.getState().gamesById[challengeId];
		const counter = challenge && challenge.counterProposal;
		if (!counter) return;
		// Users must be name-only
		const normProposal = {
			...counter,
			players: counter.players.map((p) => {
				p = { ...p, name: p.user ? p.user.name : p.name };
				delete p.user;
				return p;
			})
		};
		this._store.dispatch({
			type: 'START_CHALLENGE_SUBMIT',
			channelId: challengeId,
			proposal: counter
		});
		this._client.sendMessage({ ...normProposal, type: 'CHALLENGE_ACCEPT', channelId: challengeId });
	};
	onDeclineChallengeProposal = (challengeId: number, name: string) => {
		this._store.dispatch({
			type: 'START_CHALLENGE_DECLINE',
			channelId: challengeId,
			name
		});

		this._client.sendMessage({
			type: 'CHALLENGE_DECLINE',
			name,
			channelId: challengeId
		});
	};
	onChallengeFinalized = (proposal: GameProposal, challengeId: number, gameId: number) => {
		const state = this._store.getState();

		const currentUser = state.currentUser;
		const name = currentUser && currentUser.name;
		const isPlayer = name && isGameProposalPlayer(name, proposal);

		if (isPlayer) {
			playGameStart();
		} else {
			// Challenge accepted by someone else: leave only that challenge -
			// never other games (an own running game in its window, watched ones).
			this.onChangeNav('watch');
			if (challengeId !== gameId && state.channelMembership[challengeId]) {
				this.onUnjoin(challengeId);
			}
		}
	};
	onReceiveChallengeProposal = (challengeId: number, proposal: GameProposal) => {
		if (!proposal) {
			this.onCloseChallenge(challengeId);
			return;
		}

		const state = this._store.getState();

		const challenge = state.gamesById[challengeId];
		const sentProposal = challenge && challenge.sentProposal;

		if (sentProposal) {
			const acceptable = proposalsEqual(sentProposal, proposal);

			if (acceptable) {
				this._client.sendMessage({
					...sentProposal,
					type: 'CHALLENGE_ACCEPT',
					channelId: challengeId
				});
			} else {
				// The creator changed the terms: show them, the user accepts
				// (onAcceptCounterProposal) or declines (onCloseChallenge).
				this._store.dispatch({ type: 'CHALLENGE_COUNTER', channelId: challengeId, proposal });
				SOUNDS.CHALLENGE_PROPOSAL_RECEIVED.play();
			}
		} else {
			// TODO - received a revised proposal when we didn't submit a challenge.
			// Is there anything for us to do here?
		}
	};
	onReceiveChallengeSubmit = (challengeId: number) => {
		const { playChallengeId } = this._store.getState();

		if (playChallengeId === challengeId) {
			// Received a challenge proposal submission
			SOUNDS.CHALLENGE_PROPOSAL_RECEIVED.play();
		}
	};
	// A private message or the opponent's chat in my running game.
	onReceiveChat = (channelId: number, from: string) => {
		if (isChatForMe(this._store.getState(), channelId, from)) {
			playMessage();
		}
	};
	onShowGames = (filter: GameFilter) => {
		let msgs;

		const state = this._store.getState();

		if (filter.type === 'challenge') {
			this.onChangeNav('play');
			msgs = [
				{
					type: 'PLAY_FILTER_CHANGE',
					filter
				}
			];

			if (state.playGameId) {
				this.onLeaveGame(state.playGameId);
			}
		} else {
			this.onChangeNav('watch');
			msgs = [
				{
					type: 'WATCH_FILTER_CHANGE',
					filter
				}
			];

			if (typeof state.watchGameId === 'number') {
				this.onLeaveGame(state.watchGameId);
			}
		}

		this._store.dispatch(msgs);
	};
	onLoadGame = (timestamp: string, channelId: number, privateGame: boolean) => {
		this._loadRequestedAt = Date.now();
		this._store.dispatch({ type: 'LOAD_GAME_START' });
		this._client.sendMessage({
			type: 'ROOM_LOAD_GAME',
			channelId,
			private: privateGame,
			timestamp
		});
	};
	// "Spiel kopieren in …" (CGoban): KGS copies the game into a room as a
	// review we own; it opens on Beobachten when KGS brings it.
	onCloneGame = (roomId: number, gameId: number) => {
		if (this._isOffline()) return;
		this._cloneRequestedAt = Date.now();
		this._client.sendMessage({
			type: 'ROOM_CLONE_GAME',
			channelId: roomId,
			gameChannelId: gameId
		});
	};
	onClonedGameJoined = (gameId: number) => {
		const state = this._store.getState();
		const game = state.gamesById[gameId];
		if (!game || (game.type !== 'review' && game.type !== 'rengo_review')) return;
		this._cloneRequestedAt = 0;
		if (typeof state.watchGameId === 'number' && state.watchGameId !== gameId) {
			this.onLeaveGame(state.watchGameId);
		}
		this._store.dispatch({ type: 'WATCH_GAME', gameId });
		this.onChangeNav('watch');
	};
	onUserDetail = (name: string) => {
		if (this._isOffline()) {
			return;
		}

		this._store.dispatch({
			type: 'START_USER_DETAILS',
			name
		});

		this._client.sendMessage({
			type: 'DETAILS_JOIN_REQUEST',
			name
		});

		this._client.sendMessage({
			type: 'JOIN_ARCHIVE_REQUEST',
			name
		});
	};
	onCloseUserDetail = () => {
		const { userDetailsRequest, usersByName } = this._store.getState();

		if (userDetailsRequest) {
			const user = usersByName[userDetailsRequest.name];

			if (user && user.details) {
				this.onUnjoin(user.details.channelId);
			}
		}

		this._store.dispatch({
			type: 'CLOSE_USER_DETAILS'
		});
	};
	onRequestRankGraph = (channelId: number) => {
		this._client.sendMessage({
			type: 'DETAILS_RANK_GRAPH_REQUEST',
			channelId
		});
	};
	onSelectConversation = (conversationId: number) => {
		const msgs = [
			{
				type: 'SAW_CONVERSATION',
				conversationId
			},
			{
				type: 'CONVERSATION_CHANGE',
				conversationId
			}
		];

		const activeConvId = this._store.getState().activeConversationId;

		if (activeConvId) {
			msgs.push({
				type: 'SAW_CONVERSATION',
				conversationId: activeConvId
			});
		}

		this._store.dispatch(msgs);
	};
	markConversationSeen = (conversationId: number) => {
		this._store.dispatch({
			type: 'SAW_CONVERSATION',
			conversationId
		});
	};
	// Tells KGS we do not want chats in this conversation (the other side
	// sees CONVO_NO_CHATS) and closes it. `name`: shown in a short notice.
	onDeclineConversation = (conversationId: number, name?: string) => {
		if (this._isOffline()) return;
		if (!isTempId(conversationId)) {
			this._client.sendMessage({ type: 'CONVO_NO_CHATS', channelId: conversationId });
		}
		if (name) this._store.dispatch({ type: 'CHAT_DECLINED', name });
		this.onCloseConversation(conversationId);
	};
	onCloseConversation = (conversationId: number) => {
		if (this._isOffline()) {
			return;
		}

		this._store.dispatch({
			type: 'CLOSE_CONVERSATION',
			conversationId
		});

		if (!isTempId(conversationId)) {
			this.onUnjoin(conversationId);
		}
	};
	onStartChat = (user: User) => {
		if (this._isOffline()) {
			return;
		}

		this.onChangeNav('chat');

		const { conversationsById } = this._store.getState();

		const userConvo = Object.keys(conversationsById).find(
			(cid) => conversationsById[cid].user === user.name
		);

		if (userConvo) {
			this.onSelectConversation(parseInt(userConvo, 10));
			return;
		}

		const channelId = tempId();
		const callbackKey = tempId();

		this._store.dispatch({
			type: 'CONVO_JOIN',
			user,
			channelId,
			callbackKey,
			joinNow: true
		});

		this._client.sendMessage({
			type: 'CONVO_REQUEST',
			name: user.name,
			callbackKey
		});
	};
	onSendChat = (body: string, conversationId: number) => {
		if (this._isOffline()) {
			return;
		}

		// Temp message to show until next payload received
		this._store.dispatch({
			type: 'CHAT',
			sending: true,
			text: body,
			channelId: conversationId,
			user: this._store.getState().currentUser
		});

		this._client.sendMessage({
			type: 'CHAT',
			text: body,
			channelId: conversationId
		});
	};
	onSendGameChat = (body: string, gameId: number) => {
		if (this._isOffline()) {
			return;
		}

		this._client.sendMessage({
			type: 'CHAT',
			text: body,
			channelId: gameId
		});
	};
	onJoinRoom = (room: Room) => {
		if (this._isOffline()) {
			return;
		}

		this._store.dispatch([
			{
				type: 'ROOM_JOIN',
				channelId: room.id
			},
			{
				type: 'CONVERSATION_CHANGE',
				conversationId: room.id
			}
		]);

		this._client.sendMessage({
			type: 'JOIN_REQUEST',
			channelId: room.id
		});

		this._client.sendMessage({
			type: 'ROOM_DESC_REQUEST',
			channelId: room.id
		});
	};
	onFetchRoomList = () => {
		const roomsById = this._store.getState().roomsById;

		// Only fetch rooms whose name we don't know yet
		const roomIds = distinct(
			Object.keys(roomsById).filter((id) => typeof roomsById[id].name !== 'string')
		);

		if (roomIds.length) {
			this._client.sendMessage({
				type: 'ROOM_NAMES_REQUEST',
				rooms: roomIds
			});
		}
	};
	onCheckRoomNames = (games: Array<GameChannel>) => {
		if (this._isOffline()) {
			return;
		}

		const state = this._store.getState();

		// Room names we don't have yet
		const roomsById = state.roomsById;
		const roomIds = distinct(
			games
				.filter(
					(g) => g.roomId && (!roomsById[g.roomId] || typeof roomsById[g.roomId].name !== 'string')
				)
				.map((g) => g.roomId)
		);

		if (roomIds.length) {
			this._client.sendMessage({
				type: 'ROOM_NAMES_REQUEST',
				rooms: roomIds
			});
		}
	};
	onArchiveJoinSuccess = (channelId: number, user: User) => {
		const state = this._store.getState();

		const { currentUser } = state;

		if (currentUser && currentUser.name === user.name) {
			// Stay subscribed to own archive, for unfinished games list
			return;
		}

		// Immediately unjoin - don't care about live updates for anyone else
		this.onUnjoin(channelId);
	};
	onUnjoin = (channelId: number) => {
		if (this._isOffline() || this._isClosedByServer(channelId)) {
			return;
		}

		this._client.sendMessage({
			type: 'UNJOIN_REQUEST',
			channelId
		});
	};
	onObserveTvGame = (gameId: number): (() => void) => {
		return this._tvGameSubscriptions.observe(gameId);
	};
	onClientStateChange = (clientState: KgsClientState) => {
		this._store.dispatch({
			type: 'CLIENT_STATE_CHANGE',
			clientState
		});

		this._tvGameSubscriptions.sync();
	};
	onChangeCurrentNode = (game: GameChannel, nodeId: number) => {
		this._store.dispatch({
			type: 'SET_CURRENT_GAME_NODE',
			currentNode: nodeId,
			channelId: game.id
		});
	};
	// Editing a KGS review we hold the control of (model/game/review.ts).
	// One change at a time: the next only after KGS sent the last one back
	// (GAME_UPDATE), or after REVIEW_PENDING_MS without an answer.
	_reviewPending = new Map<number, number>();

	_sendReviewChange = (game: GameChannel, message: KgsMessage): boolean => {
		const since = this._reviewPending.get(game.id);
		if (since !== undefined && Date.now() - since < REVIEW_PENDING_MS) return false;
		if (this._isOffline() || !this._store.getState().channelMembership[game.id]) return false;
		this._reviewPending.set(game.id, Date.now());
		this._client.sendMessage(message).catch(() => this._reviewPending.delete(game.id));
		return true;
	};
	// A click on the board of a review: the move for everyone, or a hint why
	// not (taken point, suicide, ko - as on Nachspielen).
	onReviewMove = (game: GameChannel, loc: Point): 'occupied' | 'suicide' | 'ko' | null => {
		const tree = game.tree;
		const me = this._store.getState().currentUser?.name ?? '';
		if (!tree || !canEditReview(game, me)) return null;
		const result = reviewMoveMessage(game, tree, tree.currentNode, loc);
		if (!result.ok) return result.error;
		this._sendReviewChange(game, result.message);
		return null;
	};
	// "Mit Gegner besprechen" after an own game (CGoban): KGS turns the game
	// into a review in a new channel and moves both players there
	// (GAME_REVIEW, handled in the reducer).
	onStartReview = (game: GameChannel) => {
		const state = this._store.getState();
		const me = state.currentUser?.name;
		if (!me || !game.over || !isGamePlayer(me, game.players)) return;
		if (this._isOffline() || !state.channelMembership[game.id]) return;
		this._client.sendMessage({ type: 'GAME_START_REVIEW', channelId: game.id });
	};
	// Moving through a review we control moves everyone's board.
	onReviewGoTo = (game: GameChannel, nodeId: number) => {
		const tree = game.tree;
		const me = this._store.getState().currentUser?.name ?? '';
		if (!tree || !canEditReview(game, me) || nodeId === tree.activeNode) {
			this.onChangeCurrentNode(game, nodeId);
			return;
		}
		this.onChangeCurrentNode(game, nodeId);
		this._sendReviewChange(game, activateMessage(game, tree, nodeId));
	};
	onPlayMove = (game: GameChannel, loc: Point, color: PlayerColor | null | undefined) => {
		if (color) {
			this._store.dispatch({
				type: 'START_GAME_MOVE',
				channelId: game.id,
				loc,
				color
			});
		}

		// A move that did not reach KGS must not stay on the board as if it
		// had: the stone goes, and the game screen says so (review 27.11.2026).
		this._client
			.sendMessage({
				type: 'GAME_MOVE',
				channelId: game.id,
				loc
			})
			.catch(() => {
				this._store.dispatch({ type: 'GAME_MOVE_FAILED', channelId: game.id });
			});
	};
	onMarkLife = (game: GameChannel, loc: Point, alive: boolean) => {
		this._client.sendMessage({
			type: 'GAME_MARK_LIFE',
			channelId: game.id,
			x: loc.x,
			y: loc.y,
			alive
		});
	};
	onPass = (game: GameChannel) => {
		this._client.sendMessage({
			type: 'GAME_MOVE',
			channelId: game.id,
			loc: 'PASS'
		});
	};
	onUndo = (game: GameChannel) => {
		this._client.sendMessage({
			type: 'GAME_UNDO_REQUEST',
			channelId: game.id
		});
	};
	onResign = (game: GameChannel) => {
		this._client.sendMessage({
			type: 'GAME_RESIGN',
			channelId: game.id
		});
	};
	onAddGameTime = (game: GameChannel, role: GameRole, seconds: number) => {
		this._client.sendMessage({
			type: 'GAME_ADD_TIME',
			channelId: game.id,
			time: seconds,
			role
		});
	};
	onDoneScoring = (game: GameChannel) => {
		this._client.sendMessage({
			type: 'GAME_SCORING_DONE',
			channelId: game.id,
			doneId: game.doneId
		});
	};
	onAcceptUndo = (game: GameChannel) => {
		this._client.sendMessage({
			type: 'GAME_UNDO_ACCEPT',
			channelId: game.id
		});
	};
	onDeclineUndo = (game: GameChannel) => {
		this._store.dispatch({
			type: 'GAME_UNDO_DECLINE',
			channelId: game.id
		});
	};
	onGameTimeExpired = (gameId: number) => {
		this._client.sendMessage({
			type: 'GAME_TIME_EXPIRED',
			channelId: gameId
		});
	};
	onUpdateProfileDetails = (user: User, details: UserDetails) => {
		if (this._isOffline()) {
			return;
		}

		this._client.sendMessage({
			type: 'DETAILS_CHANGE',
			channelId: details.channelId,
			personalName: details.personalName,
			personalEmail: details.email,
			personalInfo: details.personalInfo,
			emailWanted: details.emailWanted,
			privateEmail: details.privateEmail,
			rankWanted: details.rankWanted,
			authLevel: user.authLevel || 'normal'
		});

		// Force a refresh, since changing rankWanted doesn't get reflected in
		// DETAILS_UPDATE response
		this.onUnjoin(details.channelId);
		setTimeout(() => {
			// If we do it right away it doesn't always work
			this._client.sendMessage({
				type: 'DETAILS_JOIN_REQUEST',
				name: user.name
			});
		}, 200);
	};
	onUpdatePassword = (user: User, newPassword: string) => {
		if (this._isOffline()) {
			return;
		}

		this._client.sendMessage({
			type: 'SET_PASSWORD',
			user: user.name,
			password: newPassword
		});
	};
	// Friend lists (CGoban "Benutzer" menu): Freunde = buddy, Ignorierliste
	// = censored, Fanliste = fan. KGS answers FRIEND_ADD/REMOVE_SUCCESS.
	onAddFriend = (friendType: FriendType, name: string, notes = '') => {
		if (this._isOffline() || !name.trim()) return;
		this._client.sendMessage({
			type: 'FRIEND_ADD',
			friendType,
			name: name.trim(),
			text: notes.trim().slice(0, 50)
		});
	};
	onRemoveFriend = (friendType: FriendType, name: string) => {
		if (this._isOffline()) return;
		this._client.sendMessage({ type: 'FRIEND_REMOVE', friendType, name });
	};
	// "Nachricht hinterlassen": KGS keeps it for the player's next login.
	onLeaveMessage = (name: string, text: string) => {
		if (this._isOffline() || !name.trim() || !text.trim()) return;
		this._store.dispatch({ type: 'COMMUNITY_RESULT_CLEAR' });
		this._client.sendMessage({
			type: 'MESSAGE_CREATE',
			name: name.trim(),
			text: text.trim().slice(0, 1000)
		});
	};
	// Deletes the messages left for us (all of them, as read).
	onDeleteMailbox = () => {
		if (this._isOffline()) return;
		this._client.sendMessage({ type: 'MESSAGE_DELETE' });
		this._store.dispatch({ type: 'MAILBOX_CLEAR' });
	};
	onRequestServerStats = () => {
		if (this._isOffline()) return;
		this._client.sendMessage({ type: 'REQUEST_SERVER_STATS' });
	};
	// "Neuen Raum erstellen": non-admins may only create temporary rooms.
	onCreateRoom = (name: string, description: string, privateRoom: boolean) => {
		if (this._isOffline() || !name.trim()) return;
		this._store.dispatch({ type: 'COMMUNITY_RESULT_CLEAR' });
		this._client.sendMessage({
			type: 'CREATE_ROOM_REQUEST',
			name: name.trim().slice(0, 50),
			description: description.trim().slice(0, 1000),
			category: 'TEMPORARY',
			locale: '',
			private: privateRoom,
			tournOnly: false,
			globalOnly: false
		});
	};
	onClearCommunityResult = () => {
		this._store.dispatch({ type: 'COMMUNITY_RESULT_CLEAR' });
	};
	onShowFeedbackModal = () => {
		this._store.dispatch({
			type: 'SHOW_FEEDBACK_MODAL'
		});
	};
	onHideFeedbackModal = () => {
		this._store.dispatch({
			type: 'HIDE_FEEDBACK_MODAL'
		});
	};
	onOpenTvStream = (url: string) => {
		this._store.dispatch({
			type: 'TV_OPEN_STREAM',
			url
		});

		this.onChangeNav('tv');
	};
	onCloseTvStream = () => {
		this._store.dispatch({
			type: 'TV_CLOSE_STREAM'
		});
	};
	onSuggestGameReplay = (game: GameChannel) => {
		this._store.dispatch({
			type: 'TV_REPLAY_GAME',
			gameId: game.id
		});

		this.onChangeNav('tv');
	};
	// Automatic opponent selection (see ./automatch.ts).
	onSetAutomatchPrefs = (prefs: AutomatchPrefs) => {
		this._client.sendMessage(automatchMessage('AUTOMATCH_SET_PREFS', prefs) as KgsMessage);
		this._store.dispatch({ ...prefs, type: 'AUTOMATCH_PREFS' });
	};
	onStartAutomatch = () => {
		const prefs = this._store.getState().automatchPrefs || DEFAULT_AUTOMATCH_PREFS;
		this._client.sendMessage(automatchMessage('AUTOMATCH_CREATE', prefs) as KgsMessage);
		// Shown right away; KGS confirms or corrects with AUTOMATCH_STATUS.
		this._store.dispatch({ type: 'AUTOMATCH_STATUS', enabled: true });
	};
	onCancelAutomatch = () => {
		this._automatchEndedAt = 0; // cancelled by the user: no game is coming
		this._client.sendMessage({ type: 'AUTOMATCH_CANCEL' });
		this._store.dispatch({ type: 'AUTOMATCH_STATUS', enabled: false });
	};
	// A game KGS joined us to while searching: our own game, opened like an
	// accepted challenge (there is no CHALLENGE_FINAL for automatch).
	onAutomatchGameJoined = (gameId: number) => {
		const state = this._store.getState();
		const game = state.gamesById[gameId];
		const name = state.currentUser && state.currentUser.name;
		if (!game || !name || !isGamePlayer(name, game.players)) {
			return;
		}
		this._automatchEndedAt = 0;
		this._store.dispatch({ type: 'PLAY_GAME', gameId });
		this.onChangeNav('play');
		playGameStart();
	};
	// A game loaded from the archive (onLoadGame) arrived. Our own unfinished
	// game opens on the Spielen page to go on with it. A review (a finished
	// game) is opened by whoever asked for it (UserGameSummary).
	onLoadedGameJoined = (gameId: number) => {
		const state = this._store.getState();
		const game = state.gamesById[gameId];
		const name = state.currentUser && state.currentUser.name;
		if (!game || !name || game.type === 'review' || !isGamePlayer(name, game.players)) {
			return;
		}
		this._loadRequestedAt = 0;
		this._store.dispatch({ type: 'PLAY_GAME', gameId });
		this.onChangeNav('play');
		playGameStart();
	};
	onClickContribute = () => {
		window.open('https://github.com/jkk/shinkgs', '_blank');
	};
}
