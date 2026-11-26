import { describe, expect, it, vi } from 'vitest';
import { FORWARDED_ACTIONS, FollowerFeed } from './windowLink';
import type { AppState } from './model/types';

const state = (name: string) => ({ name }) as unknown as AppState;

describe('window link', () => {
	it('starts from a snapshot and then applies the messages in order', () => {
		const apply = vi.fn();
		const replace = vi.fn();
		const resync = vi.fn();
		const feed = new FollowerFeed(apply, replace, resync);
		feed.receive({ t: 'msgs', owner: 'a', seq: 1, msgs: [{ type: 'EARLY' }] });
		expect(apply).not.toHaveBeenCalled(); // no snapshot yet
		feed.receive({ t: 'snapshot', owner: 'a', seq: 4, state: state('a') });
		expect(replace).toHaveBeenCalledWith(state('a'));
		feed.receive({ t: 'msgs', owner: 'a', seq: 4, msgs: [{ type: 'OLD' }] }); // in the snapshot
		feed.receive({ t: 'msgs', owner: 'a', seq: 5, msgs: [{ type: 'NEW' }] });
		expect(apply).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenCalledWith([{ type: 'NEW' }]);
		expect(resync).not.toHaveBeenCalled();
	});

	it('asks for a new snapshot when a message is missing', () => {
		const apply = vi.fn();
		const resync = vi.fn();
		const feed = new FollowerFeed(apply, vi.fn(), resync);
		feed.receive({ t: 'snapshot', owner: 'a', seq: 2, state: state('a') });
		feed.receive({ t: 'msgs', owner: 'a', seq: 4, msgs: [{ type: 'GAP' }] });
		expect(resync).toHaveBeenCalledTimes(1);
		expect(apply).not.toHaveBeenCalled();
		expect(feed.ready).toBe(false);
	});

	it('follows a new owner after F5 and tells it what this window shows', () => {
		const apply = vi.fn();
		const replace = vi.fn();
		const resync = vi.fn();
		const ownerChanged = vi.fn();
		const feed = new FollowerFeed(apply, replace, resync, ownerChanged);
		feed.receive({ t: 'snapshot', owner: 'a', seq: 40, state: state('a') });
		feed.receive({ t: 'msgs', owner: 'a', seq: 41, msgs: [{ type: 'OLD' }] });
		// Window b took over (its numbers start at 0) - we missed its snapshot.
		feed.receive({ t: 'msgs', owner: 'b', seq: 1, msgs: [{ type: 'NEW' }] });
		expect(resync).toHaveBeenCalledTimes(1);
		feed.receive({ t: 'snapshot', owner: 'b', seq: 1, state: state('b') });
		expect(replace).toHaveBeenLastCalledWith(state('b'));
		expect(ownerChanged).toHaveBeenCalledTimes(1);
		feed.receive({ t: 'msgs', owner: 'b', seq: 2, msgs: [{ type: 'NEXT' }] });
		expect(apply).toHaveBeenLastCalledWith([{ type: 'NEXT' }]);
	});

	it('lets a follower window only play and chat in its game', () => {
		expect(FORWARDED_ACTIONS.has('onPlayMove')).toBe(true);
		expect(FORWARDED_ACTIONS.has('onSendGameChat')).toBe(true);
		expect(FORWARDED_ACTIONS.has('onLogin')).toBe(false);
		expect(FORWARDED_ACTIONS.has('onChangeNav')).toBe(false);
	});
});
