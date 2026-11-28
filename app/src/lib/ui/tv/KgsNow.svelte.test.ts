import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { app } from '#lib/app.svelte.ts';
import type { AppActions } from '#lib/model/AppActions.ts';
import { getInitialState } from '#lib/model/appState.ts';
import { getKgsNowGroups } from '#lib/model/tv.ts';
import type { GameChannel, Index, Room } from '#lib/model/types.ts';
import KgsNow from './KgsNow.svelte';

function game(id: number, extra: Partial<GameChannel> = {}): GameChannel {
	return {
		id,
		type: 'tournament',
		roomId: 5,
		moveNum: 30,
		players: {
			white: { name: `w${id}`, rank: '3d' },
			black: { name: `b${id}`, rank: '2d' }
		},
		rules: {
			size: 19,
			komi: 6.5,
			timeSystem: 'byo_yomi',
			mainTime: 1800,
			byoYomiTime: 30,
			byoYomiPeriods: 5
		},
		...extra
	} as GameChannel;
}

const rooms = {
	5: { id: 5, name: 'KGS-Turnier', tournOnly: true },
	9: { id: 9, name: 'Englischer Raum' }
} as unknown as Index<Room>;

describe('Jetzt auf KGS', () => {
	it('groups tournament and broadcast games by room, never normal games or shown boards', () => {
		const games = [
			game(1),
			game(2),
			game(3, { type: 'ranked', roomId: 9, event: true }),
			game(4, { type: 'ranked', roomId: 9 }), // a normal game
			game(5, { over: true }), // over
			game(6) // already on a broadcast card
		];
		const groups = getKgsNowGroups(games, rooms, [6]);
		expect(
			groups.map((group) => [group.roomName, group.tournament, group.games.map((g) => g.id)])
		).toEqual([
			['KGS-Turnier', true, [1, 2]],
			['Englischer Raum', false, [3]]
		]);
	});

	describe('section', () => {
		let actions: Record<string, ReturnType<typeof vi.fn>>;
		beforeEach(() => {
			actions = { onJoinGame: vi.fn() };
			app._actions = actions as unknown as AppActions;
			app.state = {
				...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
				activeGames: [game(1), game(2)],
				roomsById: rooms
			};
		});

		it('shows the boards of a running KGS tournament with their rules', async () => {
			await render(KgsNow, {});
			await expect.element(page.getByRole('heading', { name: 'Jetzt auf KGS' })).toBeVisible();
			await expect.element(page.getByText('Turnier · KGS-Turnier · 2 Bretter')).toBeVisible();
			await expect.element(page.getByText('19×19').first()).toBeVisible();
			await page.getByRole('button', { name: /w1/ }).click();
			expect(actions.onJoinGame).toHaveBeenCalledWith(1);
		});

		it('stays away while nothing runs', async () => {
			app.state = { ...app.state, activeGames: [game(4, { type: 'ranked', roomId: 9 })] };
			await render(KgsNow, {});
			await expect.element(page.getByText('Jetzt auf KGS')).not.toBeInTheDocument();
		});
	});
});
