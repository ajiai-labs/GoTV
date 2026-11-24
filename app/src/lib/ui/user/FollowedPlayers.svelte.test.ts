import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { app } from '#lib/app.svelte.ts';
import type { AppActions } from '#lib/model/AppActions.ts';
import { getInitialState } from '#lib/model/appState.ts';
import type { GameChannel } from '#lib/model/types.ts';
import FollowedPlayers from './FollowedPlayers.svelte';
import { followed } from './followed.svelte.ts';
import { language } from '#lib/i18n/index.svelte.ts';

const running = {
	id: 31,
	type: 'ranked',
	moveNum: 57,
	players: { black: { name: 'arndt', rank: '1k' }, white: { name: 'JiriK', rank: '4k' } }
} as GameChannel;

describe('FollowedPlayers', () => {
	let onJoinGame: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		localStorage.clear();
		followed.names = [];
		onJoinGame = vi.fn();
		app._actions = { onJoinGame } as unknown as AppActions;
		app.state = {
			...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
			currentUser: { name: 'andy1975', rank: '1d' },
			activeGames: [running]
		};
	});

	it('explains how to follow when nobody is followed', async () => {
		await render(FollowedPlayers);
		await expect.element(page.getByText(/im Profil „Folgen“ wählen/)).toBeVisible();
	});

	it('shows who plays right now and opens the game', async () => {
		followed.toggle('ARNDT');
		followed.toggle('sandora');
		await render(FollowedPlayers);
		await expect.element(page.getByText('spielt gegen JiriK [4k] · Zug 57')).toBeVisible();
		await expect.element(page.getByText('gerade keine Partie')).toBeVisible();
		await page.getByRole('button', { name: 'Ansehen' }).click();
		expect(onJoinGame).toHaveBeenCalledWith(31);
		expect(JSON.parse(localStorage.getItem('gotv.followedPlayers')!)).toEqual(['sandora', 'ARNDT']);
	});

	it('unfollows with the star', async () => {
		followed.toggle('sandora');
		await render(FollowedPlayers);
		await page.getByRole('button', { name: 'sandora nicht mehr folgen' }).click();
		await expect.element(page.getByText(/im Profil „Folgen“ wählen/)).toBeVisible();
	});

	it('speaks English when English is chosen', async () => {
		language.current = 'en';
		followed.toggle('ARNDT');
		await render(FollowedPlayers);
		await expect.element(page.getByRole('heading', { name: 'Followed players' })).toBeVisible();
		await expect.element(page.getByText('playing JiriK [4k] · move 57')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Unfollow ARNDT' })).toBeVisible();
	});
});
