import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { flushSync } from 'svelte';
import { app } from '#lib/app.svelte.ts';
import { getInitialState } from '#lib/model/appState.ts';
import type { GameChannel } from '#lib/model/types.ts';
import FollowWatcher from './FollowWatcher.svelte';
import { followed } from './followed.svelte.ts';

function game(id: number, black: string, white: string): GameChannel {
	return {
		id,
		type: 'ranked',
		players: { black: { name: black, rank: '1k' }, white: { name: white, rank: '4k' } }
	} as GameChannel;
}

function setGames(games: Array<GameChannel>) {
	app.state = { ...app.state, activeGames: games };
	flushSync();
}

describe('FollowWatcher', () => {
	const shown: Array<{ title: string; body?: string }> = [];
	const original = window.Notification;

	beforeEach(() => {
		shown.length = 0;
		localStorage.clear();
		localStorage.setItem('gotv.reminders', '1');
		class FakeNotification {
			static permission = 'granted';
			constructor(title: string, options?: { body?: string }) {
				shown.push({ title, body: options?.body });
			}
		}
		vi.stubGlobal('Notification', FakeNotification);
		followed.names = ['arndt'];
		app.state = {
			...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
			currentUser: { name: 'andy1975', rank: '1d' }
		};
	});

	afterEach(() => {
		vi.stubGlobal('Notification', original);
	});

	it('announces a new game of a followed player, not the ones running at login', async () => {
		await render(FollowWatcher);
		setGames([game(1, 'arndt', 'pem')]); // first list after login: already running
		expect(shown).toEqual([]);

		setGames([game(1, 'arndt', 'pem'), game(2, 'x', 'y')]);
		expect(shown).toEqual([]);

		setGames([game(1, 'arndt', 'pem'), game(3, 'sandora', 'arndt')]);
		expect(shown).toHaveLength(1);
		expect(shown[0].title).toBe('arndt spielt jetzt auf KGS');
		expect(shown[0].body).toContain('gegen sandora');
	});

	it('stays quiet with reminders switched off', async () => {
		localStorage.setItem('gotv.reminders', '0');
		await render(FollowWatcher);
		setGames([game(1, 'a', 'b')]);
		setGames([game(1, 'a', 'b'), game(4, 'arndt', 'pem')]);
		expect(shown).toEqual([]);
	});
});
