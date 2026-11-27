// One KGS connection for all GoTV windows (26.11.2026). Before this, every
// tab or window restored the saved login and polled the same KGS session:
// each message from KGS reached only ONE of them, so chat and moves could
// land in the wrong window.
//
// Now the first window holds the connection ("owner", a Web Lock that ends
// with the window). Every other window is a "follower": it gets the owner's
// state once (snapshot) and then the same stream of messages, which it puts
// through the same reducer - so all windows show the same KGS state. What a
// follower does (a move, a chat line) goes to the owner as a call. When the
// owner closes, a waiting follower gets the lock and takes over.
//
// Without Web Locks or BroadcastChannel (very old engines) every window is
// its own owner, as before.
import type { AppState, KgsMessage } from './model/types';
import type { SoundName } from './sound/gameSounds';

export const LINK_CHANNEL = 'gotv-kgs-link';
const LOCK_NAME = 'gotv-kgs-connection';

export type LinkMessage =
	| { t: 'hello' }
	| { t: 'snapshot'; owner: string; seq: number; state: AppState }
	| { t: 'msgs'; owner: string; seq: number; msgs: Array<KgsMessage> }
	| { t: 'call'; method: string; args: Array<unknown> }
	| { t: 'sound'; name: SoundName; arg?: number };

// What a follower window may ask the owner to do: the actions of a game
// window and of a profile opened there.
export const FORWARDED_ACTIONS = new Set([
	'onPlayMove',
	'onPass',
	'onUndo',
	'onAcceptUndo',
	'onDeclineUndo',
	'onResign',
	'onMarkLife',
	'onDoneScoring',
	'onAddGameTime',
	'onSendGameChat',
	'onChangeCurrentNode',
	'onReviewMove',
	'onReviewGoTo',
	'onStartReview',
	'onRequestTagArchive',
	'onTagGame',
	'onViewGame',
	'onUnviewGame',
	'onLeaveGame',
	// A profile opens in the window where the name was clicked (app.svelte.ts).
	'onUserDetail',
	'onCloseUserDetail',
	// The "Abmelden" button of the offline notice, in any window.
	'onLogout',
	// What a profile or the more menu of a game window offers (review
	// 26.11.2026: these buttons did nothing in a follower). Whatever opens a
	// page (a chat, a watched game) opens in the main window.
	'onStartChat',
	'onRequestRankGraph',
	'onAddFriend',
	'onRemoveFriend',
	'onLeaveMessage',
	'onClearCommunityResult',
	'onUpdateProfileDetails',
	'onUpdatePassword',
	'onLoadGame',
	'onCloneGame',
	'onJoinGame',
	'onOpenTvStream'
]);

// This window, for the views registered with the owner (onViewGame).
export const VIEW_ID = `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function canLinkWindows(): boolean {
	return (
		typeof navigator !== 'undefined' && !!navigator.locks && typeof BroadcastChannel !== 'undefined'
	);
}

const held = () => new Promise<void>(() => {}); // kept until the window closes

// 'owner' if this window got the connection, otherwise 'follower'.
export function claimConnection(): Promise<'owner' | 'follower'> {
	if (!canLinkWindows()) return Promise.resolve('owner');
	return new Promise((resolve) => {
		navigator.locks
			.request(LOCK_NAME, { ifAvailable: true }, (lock) => {
				if (!lock) {
					resolve('follower');
					return;
				}
				resolve('owner');
				return held();
			})
			.catch(() => resolve('owner'));
	});
}

// A follower waits here; `onFree` runs once the owner window is gone and
// this window holds the connection.
export function waitForConnection(onFree: () => void) {
	navigator.locks
		.request(LOCK_NAME, () => {
			onFree();
			return held();
		})
		.catch(() => {});
}

// The follower side of the message stream: applies messages in order and
// asks for a fresh snapshot when one is missing.
export class FollowerFeed {
	private seq = -1;
	// The window holding the connection: numbers count per owner, so a new
	// owner (F5, the old one closed) starts afresh from its snapshot.
	private owner: string | null = null;

	constructor(
		private readonly apply: (msgs: Array<KgsMessage>) => void,
		private readonly replace: (state: AppState) => void,
		private readonly resync: () => void,
		private readonly ownerChanged: () => void = () => {}
	) {}

	get ready(): boolean {
		return this.seq >= 0;
	}

	receive(message: LinkMessage) {
		if (message.t === 'snapshot') {
			const newOwner = message.owner !== this.owner;
			if (newOwner || message.seq >= this.seq) {
				const hadOwner = this.owner !== null;
				this.owner = message.owner;
				this.seq = message.seq;
				this.replace(message.state);
				if (newOwner && hadOwner) this.ownerChanged();
			}
		} else if (message.t === 'msgs') {
			if (this.owner === null) return; // waiting for the first snapshot
			if (message.owner !== this.owner) {
				// Another window took over and we missed its snapshot.
				this.seq = -1;
				this.resync();
				return;
			}
			if (!this.ready || message.seq <= this.seq) return; // in the snapshot already
			if (message.seq !== this.seq + 1) {
				this.seq = -1; // a gap: start again from a snapshot
				this.resync();
				return;
			}
			this.seq = message.seq;
			this.apply(message.msgs);
		}
	}
}
