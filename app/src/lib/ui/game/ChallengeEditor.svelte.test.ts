import { page, userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { app } from '#lib/app.svelte.ts';
import type { AppActions } from '#lib/model/AppActions.ts';
import type { GameProposal } from '#lib/model/types.ts';
import {
	annaChallenge,
	ANNA_CHALLENGE,
	ENGLISH_ROOM,
	fromAnna,
	me,
	myChallenge,
	MY_CHALLENGE,
	roomsById,
	usersByName
} from '#lib/model/__fixtures__/challenge.ts';
import ChallengeEditor from './ChallengeEditor.svelte';

function mockActions() {
	const actions = {
		onCreateChallenge: vi.fn(),
		onSubmitChallengeProposal: vi.fn(),
		onAcceptChallengeProposal: vi.fn(),
		onDeclineChallengeProposal: vi.fn(),
		onAcceptCounterProposal: vi.fn(),
		markConversationSeen: vi.fn(),
		onSendChat: vi.fn(),
		onUserDetail: vi.fn()
	};
	app._actions = actions as unknown as AppActions;
	return actions;
}

const base = {
	currentUser: me,
	usersByName,
	roomsById,
	initialRoomId: ENGLISH_ROOM,
	preferences: {}
};

describe('ChallengeEditor', () => {
	afterEach(() => {
		app._actions = null;
	});

	it('creates a challenge with the old payload and then waits', async () => {
		const actions = mockActions();
		await render(ChallengeEditor, { ...base, challenge: null, onCancel: vi.fn() });
		await page.getByRole('textbox', { name: 'Hinweis' }).fill('Bitte langsam');
		await page.getByRole('combobox', { name: 'Art der Partie' }).selectOptions('free');
		await page.getByRole('button', { name: 'Brett verringern' }).click();
		await page.getByRole('button', { name: 'Herausforderung erstellen' }).click();

		expect(actions.onCreateChallenge).toHaveBeenCalledTimes(1);
		const [proposal, roomId, visibility, notes] = actions.onCreateChallenge.mock.calls[0] as [
			GameProposal,
			number,
			string,
			string
		];
		expect(proposal).toEqual({
			gameType: 'free',
			nigiri: true,
			players: [{ name: 'gotvfan', role: 'white' }, { role: 'black' }],
			rules: {
				komi: 6.5,
				size: 13,
				rules: 'japanese',
				timeSystem: 'byo_yomi',
				mainTime: 1200,
				byoYomiPeriods: 5,
				byoYomiTime: 30
			}
		});
		expect(roomId).toBe(ENGLISH_ROOM);
		expect(visibility).toBe('public');
		expect(notes).toBe('Bitte langsam');
		await expect
			.element(page.getByRole('button', { name: 'Warte auf Herausforderer' }))
			.toBeDisabled();
	});

	it('sends the edited proposal for a challenge of someone else', async () => {
		const actions = mockActions();
		const onCancel = vi.fn();
		await render(ChallengeEditor, { ...base, challenge: annaChallenge, onCancel });
		await page.getByRole('button', { name: 'Vorgabe verringern' }).click();
		await page.getByRole('button', { name: 'Vorschlag senden' }).click();
		expect(actions.onSubmitChallengeProposal).toHaveBeenCalledTimes(1);
		const [challengeId, sent] = actions.onSubmitChallengeProposal.mock.calls[0] as [
			number,
			GameProposal
		];
		expect(challengeId).toBe(ANNA_CHALLENGE);
		expect(sent.gameType).toBe('free');
		expect(sent.nigiri).toBe(false);
		expect(sent.rules.handicap).toBe(3);
		expect(sent.rules.komi).toBe(0.5);
		expect(sent.players).toEqual([
			{ role: 'white', name: 'anna' },
			{ role: 'black', name: 'gotvfan' }
		]);
		await page.getByRole('button', { name: 'Abbrechen' }).click();
		expect(onCancel).toHaveBeenCalled();
	});

	it('shows changed terms from the creator to accept or decline', async () => {
		const actions = mockActions();
		const onCancel = vi.fn();
		const sent: GameProposal = {
			...annaChallenge.initialProposal!,
			status: 'pending',
			players: [
				{ role: 'white', name: 'anna' },
				{ role: 'black', name: 'gotvfan' }
			]
		};
		const counter: GameProposal = {
			...sent,
			status: undefined,
			rules: { ...sent.rules, komi: 0.5 }
		};
		await render(ChallengeEditor, {
			...base,
			challenge: { ...annaChallenge, sentProposal: sent, counterProposal: counter },
			onCancel
		});
		await expect
			.element(
				page.getByText('anna hat die Bedingungen geändert, die Änderungen sind hervorgehoben.')
			)
			.toBeVisible();
		await page.getByRole('button', { name: 'Annehmen' }).click();
		expect(actions.onAcceptCounterProposal).toHaveBeenCalledWith(ANNA_CHALLENGE);
		await page.getByRole('button', { name: 'Ablehnen' }).click();
		expect(onCancel).toHaveBeenCalled();
	});

	it('accepts and declines received proposals, browsing between them', async () => {
		const actions = mockActions();
		await render(ChallengeEditor, { ...base, challenge: myChallenge, onCancel: vi.fn() });
		await expect.element(page.getByRole('button', { name: 'Vorheriger Vorschlag' })).toBeDisabled();
		await page.getByRole('button', { name: 'Annehmen' }).click();
		expect(actions.onAcceptChallengeProposal).toHaveBeenCalledWith(MY_CHALLENGE, fromAnna);

		await page.getByRole('button', { name: 'Nächster Vorschlag' }).click();
		await expect.element(page.getByRole('button', { name: /bernd/ })).toBeVisible();
		await page.getByRole('button', { name: 'Ablehnen' }).click();
		expect(actions.onDeclineChallengeProposal).toHaveBeenCalledWith(MY_CHALLENGE, 'bernd');
	});

	it('marks the chat as seen and sends messages', async () => {
		const actions = mockActions();
		await render(ChallengeEditor, {
			...base,
			challenge: myChallenge,
			conversation: {
				id: MY_CHALLENGE,
				status: 'created',
				unseenCount: 1,
				messages: [{ id: '1', sender: 'anna', body: 'Hallo!', date: new Date() }]
			},
			onCancel: vi.fn()
		});
		await page.getByRole('tab', { name: /Chat/ }).click();
		expect(actions.markConversationSeen).toHaveBeenCalledWith(MY_CHALLENGE);
		await expect.element(page.getByText('Hallo!')).toBeVisible();
		await page.getByRole('textbox', { name: 'Chatnachricht' }).fill('Gern');
		await userEvent.keyboard('{Enter}');
		expect(actions.onSendChat).toHaveBeenCalledWith('Gern', MY_CHALLENGE);
	});
});
