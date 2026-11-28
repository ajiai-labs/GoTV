// The main window and the windows opened from it (game windows /partie, the
// board overview /bretter). Games come into those windows only from the
// main window, so (user, 28.11.2026): closing the main window while others
// are open asks first (the browser's own question - a page cannot word it),
// and when it is gone the other windows close too. A window with your own
// running game stays: it may hold the KGS connection, and closing it would
// leave the game running at KGS without you - it offers to open the main
// window again instead.
//
// Every window says "here" on a channel of its own (separate from the KGS
// link in windowLink.ts) and repeats it; "gone" when it closes. A reload of
// the main window also says "gone": the other windows wait a moment and ask
// - if a main window answers (the reloaded one, or another tab), nothing
// closes.

export const FAMILY_CHANNEL = 'gotv-windows';

// A reload GoTV does itself (after an update): no question.
let quiet = false;
export function unloadWithoutAsking() {
	quiet = true;
}
export function asksBeforeUnload(): boolean {
	return !quiet;
}

export type WindowKind = 'main' | 'child';

type FamilyMessage =
	| { t: 'here'; id: string; kind: WindowKind }
	| { t: 'gone'; id: string; kind: WindowKind }
	| { t: 'ping' };

export type FamilyTiming = {
	heartbeatMs: number; // "here" again
	staleMs: number; // not heard of that long: gone
	waitMs: number; // after a main window said "gone": until asking
	answerMs: number; // after asking: until deciding
};

const TIMING: FamilyTiming = { heartbeatMs: 5000, staleMs: 12000, waitMs: 2500, answerMs: 1500 };

export type WindowFamily = {
	// Other open GoTV windows of that kind.
	count(kind: WindowKind): number;
	leave(): void;
};

export function joinWindowFamily(
	kind: WindowKind,
	onMainGone: () => void,
	onMainBack: () => void = () => {},
	timing: FamilyTiming = TIMING
): WindowFamily {
	if (typeof BroadcastChannel === 'undefined') {
		return { count: () => 0, leave: () => {} };
	}
	const id = Math.random().toString(36).slice(2);
	const channel = new BroadcastChannel(FAMILY_CHANNEL);
	const seen = new Map<string, { kind: WindowKind; at: number }>();
	const timers = new Set<ReturnType<typeof setTimeout>>();
	let left = false;

	const post = (message: FamilyMessage) => {
		if (!left) channel.postMessage(message);
	};
	const later = (ms: number, run: () => void) => {
		const timer = setTimeout(() => {
			timers.delete(timer);
			if (!left) run();
		}, ms);
		timers.add(timer);
	};
	const mainSince = (since: number) =>
		[...seen.values()].some((entry) => entry.kind === 'main' && entry.at >= since);

	channel.onmessage = (event: MessageEvent<FamilyMessage>) => {
		const message = event.data;
		if (message.t === 'ping') {
			post({ t: 'here', id, kind });
		} else if (message.t === 'here' && message.id !== id) {
			const wasThere = mainSince(Date.now() - timing.staleMs);
			seen.set(message.id, { kind: message.kind, at: Date.now() });
			if (message.kind === 'main' && !wasThere) onMainBack();
		} else if (message.t === 'gone' && message.id !== id) {
			seen.delete(message.id);
			if (message.kind !== 'main' || kind !== 'child') return;
			const goneAt = Date.now();
			later(timing.waitMs, () => {
				post({ t: 'ping' });
				later(timing.answerMs, () => {
					if (!mainSince(goneAt)) onMainGone();
				});
			});
		}
	};

	post({ t: 'here', id, kind });
	const heartbeat = setInterval(() => post({ t: 'here', id, kind }), timing.heartbeatMs);

	return {
		count(other: WindowKind) {
			const since = Date.now() - timing.staleMs;
			return [...seen.values()].filter((entry) => entry.kind === other && entry.at >= since).length;
		},
		leave() {
			if (left) return;
			post({ t: 'gone', id, kind });
			left = true;
			clearInterval(heartbeat);
			for (const timer of timers) clearTimeout(timer);
			channel.close();
		}
	};
}
