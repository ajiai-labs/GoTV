import { describe, expect, it, vi } from 'vitest';
import { AppActions } from './AppActions';
import { AppStore } from './AppStore';
import { getInitialState, handleMessage } from './index';
import type { KgsClient } from './KgsClient';
import type { AppState, GameProposal } from './types';
import { ANNA_CHALLENGE, annaChallenge, annaProposal, me } from './__fixtures__/challenge';

// What we sent to anna: her terms, we take black.
const sent: GameProposal = {
	...annaProposal,
	players: [
		{ role: 'white', name: 'anna' },
		{ role: 'black', name: me.name }
	]
};
// anna sends it back with another komi.
const counter: GameProposal = {
	...sent,
	rules: { ...sent.rules, komi: 0.5 },
	players: [
		{ role: 'white', user: { name: 'anna', rank: '2d' } },
		{ role: 'black', user: { name: me.name, rank: me.rank } }
	]
};

function setup() {
	const state = {
		...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
		initialized: true,
		currentUser: me,
		playChallengeId: ANNA_CHALLENGE,
		gamesById: { [ANNA_CHALLENGE]: annaChallenge }
	} as AppState;
	const store = new AppStore(handleMessage, state);
	const sendMessage = vi.fn();
	const client = { sendMessage } as unknown as KgsClient;
	const history = { location: { pathname: '/spielen' }, push: vi.fn(), replace: vi.fn() };
	const actions = new AppActions(store, client, history);
	actions.onSubmitChallengeProposal(ANNA_CHALLENGE, sent);
	sendMessage.mockClear();
	return { store, sendMessage, actions };
}

describe('counter proposals', () => {
	it('accepts at once when the creator agrees to what we sent', () => {
		const { sendMessage, actions } = setup();
		actions.onReceiveServerMessages([
			{ type: 'CHALLENGE_PROPOSAL', channelId: ANNA_CHALLENGE, proposal: sent }
		]);
		expect(sendMessage).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'CHALLENGE_ACCEPT', channelId: ANNA_CHALLENGE })
		);
	});

	it('keeps the challenge open and shows changed terms', () => {
		const { store, sendMessage, actions } = setup();
		actions.onReceiveServerMessages([
			{ type: 'CHALLENGE_PROPOSAL', channelId: ANNA_CHALLENGE, proposal: counter }
		]);
		expect(store.getState().playChallengeId).toBe(ANNA_CHALLENGE);
		expect(store.getState().gamesById[ANNA_CHALLENGE].counterProposal).toEqual(counter);
		expect(sendMessage).not.toHaveBeenCalled();
	});

	it('accepts the changed terms with player names only', () => {
		const { store, sendMessage, actions } = setup();
		actions.onReceiveServerMessages([
			{ type: 'CHALLENGE_PROPOSAL', channelId: ANNA_CHALLENGE, proposal: counter }
		]);
		actions.onAcceptCounterProposal(ANNA_CHALLENGE);
		expect(sendMessage).toHaveBeenCalledWith({
			...counter,
			players: [
				{ role: 'white', name: 'anna' },
				{ role: 'black', name: me.name }
			],
			type: 'CHALLENGE_ACCEPT',
			channelId: ANNA_CHALLENGE
		});
		const challenge = store.getState().gamesById[ANNA_CHALLENGE];
		expect(challenge.counterProposal).toBeUndefined();
		expect(challenge.sentProposal).toMatchObject({ status: 'pending', rules: { komi: 0.5 } });
	});

	it('closes the challenge when KGS sends no proposal', () => {
		const { store, actions } = setup();
		actions.onReceiveServerMessages([{ type: 'CHALLENGE_PROPOSAL', channelId: ANNA_CHALLENGE }]);
		expect(store.getState().playChallengeId).toBeNull();
	});
});
