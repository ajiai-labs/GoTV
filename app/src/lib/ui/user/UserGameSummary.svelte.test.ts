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
});
