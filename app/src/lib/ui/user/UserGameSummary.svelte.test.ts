import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { summaries, roomsById, ENGLISH_ROOM } from '#lib/model/__fixtures__/challenge.ts';
import UserGameSummary from './UserGameSummary.svelte';

function props() {
	return {
		activeConversationId: null,
		game: summaries[0],
		onCloseUserDetail: vi.fn(),
		onJoinGame: vi.fn(),
		onLoadGame: vi.fn(),
		onLeaveGame: vi.fn(),
		reviewGameId: null,
		rooms: [roomsById[ENGLISH_ROOM]],
		onOpenReplay: vi.fn()
	};
}

describe('UserGameSummary', () => {
	it('loads a finished game privately and opens it on Nachspielen', async () => {
		const p = props();
		const screen = await render(UserGameSummary, p);
		await page.getByRole('button', { name: 'In GoTV nachspielen' }).click();
		expect(p.onLoadGame).toHaveBeenCalledWith(summaries[0].timestamp, ENGLISH_ROOM, true);
		// KGS reports the new review: it goes to Nachspielen, not to Beobachten.
		await screen.rerender({ reviewGameId: 920 });
		await vi.waitFor(() => expect(p.onOpenReplay).toHaveBeenCalledWith(920));
		expect(p.onCloseUserDetail).toHaveBeenCalled();
		expect(p.onJoinGame).not.toHaveBeenCalled();
	});

	it('still loads a game as a KGS review', async () => {
		const p = props();
		const screen = await render(UserGameSummary, p);
		await page.getByRole('button', { name: 'Partie laden' }).click();
		expect(p.onLoadGame).toHaveBeenCalledWith(summaries[0].timestamp, ENGLISH_ROOM, true);
		await screen.rerender({ reviewGameId: 921 });
		await vi.waitFor(() => expect(p.onJoinGame).toHaveBeenCalledWith(921));
		expect(p.onOpenReplay).not.toHaveBeenCalled();
	});

	it('offers the SGF from the KGS archive, also without a room', async () => {
		const p = props();
		const game = {
			...summaries[0],
			timestamp: '2026-11-25T19:25:00.000Z',
			score: 24.5,
			private: false
		};
		await render(UserGameSummary, { ...p, game, rooms: [] });
		const link = page.getByRole('link', { name: 'SGF herunterladen' });
		await expect.element(link).toBeVisible();
		expect(link.element().getAttribute('href')).toMatch(
			/^https:\/\/files\.gokgs\.com\/games\/2026\/11\/25\/.+\.sgf$/
		);
	});

	it('has no SGF link for a private game', async () => {
		const p = props();
		await render(UserGameSummary, { ...p, game: { ...summaries[0], score: 24.5, private: true } });
		await expect
			.element(page.getByRole('link', { name: 'SGF herunterladen' }))
			.not.toBeInTheDocument();
	});

	it('saves our comment on the game', async () => {
		const p = props();
		const onTag = vi.fn();
		const screen = await render(UserGameSummary, { ...p, tag: 'alt', onTag });
		const field = page.getByLabelText(/Dein Kommentar/);
		await expect.element(field).toHaveValue('alt');
		await field.fill('Fehler im Yose');
		await page.getByRole('button', { name: 'Speichern' }).click();
		expect(onTag).toHaveBeenCalledWith(summaries[0], 'Fehler im Yose');
		await screen.rerender({ tagStatus: 'saving' });
		await expect.element(page.getByText('Wird gespeichert …')).toBeVisible();
		await screen.rerender({ tagStatus: 'saved' });
		await expect.element(page.getByText('Kommentar gespeichert.')).toBeVisible();
	});

	it('says when the comment failed and lets you try again', async () => {
		const p = props();
		const onTag = vi.fn();
		const screen = await render(UserGameSummary, { ...p, onTag });
		await page.getByLabelText(/Dein Kommentar/).fill('Yose');
		await page.getByRole('button', { name: 'Speichern' }).click();
		await screen.rerender({ tagStatus: 'failed' });
		await expect.element(page.getByText(/Kommentar nicht gespeichert/)).toBeVisible();
		await page.getByRole('button', { name: 'Speichern' }).click();
		expect(onTag).toHaveBeenCalledTimes(2);
	});
});
