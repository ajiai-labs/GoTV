import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { app } from '#lib/app.svelte.ts';
import { getInitialState } from '#lib/model/appState.ts';
import type { AppActions } from '#lib/model/AppActions.ts';
import FriendLists from './FriendLists.svelte';
import Mailbox from './Mailbox.svelte';

function mockActions() {
	const actions = {
		onAddFriend: vi.fn(),
		onRemoveFriend: vi.fn(),
		onClearCommunityResult: vi.fn(),
		onUserDetail: vi.fn(),
		onDeleteMailbox: vi.fn(),
		onLeaveMessage: vi.fn()
	};
	app._actions = actions as unknown as AppActions;
	return actions;
}

describe('community', () => {
	beforeEach(() => {
		app.state = {
			...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
			friends: [
				{ type: 'buddy', name: 'thirdstep', rank: '2d', notes: 'Bundesliga' },
				{ type: 'censored', name: 'harakaki' }
			],
			mailbox: [{ time: '2026-11-25T18:00:00.000Z', from: 'thirdstep', text: 'Weiter morgen?' }]
		};
	});

	afterEach(() => {
		app._actions = null;
	});

	it('shows the friend lists and adds and removes names', async () => {
		const actions = mockActions();
		await render(FriendLists);
		await expect.element(page.getByText('Bundesliga')).toBeVisible();
		await page.getByRole('button', { name: 'thirdstep entfernen' }).click();
		expect(actions.onRemoveFriend).toHaveBeenCalledWith('buddy', 'thirdstep');

		await page.getByRole('tab', { name: /Ignorierliste/ }).click();
		await expect.element(page.getByRole('button', { name: 'harakaki' })).toBeVisible();
		await page.getByRole('textbox', { name: 'Name' }).fill('spammer');
		await page.getByRole('button', { name: 'Hinzufügen' }).click();
		expect(actions.onAddFriend).toHaveBeenCalledWith('censored', 'spammer', '');
	});

	it('shows messages left for us and leaves one', async () => {
		const actions = mockActions();
		await render(Mailbox);
		await expect.element(page.getByText('Weiter morgen?')).toBeVisible();
		await page.getByRole('button', { name: 'Gelesen – löschen' }).click();
		expect(actions.onDeleteMailbox).toHaveBeenCalled();

		await page.getByRole('textbox', { name: 'An' }).fill('guiguistar');
		await page.getByRole('textbox', { name: 'Nachricht' }).fill('Partie fortsetzen?');
		await page.getByRole('button', { name: 'Hinterlassen' }).click();
		expect(actions.onLeaveMessage).toHaveBeenCalledWith('guiguistar', 'Partie fortsetzen?');
		app.state = {
			...app.state,
			communityResult: { type: 'MESSAGE_CREATE_SUCCESS', at: Date.now() }
		};
		await expect.element(page.getByText('Die Nachricht wurde hinterlassen.')).toBeVisible();
	});
});
