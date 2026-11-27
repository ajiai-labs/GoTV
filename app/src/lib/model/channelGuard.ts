// The one gate for JOIN_REQUEST and UNJOIN_REQUEST (review 26.11.2026). KGS
// ends the WHOLE session ("Internal error … Unknown channel N") when it gets
// a join or unjoin for a channel it does not know - a closed game, a closed
// temporary room, a channel we already left. So every such request passes
// here, whichever part of GoTV sends it (game windows, Brettübersicht, TV
// boards, rooms, profiles, archive replays):
//
// - a channel KGS closed (CLOSE) is never asked for again;
// - a game KGS took off its lists is not joined again (its channel may be
//   gone without a CLOSE reaching us);
// - a join is sent once until KGS answers, an unjoin once and only for a
//   channel we are in (or are joining);
// - a new login starts from nothing (no request of the old session).
import type { KgsMessage } from './types';

// A request KGS has not answered after this long no longer blocks a retry.
const PENDING_MS = 20_000;

// What the gate knows, kept in the browser storage so a reload (F5) of the
// window holding the connection, or another window taking over, goes on with
// it (review 27.11.2026: without it a closed channel was asked for again).
export const CHANNEL_GUARD_KEY = 'gotv.kgsChannels';

export type ChannelGuardState = {
	joined: Array<number>;
	joining: Array<[number, number]>;
	leaving: Array<[number, number]>;
	closed: Array<number>;
	listedIn: Array<[number, Array<number>]>;
};

const isIdList = (value: unknown): value is Array<number> =>
	Array.isArray(value) && value.every((id) => typeof id === 'number');
const isPairList = (value: unknown): value is Array<[number, number]> =>
	Array.isArray(value) &&
	value.every((pair) => Array.isArray(pair) && isIdList(pair) && pair.length === 2);

export function loadChannelGuardState(): ChannelGuardState | null {
	try {
		const raw = localStorage.getItem(CHANNEL_GUARD_KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : null;
		if (!parsed || typeof parsed !== 'object') return null;
		const state = parsed as Record<string, unknown>;
		const lists = state.listedIn;
		if (
			!isIdList(state.joined) ||
			!isPairList(state.joining) ||
			!isPairList(state.leaving) ||
			!isIdList(state.closed) ||
			!Array.isArray(lists) ||
			!lists.every(
				(entry) => Array.isArray(entry) && typeof entry[0] === 'number' && isIdList(entry[1])
			)
		) {
			return null;
		}
		return state as ChannelGuardState;
	} catch {
		return null;
	}
}

export function saveChannelGuardState(state: ChannelGuardState) {
	try {
		localStorage.setItem(CHANNEL_GUARD_KEY, JSON.stringify(state));
	} catch {
		// without storage only this window knows it
	}
}

export class ChannelGuard {
	private joined = new Set<number>();
	private joining = new Map<number, number>();
	private leaving = new Map<number, number>();
	private closed = new Set<number>();
	// The lists (global list, rooms) each game is in: a game KGS took off all
	// lists it was in is not joined again.
	private listedIn = new Map<number, Set<number>>();

	// Called after every change (the owner window stores it, see above).
	onChange: (() => void) | null = null;

	constructor(private readonly now: () => number = Date.now) {}

	// A new session, or the channels a restored or taken-over state is in.
	reset(joined: Iterable<number> = []) {
		this.joined = new Set(joined);
		this.joining.clear();
		this.leaving.clear();
		this.closed.clear();
		this.listedIn.clear();
		this.onChange?.();
	}

	// The same session goes on in this window (reload, take-over): what the
	// gate knew there. `joined` - the channels the state shows us in; the
	// stored ones count as well (a join KGS confirmed after the last save).
	restore(state: ChannelGuardState | null, joined: Iterable<number> = []) {
		this.joined = new Set([...joined, ...(state?.joined ?? [])]);
		this.joining = new Map(state?.joining ?? []);
		this.leaving = new Map(state?.leaving ?? []);
		this.closed = new Set(state?.closed ?? []);
		this.listedIn = new Map((state?.listedIn ?? []).map(([id, lists]) => [id, new Set(lists)]));
		for (const id of this.closed) this.joined.delete(id);
		this.onChange?.();
	}

	toJSON(): ChannelGuardState {
		return {
			joined: [...this.joined],
			joining: [...this.joining],
			leaving: [...this.leaving],
			closed: [...this.closed],
			listedIn: [...this.listedIn].map(([id, lists]) => [id, [...lists]])
		};
	}

	isJoined(channelId: number): boolean {
		return this.joined.has(channelId);
	}

	isClosed(channelId: number): boolean {
		return this.closed.has(channelId);
	}

	// Every message from KGS, before it is handled.
	observe(msg: KgsMessage) {
		const id = typeof msg.channelId === 'number' ? msg.channelId : null;
		if (msg.type === 'LOGIN_SUCCESS' || msg.type === 'LOGOUT') {
			this.reset();
		} else if (id !== null && /_JOIN$/.test(msg.type)) {
			this.joined.add(id);
			this.joining.delete(id);
			this.closed.delete(id);
		} else if (id !== null && msg.type === 'UNJOIN') {
			this.joined.delete(id);
			this.joining.delete(id);
			this.leaving.delete(id);
		} else if (id !== null && msg.type === 'CLOSE') {
			this.joined.delete(id);
			this.joining.delete(id);
			this.leaving.delete(id);
			this.closed.add(id);
		}
		if (msg.type === 'GAME_CONTAINER_REMOVE_GAME' && typeof msg.gameId === 'number') {
			this.listedIn.get(msg.gameId)?.delete(id ?? -1);
		}
		if (Array.isArray(msg.games) && id !== null) {
			for (const game of msg.games as Array<{ channelId?: unknown }>) {
				if (typeof game?.channelId !== 'number') continue;
				const lists = this.listedIn.get(game.channelId) ?? new Set<number>();
				lists.add(id);
				this.listedIn.set(game.channelId, lists);
			}
		}
		this.onChange?.();
	}

	private pending(map: Map<number, number>, id: number): boolean {
		const at = map.get(id);
		if (at === undefined) return false;
		if (this.now() - at < PENDING_MS) return true;
		map.delete(id);
		return false;
	}

	// Whether a join would go to KGS now (without noting it).
	canJoin(channelId: number): boolean {
		const lists = this.listedIn.get(channelId);
		if (this.closed.has(channelId) || (lists && lists.size === 0)) return false;
		if (this.pending(this.joining, channelId)) return false;
		return !this.joined.has(channelId) || this.pending(this.leaving, channelId);
	}

	// Whether a request may go to KGS; a request that goes is noted.
	allow(msg: KgsMessage): boolean {
		const id = typeof msg.channelId === 'number' ? msg.channelId : null;
		if (id === null) return true;
		if (msg.type === 'JOIN_REQUEST') {
			if (!this.canJoin(id)) return false;
			this.joining.set(id, this.now());
			this.onChange?.();
			return true;
		}
		if (msg.type === 'UNJOIN_REQUEST') {
			if (this.closed.has(id) || this.pending(this.leaving, id)) return false;
			if (!this.joined.has(id) && !this.pending(this.joining, id)) return false;
			this.leaving.set(id, this.now());
			this.onChange?.();
			return true;
		}
		return true;
	}
}
