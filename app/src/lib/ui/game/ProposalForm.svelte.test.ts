import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { getEvenProposal } from '#lib/model/game/challenge.ts';
import type { GameProposal } from '#lib/model/types.ts';
import {
	annaProposal,
	ENGLISH_ROOM,
	me,
	myProposal,
	roomsById,
	usersByName
} from '#lib/model/__fixtures__/challenge.ts';
import ProposalForm from './ProposalForm.svelte';

function callbacks() {
	return {
		onUserDetail: vi.fn(),
		onChangeProposal: vi.fn(),
		onChangeNotes: vi.fn(),
		onChangeVisibility: vi.fn(),
		onChangeRoomId: vi.fn()
	};
}

function lastProposal(cb: ReturnType<typeof callbacks>): GameProposal {
	return cb.onChangeProposal.mock.lastCall?.[0] as GameProposal;
}

// Answering Anna's challenge as 3k against her 2d: 4 stones handicap.
const even = getEvenProposal(annaProposal, 'gotvfan', usersByName);

describe('ProposalForm', () => {
	it('shows the fields of a proposal while negotiating', async () => {
		await render(ProposalForm, {
			currentUser: me,
			editMode: 'negotiating',
			proposal: even,
			prevProposal: annaProposal,
			notes: 'Gern mit Besprechung',
			visibility: 'roomOnly',
			usersByName,
			roomsById,
			room: roomsById[ENGLISH_ROOM],
			...callbacks()
		});
		await expect.element(page.getByRole('button', { name: 'Weiß – Farbe wechseln' })).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Schwarz – Farbe wechseln' }))
			.toBeVisible();
		await expect.element(page.getByRole('button', { name: /anna/ })).toBeVisible();
		await expect.element(page.getByText('English Game Room')).toBeVisible();
		await expect.element(page.getByText('Freie Partie')).toBeVisible();
		await expect.element(page.getByText('– Gern mit Besprechung')).toBeVisible();
		await expect.element(page.getByText('20:00 + 5×0:30')).toBeVisible();
		await expect.element(page.getByText('Japanische Regeln')).toBeVisible();
		await expect.element(page.getByText('19×19')).toBeVisible();
		await expect
			.element(page.getByRole('group', { name: 'Vorgabe' }).getByRole('status'))
			.toHaveTextContent('4');
		await expect
			.element(page.getByRole('group', { name: 'Komi' }).getByRole('status'))
			.toHaveTextContent('0,5');
	});

	it('reports edited handicap, komi and swapped colours', async () => {
		const cb = callbacks();
		await render(ProposalForm, {
			currentUser: me,
			editMode: 'negotiating',
			proposal: even,
			prevProposal: annaProposal,
			notes: '',
			visibility: 'public',
			usersByName,
			roomsById,
			room: roomsById[ENGLISH_ROOM],
			...cb
		});
		await page.getByRole('button', { name: 'Vorgabe verringern' }).click();
		expect(lastProposal(cb).rules).toMatchObject({ handicap: 3, komi: 0.5 });
		await page.getByRole('button', { name: 'Komi erhöhen' }).click();
		expect(lastProposal(cb).rules.komi).toBe(6.5);
		// Anna is white: a click on her colour makes her black, me white
		await page.getByRole('button', { name: 'Weiß – Farbe wechseln' }).click();
		expect(lastProposal(cb).players).toEqual([
			{ role: 'black', name: 'anna' },
			{ role: 'white', name: 'gotvfan' }
		]);
	});

	it('locks handicap and komi while waiting', async () => {
		await render(ProposalForm, {
			currentUser: me,
			editMode: 'waiting',
			proposal: even,
			prevProposal: null,
			notes: '',
			visibility: 'public',
			usersByName,
			roomsById,
			room: roomsById[ENGLISH_ROOM],
			...callbacks()
		});
		await expect.element(page.getByRole('button', { name: 'Komi erhöhen' })).toBeDisabled();
		await expect.element(page.getByRole('button', { name: 'Vorgabe verringern' })).toBeDisabled();
	});

	it('offers every setting when creating a challenge', async () => {
		const cb = callbacks();
		await render(ProposalForm, {
			currentUser: me,
			editMode: 'creating',
			proposal: myProposal,
			notes: '',
			visibility: 'public',
			usersByName,
			roomsById,
			room: roomsById[ENGLISH_ROOM],
			...cb
		});
		await expect.element(page.getByRole('combobox', { name: 'Raum' })).toHaveValue('11');
		await expect
			.element(page.getByRole('combobox', { name: 'Art der Partie' }))
			.toHaveValue('ranked');
		await expect.element(page.getByRole('combobox', { name: 'Zeit' })).toHaveValue('byo_yomi');
		await expect.element(page.getByRole('combobox', { name: 'Regeln' })).toHaveValue('japanese');
		await expect.element(page.getByRole('group', { name: 'Perioden' })).toBeVisible();

		await page.getByRole('combobox', { name: 'Zeit' }).selectOptions('canadian');
		expect(lastProposal(cb).rules).toMatchObject({
			timeSystem: 'canadian',
			byoYomiStones: 25,
			byoYomiTime: 420
		});
		// Private games cannot be ranked
		await page.getByRole('combobox', { name: 'Sichtbarkeit' }).selectOptions('private');
		expect(lastProposal(cb).gameType).toBe('free');
		expect(cb.onChangeVisibility).toHaveBeenLastCalledWith('private');
		await page.getByRole('combobox', { name: 'Raum' }).selectOptions('Deutscher Spielraum');
		expect(cb.onChangeRoomId).toHaveBeenLastCalledWith(12);
	});
});
