import { page, userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { app } from '#lib/app.svelte.ts';
import type { AppActions } from '#lib/model/AppActions.ts';
import { getInitialState } from '#lib/model/appState.ts';
import { parseRankGraph } from '#lib/model/user.ts';
import type { AppState, GameSummary, User, UserDetails } from '#lib/model/types.ts';
import UserDetailsModal from './UserDetailsModal.svelte';

function details(channelId: number, extra: Partial<UserDetails> = {}): UserDetails {
	return {
		channelId,
		forcedNoRank: false,
		privateEmail: false,
		emailWanted: false,
		rankWanted: true,
		lastOn: '2026-11-20T18:00:00Z',
		regStartDate: '2015-03-01T12:00:00Z',
		personalName: '',
		personalInfo: '',
		locale: 'de_DE',
		...extra
	};
}

const me: User = {
	name: 'gotvfan',
	rank: '3k',
	flags: { connected: true },
	details: details(70, { personalName: 'Andi', email: 'andi@example.org' })
};
const anna: User = {
	name: 'anna',
	rank: '2d',
	flags: { connected: true },
	details: details(71, {
		personalName: 'Anna Berg',
		personalInfo: 'Spielt gern schnell.',
		email: 'anna@example.org'
	})
};

const rules = { size: 19, komi: 6.5 };
const games: Array<GameSummary> = [
	{
		timestamp: '2026-11-24T18:00:00.000Z',
		type: 'ranked',
		rules,
		players: { white: anna, black: me },
		inPlay: true
	},
	{
		timestamp: '2026-11-20T18:00:00.000Z',
		type: 'free',
		rules,
		players: { white: anna, black: me },
		score: -6.5
	}
];

function actions(): AppActions {
	return {
		onCloseUserDetail: vi.fn(),
		onRequestRankGraph: vi.fn(),
		onStartChat: vi.fn(),
		onJoinGame: vi.fn(),
		onLoadGame: vi.fn(),
		onLeaveGame: vi.fn(),
		onUpdateProfileDetails: vi.fn(),
		onUpdatePassword: vi.fn(),
		onUserDetail: vi.fn()
	} as unknown as AppActions;
}

function setup(state: Partial<AppState>): AppActions {
	const fakeActions = actions();
	app.state = {
		...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
		initialized: true,
		currentUser: me,
		usersByName: { gotvfan: me, anna },
		...state
	};
	app._actions = fakeActions;
	return fakeActions;
}

describe('UserDetailsModal', () => {
	afterEach(() => {
		app._actions = null;
		app.state = getInitialState({ status: 'loggedOut', network: 'online', retryTimes: 0 });
	});

	it('shows the details of another user and starts a chat', async () => {
		const fake = setup({ userDetailsRequest: { name: 'anna', status: 'received' } });
		await render(UserDetailsModal);
		const dialog = page.getByRole('dialog', { name: 'Spielerprofil' });
		await expect.element(dialog.getByText('Anna Berg')).toBeVisible();
		await expect.element(dialog.getByText(/^Online$/)).toBeVisible();
		await expect.element(dialog.getByText(/Dabei seit/)).toBeVisible();
		await expect.element(dialog.getByText('Deutsch / Deutschland')).toBeVisible();
		await expect
			.element(dialog.getByRole('link', { name: 'anna@example.org' }))
			.toHaveAttribute('href', 'mailto:anna@example.org');
		await expect.element(dialog.getByText('Spielt gern schnell.')).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Profil bearbeiten' }))
			.not.toBeInTheDocument();

		await page.getByRole('button', { name: 'Nachricht senden' }).click();
		expect(fake.onStartChat).toHaveBeenCalledWith(anna);
	});

	it('requests the rank graph and draws it', async () => {
		const fake = setup({
			userDetailsRequest: { name: 'anna', status: 'received' },
			rankGraphsByChannelId: { 71: parseRankGraph([-150, -120, -80, -20, 30, 80]) }
		});
		await render(UserDetailsModal);
		await page.getByRole('tab', { name: 'Rang' }).click();
		expect(fake.onRequestRankGraph).toHaveBeenCalledWith(71);
		await expect
			.element(page.getByRole('img', { name: /Rangverlauf der letzten 6 Tage, zuletzt etwa 2d/ }))
			.toBeVisible();
		await expect.element(page.getByText('2k', { exact: true })).toBeVisible();
	});

	it('says so when there is no rank graph, and waits while it loads', async () => {
		setup({
			userDetailsRequest: { name: 'anna', status: 'received' },
			rankGraphsByChannelId: { 71: parseRankGraph([]) }
		});
		await render(UserDetailsModal);
		await page.getByRole('tab', { name: 'Rang' }).click();
		await expect
			.element(page.getByText('Für diesen Spieler gibt es keinen Rangverlauf.'))
			.toBeVisible();

		app.state = { ...app.state, rankGraphsByChannelId: {} };
		await expect.element(page.getByText('Rangverlauf lädt …')).toBeVisible();
	});

	it('shows "not found" and a spinner while loading', async () => {
		setup({ userDetailsRequest: { name: 'niemand', status: 'pending' } });
		await render(UserDetailsModal);
		await expect.element(page.getByText('Profil lädt …')).toBeVisible();

		app.state = { ...app.state, userDetailsRequest: { name: 'niemand', status: 'nonexistant' } };
		await expect.element(page.getByText('Spieler „niemand“ nicht gefunden.')).toBeVisible();
	});

	it('closes with the close button', async () => {
		const fake = setup({ userDetailsRequest: { name: 'anna', status: 'received' } });
		await render(UserDetailsModal);
		await page.getByRole('button', { name: 'Schließen' }).click();
		expect(fake.onCloseUserDetail).toHaveBeenCalled();
	});

	it('joins a game in play and offers to load a finished one', async () => {
		const fake = setup({
			userDetailsRequest: { name: 'anna', status: 'received' },
			gameSummariesByUser: { anna: games },
			conversationsById: { 5: { id: 5, messages: [], status: 'created' } },
			roomsById: {
				5: {
					id: 5,
					name: 'Deutscher Raum',
					description: null,
					owners: null,
					users: null,
					category: 'NATIONAL'
				}
			}
		});
		await render(UserDetailsModal);
		await page.getByRole('tab', { name: '2 Partien' }).click();
		await page.getByRole('button', { name: /Läuft gerade/ }).click();
		expect(fake.onCloseUserDetail).toHaveBeenCalled();
		expect(fake.onJoinGame).toHaveBeenCalledWith('2026-11-24T18:00:00.000Z');

		await page.getByRole('button', { name: /W\+6[.,]5/ }).click();
		const summary = page.getByRole('dialog', { name: 'Partie aus dem Archiv' });
		await expect.element(summary.getByText('Deutscher Raum')).toBeVisible();
		await summary.getByRole('button', { name: 'Partie laden' }).click();
		expect(fake.onLoadGame).toHaveBeenCalledWith('2026-11-20T18:00:00.000Z', 5, true);
		await expect.element(summary.getByText('Partie wird geladen …')).toBeVisible();

		// KGS opens the loaded game as a review: join it and close the profile.
		vi.mocked(fake.onCloseUserDetail).mockClear();
		app.state = { ...app.state, reviewGameId: 900 };
		await vi.waitFor(() => expect(fake.onJoinGame).toHaveBeenCalledWith(900));
		expect(fake.onCloseUserDetail).toHaveBeenCalled();
	});

	it('loads a finished game also while KGS still has it open', async () => {
		const finishedOpen: GameSummary = {
			timestamp: '2026-11-25T19:25:00.000Z',
			type: 'ranked',
			rules,
			players: { white: anna, black: me },
			score: 'B+RESIGN',
			inPlay: true
		};
		const fake = setup({
			userDetailsRequest: { name: 'anna', status: 'received' },
			gameSummariesByUser: { anna: [finishedOpen] },
			conversationsById: { 5: { id: 5, messages: [], status: 'created' } },
			roomsById: {
				5: {
					id: 5,
					name: 'Deutscher Raum',
					description: null,
					owners: null,
					users: null,
					category: 'NATIONAL'
				}
			}
		});
		await render(UserDetailsModal);
		await page.getByRole('tab', { name: '1 Partie' }).click();
		await page.getByRole('button', { name: /Aufgabe/ }).click();
		const summary = page.getByRole('dialog', { name: 'Partie aus dem Archiv' });
		await expect.element(summary.getByRole('button', { name: 'Partie laden' })).toBeVisible();
		expect(fake.onJoinGame).not.toHaveBeenCalled();
	});

	it('edits the own profile and sends the changes', async () => {
		const fake = setup({ userDetailsRequest: { name: 'gotvfan', status: 'received' } });
		await render(UserDetailsModal);
		await expect
			.element(page.getByRole('button', { name: 'Nachricht senden' }))
			.not.toBeInTheDocument();
		await page.getByRole('button', { name: 'Profil bearbeiten' }).click();

		const form = page.getByRole('dialog', { name: 'Profil bearbeiten' });
		await expect.element(form.getByRole('checkbox', { name: 'Mit Rang spielen' })).toBeChecked();
		await form.getByRole('textbox', { name: 'Name' }).fill('Andreas');
		await form.getByRole('textbox', { name: 'E-Mail' }).fill('neu@example.org');
		await form.getByRole('textbox', { name: 'Über mich' }).fill('Kyu aus Köln');
		await form.getByRole('checkbox', { name: /verbergen/ }).click();
		await form.getByRole('button', { name: 'Änderungen speichern' }).click();

		expect(fake.onUpdateProfileDetails).toHaveBeenCalledWith(
			me,
			expect.objectContaining({
				channelId: 70,
				personalName: 'Andreas',
				email: 'neu@example.org',
				personalInfo: 'Kyu aus Köln',
				privateEmail: true,
				rankWanted: true
			})
		);
		expect(fake.onUpdatePassword).not.toHaveBeenCalled();
		// Switching between profile and form never closed the profile.
		expect(fake.onCloseUserDetail).not.toHaveBeenCalled();
		await expect.element(page.getByRole('dialog', { name: 'Spielerprofil' })).toBeVisible();
	});

	it('goes back from the form to the profile with Esc', async () => {
		const fake = setup({ userDetailsRequest: { name: 'gotvfan', status: 'received' } });
		await render(UserDetailsModal);
		await page.getByRole('button', { name: 'Profil bearbeiten' }).click();
		await expect.element(page.getByRole('dialog', { name: 'Profil bearbeiten' })).toBeVisible();
		await userEvent.keyboard('{Escape}');
		await expect.element(page.getByRole('dialog', { name: 'Spielerprofil' })).toBeVisible();
		expect(fake.onCloseUserDetail).not.toHaveBeenCalled();
		await userEvent.keyboard('{Escape}');
		await vi.waitFor(() => expect(fake.onCloseUserDetail).toHaveBeenCalled());
	});

	it('changes the password only when a new one is typed', async () => {
		const fake = setup({ userDetailsRequest: { name: 'gotvfan', status: 'received' } });
		await render(UserDetailsModal);
		await page.getByRole('button', { name: 'Profil bearbeiten' }).click();
		await page.getByLabelText('Neues Passwort').fill('geheim123');
		await page.getByRole('button', { name: 'Änderungen speichern' }).click();
		expect(fake.onUpdatePassword).toHaveBeenCalledWith(me, 'geheim123');
	});
});
