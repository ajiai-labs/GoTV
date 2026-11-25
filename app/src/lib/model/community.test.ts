import { describe, expect, it } from 'vitest';
import { getInitialState, handleMessage } from './index';
import { isOnList } from './community';
import type { AppState, KgsMessage } from './types';

const ME = { name: 'andy1975', rank: '1d', flags: 'c' };

function loggedIn(...msgs: Array<KgsMessage>): AppState {
	const start = getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 });
	return msgs.reduce(handleMessage, start);
}

const LOGIN = {
	type: 'LOGIN_SUCCESS',
	you: ME,
	rooms: [],
	friends: [
		{ friendType: 'buddy', user: { name: 'thirdstep', rank: '2d' }, notes: 'Bundesliga' },
		{ friendType: 'censored', user: { name: 'harakaki', rank: '1k' } },
		{ friendType: 'fan', user: { name: 'Ameise', rank: '5d' } },
		{ friendType: 'admin_track', user: { name: 'x' } }
	]
} as unknown as KgsMessage;

describe('community state', () => {
	it('reads the friend lists at login', () => {
		const state = loggedIn(LOGIN);
		expect(state.friends).toEqual([
			{ type: 'fan', name: 'Ameise', rank: '5d' },
			{ type: 'censored', name: 'harakaki', rank: '1k' },
			{ type: 'buddy', name: 'thirdstep', rank: '2d', notes: 'Bundesliga' }
		]);
		expect(isOnList(state.friends, 'censored', 'HARAKAKI')).toBe(true);
	});

	it('adds and removes friends as KGS confirms', () => {
		let state = loggedIn(LOGIN, {
			type: 'FRIEND_ADD_SUCCESS',
			friendType: 'buddy',
			user: { name: 'guiguistar', rank: '2d' },
			notes: 'Teamkollege'
		} as unknown as KgsMessage);
		expect(isOnList(state.friends, 'buddy', 'guiguistar')).toBe(true);
		expect(state.communityResult?.type).toBe('FRIEND_ADD_SUCCESS');
		state = handleMessage(state, {
			type: 'FRIEND_REMOVE_SUCCESS',
			friendType: 'censored',
			user: { name: 'harakaki' }
		} as unknown as KgsMessage);
		expect(isOnList(state.friends, 'censored', 'harakaki')).toBe(false);
	});

	it('keeps messages from the mailbox and the server statistics', () => {
		const state = loggedIn(
			LOGIN,
			{
				type: 'MESSAGES',
				messages: [
					{ time: '2026-11-25T18:00:00.000Z', user: { name: 'thirdstep' }, text: 'Weiter morgen?' }
				]
			} as unknown as KgsMessage,
			{
				type: 'SERVER_STATS',
				logins: 1500,
				loginsMax: 2100,
				games: 300,
				versionMajor: 3,
				versionMinor: 5,
				versionBugfix: 27
			} as unknown as KgsMessage
		);
		expect(state.mailbox).toEqual([
			{ time: '2026-11-25T18:00:00.000Z', from: 'thirdstep', text: 'Weiter morgen?' }
		]);
		expect(state.serverStats).toMatchObject({ logins: 1500, games: 300, version: '3.5.27' });
	});

	it('remembers the answer to a left message', () => {
		const state = loggedIn(LOGIN, { type: 'MESSAGE_CREATE_NO_USER' } as KgsMessage);
		expect(state.communityResult?.type).toBe('MESSAGE_CREATE_NO_USER');
	});

	it('fills new fields when an older saved state is restored', () => {
		const saved = { ...loggedIn() } as Record<string, unknown>;
		delete saved.friends;
		const state = handleMessage(loggedIn(), {
			type: 'RESTORE_APP_STATE',
			appState: saved
		} as unknown as KgsMessage);
		expect(state.friends).toEqual([]);
	});
});
