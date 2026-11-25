import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { app } from '#lib/app.svelte.ts';
import type { AppActions } from '#lib/model/AppActions.ts';
import { getInitialState } from '#lib/model/appState.ts';
import { parseSgf } from '#lib/model/sgf.ts';
import type { AppState, GameChannel } from '#lib/model/types.ts';
import {
	anna,
	annaChallenge,
	ANNA_CHALLENGE,
	ENGLISH_ROOM,
	GERMAN_ROOM,
	me,
	roomsById,
	summaries,
	usersByName
} from '#lib/model/__fixtures__/challenge.ts';
import Page from './+page.svelte';

function fixtureState(extra: Partial<AppState> = {}): AppState {
	const initial = getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 });
	return {
		...initial,
		initialized: true,
		nav: 'play',
		currentUser: me,
		usersByName,
		roomsById,
		channelMembership: {
			[ENGLISH_ROOM]: { type: 'room', complete: true, stale: false },
			[GERMAN_ROOM]: { type: 'room', complete: true, stale: false }
		},
		gamesById: { [ANNA_CHALLENGE]: annaChallenge },
		challenges: [annaChallenge],
		unfinishedGames: summaries.map((game) => ({ type: 'summary' as const, game })),
		...extra
	};
}

function mockActions() {
	const actions = {
		onSelectChallenge: vi.fn(),
		onCloseChallenge: vi.fn(),
		onCreateChallenge: vi.fn(),
		onShowGames: vi.fn(),
		onJoinGame: vi.fn(),
		onShowUnderConstruction: vi.fn(),
		onLoadGame: vi.fn(),
		onLeaveGame: vi.fn(),
		onUserDetail: vi.fn(),
		onPass: vi.fn(),
		onChangeCurrentNode: vi.fn()
	};
	app._actions = actions as unknown as AppActions;
	return actions;
}

describe('Spielen page', () => {
	beforeEach(async () => {
		await page.viewport(1180, 820);
		app.state = fixtureState();
	});

	afterEach(() => {
		app._actions = null;
	});

	it('lists open challenges and unfinished games', async () => {
		const actions = mockActions();
		await render(Page);
		const unfinished = page.getByRole('region', { name: 'Nicht beendete Partien' });
		await unfinished.getByRole('button', { name: /Läuft gerade/ }).click();
		expect(actions.onJoinGame).toHaveBeenCalledWith(summaries[1].timestamp);
		await unfinished.getByRole('button', { name: /Aufgabe/ }).click();
		await expect.element(page.getByRole('dialog', { name: 'Nicht beendete Partie' })).toBeVisible();
		await page.getByRole('button', { name: 'Schließen' }).click();

		const challenges = page.getByRole('region', { name: 'Offene Herausforderungen' });
		await challenges.getByRole('button', { name: /anna/ }).click();
		expect(actions.onSelectChallenge).toHaveBeenCalledWith(ANNA_CHALLENGE);
	});

	it('resumes an unfinished game by loading it into a room', async () => {
		const actions = mockActions();
		app.state = fixtureState({
			conversationsById: {
				[ENGLISH_ROOM]: { messages: [] }
			} as unknown as AppState['conversationsById']
		});
		await render(Page);
		const unfinished = page.getByRole('region', { name: 'Nicht beendete Partien' });
		await unfinished.getByRole('button', { name: /Aufgabe/ }).click();
		const dialog = page.getByRole('dialog', { name: 'Nicht beendete Partie' });
		await expect.element(dialog.getByText('English Game Room')).toBeVisible();
		await expect.element(dialog.getByLabelText('Privat')).not.toBeInTheDocument();
		await dialog.getByRole('button', { name: 'Partie fortsetzen' }).click();
		expect(actions.onLoadGame).toHaveBeenCalledWith(summaries[0].timestamp, ENGLISH_ROOM, false);

		// KGS cannot load it: say so and offer another try.
		app.state = { ...app.state, loadFailed: summaries[0].timestamp };
		await expect.element(dialog.getByText('KGS konnte die Partie nicht laden.')).toBeVisible();
		await dialog.getByRole('button', { name: 'Erneut versuchen' }).click();
		await expect.element(dialog.getByRole('button', { name: 'Partie fortsetzen' })).toBeVisible();
	});

	it('opens the editor for a new challenge and closes it again', async () => {
		mockActions();
		await render(Page);
		await page.getByRole('button', { name: 'Herausforderung erstellen' }).click();
		const dialog = page.getByRole('dialog', { name: 'Herausforderung erstellen' });
		await expect.element(dialog).toBeVisible();
		await expect.element(dialog.getByRole('combobox', { name: 'Raum' })).toHaveValue('11');
		await dialog.getByRole('button', { name: 'Abbrechen' }).click();
		await expect.element(dialog).not.toBeInTheDocument();
	});

	it('shows the selected challenge and closes it through the app', async () => {
		const actions = mockActions();
		app.state = fixtureState({ playChallengeId: ANNA_CHALLENGE });
		await render(Page);
		const dialog = page.getByRole('dialog', { name: 'Herausforderung' });
		await expect.element(dialog.getByRole('button', { name: 'Vorschlag senden' })).toBeVisible();
		await dialog.getByRole('button', { name: 'Schließen' }).click();
		expect(actions.onCloseChallenge).toHaveBeenCalledWith(ANNA_CHALLENGE);
	});

	it('shows the own game once it has started', async () => {
		mockActions();
		const tree = parseSgf('(;GM[1]SZ[9];B[cg];W[gc])');
		const last = tree.currentLine[tree.currentLine.length - 1];
		const game: GameChannel = {
			id: 900,
			type: 'free',
			time: 3,
			moveNum: 2,
			roomId: ENGLISH_ROOM,
			players: { white: anna, black: me },
			rules: { size: 9, komi: 6.5, timeSystem: 'absolute', mainTime: 600 },
			actions: [{ action: 'MOVE', user: { name: 'gotvfan' } }],
			tree: { ...tree, activeNode: last, currentNode: last }
		};
		app.state = fixtureState({ playGameId: 900, gamesById: { 900: game } });
		await render(Page);
		await expect.element(page.getByRole('button', { name: 'Passen' })).toBeVisible();
		await expect
			.element(page.getByRole('region', { name: 'Offene Herausforderungen' }))
			.not.toBeInTheDocument();
	});
});
