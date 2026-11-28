import { describe, expect, it, vi } from 'vitest';
import { AppActions } from './AppActions';
import { AppStore } from './AppStore';
import { getInitialState, handleMessage } from './index';
import type { KgsClient } from './KgsClient';
import type { AppState, User, UserDetails } from './types';

const me: User = { name: 'andy1975', rank: '1d', flags: { connected: true } };
const details = {
	channelId: 70,
	personalName: 'Andreas',
	personalInfo: 'Go aus Köln',
	regStartDate: '',
	lastOn: '',
	locale: 'de_DE'
} as unknown as UserDetails;

// Profile changes (user, 28.11.2026: not saved, and the connection broke).
describe('changing your profile', () => {
	it('sends the change, then leaves and reads the details - each after the answer', async () => {
		const state = {
			...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
			initialized: true,
			currentUser: me,
			channelMembership: { 70: { type: 'details', complete: true, stale: false } }
		} as AppState;
		const store = new AppStore(handleMessage, state);
		// KGS answers each POST a moment later.
		const answers: Array<() => void> = [];
		const sendMessage = vi.fn(() => new Promise<void>((done) => answers.push(done)));
		const client = { sendMessage } as unknown as KgsClient;
		const history = { location: { pathname: '/konto' }, push: vi.fn(), replace: vi.fn() };
		const actions = new AppActions(store, client, history);

		const saving = actions.onUpdateProfileDetails(me, details);
		await Promise.resolve();
		// Only the change is on its way - the UNJOIN must not overtake it.
		expect(sendMessage.mock.calls.map(([message]) => message.type)).toEqual(['DETAILS_CHANGE']);
		expect(sendMessage.mock.calls[0][0]).toMatchObject({
			emailWanted: false,
			privateEmail: false,
			forcedNoRank: false,
			personalEmail: ''
		});
		answers.shift()?.();
		await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
		expect(sendMessage.mock.calls[1][0]).toEqual({ type: 'UNJOIN_REQUEST', channelId: 70 });
		answers.shift()?.();
		await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(3));
		expect(sendMessage.mock.calls[2][0]).toEqual({
			type: 'DETAILS_JOIN_REQUEST',
			name: 'andy1975'
		});
		answers.shift()?.();
		await saving;
	});
});
