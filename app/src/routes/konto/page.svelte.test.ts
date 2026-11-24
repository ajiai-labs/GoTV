import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { app } from '#lib/app.svelte.ts';
import type { AppActions } from '#lib/model/AppActions.ts';
import { getInitialState } from '#lib/model/appState.ts';
import type { User } from '#lib/model/types.ts';
import Page from './+page.svelte';

const me: User = { name: 'gotvfan', rank: '3k', flags: { connected: true } };

function setup() {
	const fake = {
		onUserDetail: vi.fn(),
		onLogout: vi.fn(),
		onShowFeedbackModal: vi.fn()
	} as unknown as AppActions;
	app.state = {
		...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
		initialized: true,
		currentUser: me,
		usersByName: { gotvfan: me }
	};
	app._actions = fake;
	return fake;
}

describe('Konto', () => {
	afterEach(() => {
		app._actions = null;
		app.state = getInitialState({ status: 'loggedOut', network: 'online', retryTimes: 0 });
	});

	it('logs out', async () => {
		const fake = setup();
		await render(Page);
		await page.getByRole('button', { name: 'Abmelden' }).click();
		expect(fake.onLogout).toHaveBeenCalled();
	});

	it('opens the own profile from the name and from "Profil ansehen"', async () => {
		const fake = setup();
		await render(Page);
		await page.getByRole('button', { name: /^gotvfan/ }).click();
		await page.getByRole('button', { name: 'Profil ansehen' }).click();
		expect(fake.onUserDetail).toHaveBeenCalledTimes(2);
		expect(fake.onUserDetail).toHaveBeenCalledWith('gotvfan');
	});

	it('links to the settings, GoTV and KGS and opens the feedback', async () => {
		const fake = setup();
		await render(Page);
		await expect
			.element(page.getByRole('link', { name: 'Einstellungen' }))
			.toHaveAttribute('href', expect.stringMatching(/\/einstellungen$/));
		await expect
			.element(page.getByRole('link', { name: 'GoTV auf GitHub' }))
			.toHaveAttribute('href', 'https://github.com/ajiai-labs/GoTV');
		await expect
			.element(page.getByRole('link', { name: 'Offizielle KGS-Webseite' }))
			.toHaveAttribute('href', 'https://www.gokgs.com/');
		await expect.element(page.getByText(/Version \d+\.\d+\.\d+/)).toBeVisible();
		await page.getByRole('button', { name: 'Feedback senden' }).click();
		expect(fake.onShowFeedbackModal).toHaveBeenCalled();
	});
});
