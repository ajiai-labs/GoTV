import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { language } from '#lib/i18n/index.svelte.ts';
import type { GameChannel, User } from '#lib/model/types.ts';
import GameList from './GameList.svelte';
import GameListFilter from './GameListFilter.svelte';

const anna: User = { name: 'anna', rank: '2d', flags: { connected: true } };
const bert: User = { name: 'bert', rank: '1k', flags: { connected: true } };
const bot: User = { name: 'GnuBot', rank: '5k', flags: { connected: true, robot: true } };

function game(id: number, extra: Partial<GameChannel> = {}): GameChannel {
	return {
		id,
		type: 'ranked',
		time: 0,
		players: { white: anna, black: bert },
		moveNum: 42,
		roomId: 1,
		observers: 7,
		rules: {
			size: 19,
			komi: 6.5,
			timeSystem: 'byo_yomi',
			mainTime: 600,
			byoYomiTime: 30,
			byoYomiPeriods: 5
		},
		...extra
	};
}

const roomsById = {
	1: { id: 1, name: 'Englischer Raum' },
	2: { id: 2, name: 'Deutscher Raum' }
} as never;

describe('GameList', () => {
	it('shows the games and calls onSelect with id and game', async () => {
		const onSelect = vi.fn();
		const games = [game(1), game(2, { over: true, score: 'B+RESIGN', name: 'Finale' })];
		await render(GameList, { games, roomsById, onSelect });
		await expect.element(page.getByText('Zug 42')).toBeVisible();
		await expect.element(page.getByText('S+Aufgabe')).toBeVisible();
		await expect.element(page.getByText('Finale')).toBeVisible();
		await expect.element(page.getByText('Englischer Raum').first()).toBeVisible();
		await page.getByRole('button', { name: /Finale/ }).click();
		expect(onSelect).toHaveBeenCalledWith(2, games[1]);
	});

	it('shows board size, time and rule set of each game', async () => {
		const games = [
			game(1, { rules: { ...game(1).rules!, rules: 'japanese' } }),
			game(2, { rules: { size: 9, komi: 0, handicap: 2 } })
		];
		await render(GameList, { games, roomsById, onSelect: vi.fn() });
		const first = page.getByRole('button', { name: /anna/ }).first();
		await expect.element(first.getByText('19×19')).toBeVisible();
		await expect.element(first.getByText(/10:00/)).toBeVisible();
		await expect.element(first.getByText('Japanisch')).toBeVisible();
		await expect.element(page.getByText('9×9 H2')).toBeVisible();
	});

	it('speaks English when English is chosen', async () => {
		language.current = 'en';
		await render(GameList, { games: [game(1, { observers: 1 })], roomsById, onSelect: () => {} });
		await expect.element(page.getByText('Move 42')).toBeVisible();
		await expect.element(page.getByText('1 observer', { exact: true })).toBeVisible();
	});

	it('applies the room and bot filter and says when nothing is left', async () => {
		const games = [game(1), game(2, { roomId: 2, players: { white: bot, black: bert } })];
		const screen = await render(GameList, {
			games,
			roomsById,
			filter: { roomId: 2, excludeBots: true },
			onSelect: () => {}
		});
		await expect.element(page.getByText('Keine Partien')).toBeVisible();
		await screen.rerender({ filter: { roomId: 2 } });
		await expect.element(page.getByText(/GnuBot/)).toBeVisible();
		await expect.element(page.getByText(/anna/)).not.toBeInTheDocument();
	});

	it('labels the source of each board when asked to', async () => {
		await render(GameList, {
			games: [game(1, { tvSource: 'ogs' })],
			showSource: true,
			onSelect: () => {}
		});
		await expect.element(page.getByText('OGS')).toBeVisible();
	});
});

describe('GameListFilter', () => {
	it('offers the rooms of the games and changes the filter', async () => {
		const onChange = vi.fn();
		const games = [game(1), game(2, { roomId: 2 }), game(3, { roomId: 2 })];
		const screen = await render(GameListFilter, { games, roomsById, filter: {}, onChange });
		const select = page.getByRole('combobox', { name: 'Raum' });
		await expect.element(select).toHaveValue('');
		await select.selectOptions('Deutscher Raum');
		expect(onChange).toHaveBeenLastCalledWith({ type: 'game', roomId: 2 });

		await page.getByRole('checkbox', { name: 'Bots' }).click();
		expect(onChange).toHaveBeenLastCalledWith({ type: 'game', excludeBots: true });

		await screen.rerender({ filter: { type: 'game', roomId: 2 } });
		await page.getByRole('button', { name: 'Raumfilter aufheben' }).click();
		expect(onChange).toHaveBeenLastCalledWith({ type: 'game', roomId: null });
	});

	it('speaks of challenges in a challenge list', async () => {
		await render(GameListFilter, {
			games: [game(1, { type: 'challenge' })],
			roomsById,
			filter: {},
			onChange: () => {}
		});
		await expect
			.element(page.getByRole('option', { name: 'Alle Herausforderungen' }))
			.toBeInTheDocument();
	});
});
