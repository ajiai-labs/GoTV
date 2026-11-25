// KGS community features of CGoban's "Benutzer" and "Datei" menus:
// the three friend lists (Freunde, Ignorierliste, Fanliste), messages left
// in the mailbox, and the server statistics. Also the answers KGS gives to
// such requests (a message left, a room created ...), for the dialogs.
import type { AppState, KgsMessage } from './types';

export type FriendType = 'buddy' | 'censored' | 'fan';
export const FRIEND_TYPES: Array<FriendType> = ['buddy', 'censored', 'fan'];

export type Friend = {
	type: FriendType;
	name: string;
	rank?: string;
	notes?: string;
};

export type MailboxMessage = {
	time: string;
	from: string;
	text: string;
};

export type ServerStats = {
	logins?: number;
	loginsMax?: number;
	accounts?: number;
	rooms?: number;
	games?: number;
	gamesMax?: number;
	serverStartTime?: string;
	version?: string;
};

// The last answer of KGS to a request made from GoTV.
export type CommunityResult = {
	type: string;
	at: number;
};

export type CommunityState = {
	friends: Array<Friend>;
	mailbox: Array<MailboxMessage>;
	serverStats: ServerStats | null;
	communityResult: CommunityResult | null;
};

export function getEmptyCommunityState(): CommunityState {
	return { friends: [], mailbox: [], serverStats: null, communityResult: null };
}

const RESULT_TYPES = new Set([
	'MESSAGE_CREATE_SUCCESS',
	'MESSAGE_CREATE_NO_USER',
	'MESSAGE_CREATE_FULL',
	'MESSAGE_CREATE_CONNECTED',
	'FRIEND_CHANGE_NO_USER',
	'FRIEND_ADD_SUCCESS',
	'FRIEND_REMOVE_SUCCESS',
	'ROOM_CREATED',
	'ROOM_CREATE_NAME_TAKEN',
	'ROOM_CREATE_TOO_MANY_ROOMS'
]);

function isFriendType(value: unknown): value is FriendType {
	return value === 'buddy' || value === 'censored' || value === 'fan';
}

function parseFriend(value: any): Friend | null {
	const name = value?.user?.name;
	if (!isFriendType(value?.friendType) || typeof name !== 'string') return null;
	const friend: Friend = { type: value.friendType, name };
	if (typeof value.user.rank === 'string') friend.rank = value.user.rank;
	if (typeof value.notes === 'string' && value.notes) friend.notes = value.notes;
	return friend;
}

function sameFriend(a: Friend, b: { type: FriendType; name: string }) {
	return a.type === b.type && a.name.toLowerCase() === b.name.toLowerCase();
}

function sortFriends(friends: Array<Friend>): Array<Friend> {
	return [...friends].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

export function handleCommunityMessage(prevState: AppState, msg: KgsMessage): AppState {
	let state = prevState;
	if (RESULT_TYPES.has(msg.type)) {
		state = { ...state, communityResult: { type: msg.type, at: Date.now() } };
	}
	switch (msg.type) {
		case 'COMMUNITY_RESULT_CLEAR':
			return { ...state, communityResult: null };
		case 'MAILBOX_CLEAR':
			return { ...state, mailbox: [] };
		case 'LOGIN_SUCCESS': {
			const list: Array<unknown> = Array.isArray(msg.friends) ? msg.friends : [];
			const friends = list.map(parseFriend).filter((f): f is Friend => !!f);
			return { ...state, friends: sortFriends(friends) };
		}
		case 'FRIEND_ADD_SUCCESS': {
			const friend = parseFriend(msg);
			if (!friend) return state;
			const others = state.friends.filter((f) => !sameFriend(f, friend));
			return { ...state, friends: sortFriends([...others, friend]) };
		}
		case 'FRIEND_REMOVE_SUCCESS': {
			const friend = parseFriend(msg);
			if (!friend) return state;
			return { ...state, friends: state.friends.filter((f) => !sameFriend(f, friend)) };
		}
		case 'MESSAGES': {
			const list: Array<any> = Array.isArray(msg.messages) ? msg.messages : [];
			const mailbox = list
				.filter((m) => typeof m?.text === 'string' && typeof m?.user?.name === 'string')
				.map((m) => ({
					time: String(m.time ?? ''),
					from: m.user.name as string,
					text: m.text as string
				}));
			return { ...state, mailbox: [...state.mailbox, ...mailbox] };
		}
		case 'SERVER_STATS': {
			const stats: ServerStats = {
				logins: msg.logins,
				loginsMax: msg.loginsMax,
				accounts: msg.accounts,
				rooms: msg.rooms,
				games: msg.games,
				gamesMax: msg.gamesMax,
				serverStartTime: msg.serverStartTime
			};
			if (msg.versionMajor != null) {
				stats.version = `${msg.versionMajor}.${msg.versionMinor}.${msg.versionBugfix}`;
			}
			return { ...state, serverStats: stats };
		}
		default:
			return state;
	}
}

// Names on a list, without case (KGS names are case-insensitive).
export function isOnList(friends: Array<Friend>, type: FriendType, name: string): boolean {
	return friends.some((f) => sameFriend(f, { type, name }));
}
