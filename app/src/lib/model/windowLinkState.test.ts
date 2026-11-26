// A follower window must end up with the same state as the owner: the
// snapshot has to survive structured cloning (BroadcastChannel), and the
// same messages through the same reducer must give the same game.
import { describe, expect, it } from 'vitest';
import { AppStore } from './AppStore';
import { getInitialState, handleMessage } from './index';
import { FollowerFeed } from '../windowLink';
import type { LinkMessage } from '../windowLink';
import type { AppState, KgsMessage } from './types';

const ME = { name: 'andy1975', rank: '1d', flags: {} };
const ANNA = { name: 'anna', rank: '2d', flags: {} };

function move(nodeId: number, x: number, y: number, color: string): Array<KgsMessage> {
	return [
		{ type: 'CHILD_ADDED', nodeId: nodeId - 1, childNodeId: nodeId },
		{ type: 'PROP_GROUP_ADDED', nodeId, props: [{ name: 'MOVE', color, loc: { x, y } }] },
		{ type: 'ACTIVATED', nodeId }
	];
}

describe('window link with a real game', () => {
	it('gives a follower window the same game as the owner', () => {
		const owner = new AppStore(handleMessage, {
			...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
			initialized: true,
			currentUser: ME
		} as AppState);
		const sent: Array<LinkMessage> = [];
		let seq = 0;
		owner.setOnDispatch((msgs) => sent.push(structuredClone({ t: 'msgs', seq: ++seq, msgs })));

		owner.dispatch({
			type: 'GAME_JOIN',
			channelId: 42,
			gameType: 'ranked',
			players: { white: ME, black: ANNA },
			users: [ANNA, ME],
			sgfEvents: [
				{
					type: 'PROP_GROUP_ADDED',
					nodeId: 0,
					props: [{ name: 'RULES', size: 9, komi: 6.5, rules: 'japanese' }]
				},
				...move(1, 2, 6, 'black')
			]
		});

		// A follower joins now: snapshot, then the next moves arrive.
		const follower = new AppStore(
			handleMessage,
			getInitialState({ status: 'loggedOut', network: 'online', retryTimes: 0 })
		);
		const feed = new FollowerFeed(
			(msgs) => follower.dispatch(msgs),
			(state) => follower.replaceState(state),
			() => {}
		);
		feed.receive(structuredClone({ t: 'snapshot', seq, state: owner.getState() }));
		owner.dispatch({ type: 'GAME_UPDATE', channelId: 42, sgfEvents: move(2, 6, 2, 'white') });
		owner.dispatch({ type: 'CHAT', channelId: 42, user: ANNA, text: 'viel Glück' });
		for (const message of sent.slice(1)) feed.receive(message);

		const mine = owner.getState().gamesById[42];
		const theirs = follower.getState().gamesById[42];
		expect(theirs.tree?.currentNode).toBe(2);
		expect(theirs.tree?.computedState).toEqual(mine.tree?.computedState);
		expect(follower.getState().currentUser).toEqual(ME);
	});
});
