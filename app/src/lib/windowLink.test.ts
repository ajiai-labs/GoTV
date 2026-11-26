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
		feed.receive({ t: 'msgs', seq: 1, msgs: [{ type: 'EARLY' }] });
		expect(apply).not.toHaveBeenCalled(); // no snapshot yet
		feed.receive({ t: 'snapshot', seq: 4, state: state('a') });
		expect(replace).toHaveBeenCalledWith(state('a'));
		feed.receive({ t: 'msgs', seq: 4, msgs: [{ type: 'OLD' }] }); // in the snapshot
		feed.receive({ t: 'msgs', seq: 5, msgs: [{ type: 'NEW' }] });
		expect(apply).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenCalledWith([{ type: 'NEW' }]);
		expect(resync).not.toHaveBeenCalled();
	});

	it('asks for a new snapshot when a message is missing', () => {
		const apply = vi.fn();
		const resync = vi.fn();
		const feed = new FollowerFeed(apply, vi.fn(), resync);
		feed.receive({ t: 'snapshot', seq: 2, state: state('a') });
		feed.receive({ t: 'msgs', seq: 4, msgs: [{ type: 'GAP' }] });
		expect(resync).toHaveBeenCalledTimes(1);
		expect(apply).not.toHaveBeenCalled();
		expect(feed.ready).toBe(false);
	});

	it('lets a follower window only play and chat in its game', () => {
		expect(FORWARDED_ACTIONS.has('onPlayMove')).toBe(true);
		expect(FORWARDED_ACTIONS.has('onSendGameChat')).toBe(true);
		expect(FORWARDED_ACTIONS.has('onLogin')).toBe(false);
		expect(FORWARDED_ACTIONS.has('onChangeNav')).toBe(false);
	});
});
