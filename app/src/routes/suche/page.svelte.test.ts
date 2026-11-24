import { page, userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { app } from '#lib/app.svelte.ts';
import type { AppActions } from '#lib/model/AppActions.ts';
import { getInitialState } from '#lib/model/appState.ts';
import type { User } from '#lib/model/types.ts';
import Page from './+page.svelte';

const me: User = { name: 'gotvfan', rank: '3k', rankVal: -3, flags: { connected: true } };
const anna: User = { name: 'anna', rank: '2d', rankVal: 2, flags: { connected: true } };
const annika: User = { name: 'Annika', rank: '5k', rankVal: -5, flags: { connected: false } };

function setup() {
	const fake = { onUserDetail: vi.fn() } as unknown as AppActions;
	app.state = {
		...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
		initialized: true,
		currentUser: me,
		usersByName: { gotvfan: me, anna, Annika: annika }
	};
	app._actions = fake;
	return fake;
}

describe('Suche', () => {
	afterEach(() => {
		app._actions = null;
		app.state = getInitialState({ status: 'loggedOut', network: 'online', retryTimes: 0 });
	});

	it('opens the profile of the typed name in lower case', async () => {
		const fake = setup();
		await render(Page);
		const input = page.getByRole('textbox', { name: 'Benutzername' });
		await input.fill('  ');
		await userEvent.keyboard('{Enter}');
		expect(fake.onUserDetail).not.toHaveBeenCalled();

		await input.fill('ShinSan');
		await page.getByRole('button', { name: 'Profil ansehen' }).click();
		expect(fake.onUserDetail).toHaveBeenCalledWith('shinsan');
	});

	it('lists matching known users, strongest first, and opens one', async () => {
		const fake = setup();
		await render(Page);
		await page.getByRole('textbox', { name: 'Benutzername' }).fill('ann');
		const list = page.getByRole('region', { name: 'Gefundene Spieler' });
		const names = list.getByRole('button');
		await expect.element(names.nth(0)).toHaveTextContent('anna[2d]');
		await expect.element(names.nth(1)).toHaveTextContent('Annika[5k]');
		await expect.element(list.getByRole('button', { name: /gotvfan/ })).not.toBeInTheDocument();

		await list.getByRole('button', { name: /^Annika/ }).click();
		expect(fake.onUserDetail).toHaveBeenCalledWith('Annika');
	});
});
