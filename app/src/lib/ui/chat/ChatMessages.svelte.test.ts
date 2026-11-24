import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { app } from '#lib/app.svelte.ts';
import type { AppActions } from '#lib/model/AppActions.ts';
import type { ConversationMessage, GameChannel, User } from '#lib/model/types.ts';
import ChatMessages from './ChatMessages.svelte';

const me: User = { name: 'gotvfan', rank: '3k', flags: { connected: true } };
const anna: User = { name: 'anna', rank: '2d', flags: { connected: true } };

function message(id: string, sender: string, body: string, minute: number): ConversationMessage {
	return { id, sender, body, date: new Date(2026, 10, 24, 18, minute) };
}

function game(id: number, type: GameChannel['type'], minute: number): GameChannel {
	return {
		id,
		type,
		time: new Date(2026, 10, 24, 18, minute).getTime(),
		players: { white: anna, black: me },
		moveNum: 0,
		roomId: 1
	};
}

describe('ChatMessages', () => {
	afterEach(() => {
		app._actions = null;
	});

	it('shows sender and body, with links in the text', async () => {
		await render(ChatMessages, {
			currentUser: me,
			usersByName: { anna },
			messages: [message('1', 'anna', 'Hallo! Mehr auf gokgs.com', 1)]
		});
		await expect.element(page.getByRole('button', { name: /^anna/ })).toBeVisible();
		await expect.element(page.getByText(/Hallo! Mehr auf/)).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'gokgs.com' }))
			.toHaveAttribute('href', 'http://gokgs.com');
	});

	it('mixes in game links by time; a game calls onJoinGame, a challenge onSelectChallenge', async () => {
		const onJoinGame = vi.fn();
		const onSelectChallenge = vi.fn();
		const onUserDetail = vi.fn();
		await render(ChatMessages, {
			currentUser: me,
			usersByName: { anna },
			messages: [message('1', 'anna', 'erst', 1), message('2', 'unbekannt7', 'dann', 5)],
			games: [game(77, 'ranked', 3), game(88, 'challenge', 6)],
			onJoinGame,
			onSelectChallenge,
			onUserDetail
		});
		const texts = Array.from(document.querySelectorAll('.ChatMessages > *')).map(
			(el) => el.className
		);
		expect(texts[0]).toContain('ChatMessages-item');
		expect(texts[1]).toContain('ChatMessages-game-type-ranked');
		expect(texts[2]).toContain('ChatMessages-item');
		expect(texts[3]).toContain('ChatMessages-game-type-challenge');

		await page.getByRole('button', { name: /Gewertete Partie/ }).click();
		expect(onJoinGame).toHaveBeenCalledWith(77);
		await page.getByRole('button', { name: /Herausforderung/ }).click();
		expect(onSelectChallenge).toHaveBeenCalledWith(88);
		expect(onJoinGame).toHaveBeenCalledTimes(1);

		await page.getByRole('button', { name: 'unbekannt7' }).click();
		expect(onUserDetail).toHaveBeenCalledWith('unbekannt7');
	});

	it('offers "Im TV öffnen" for a stream link, by default through the app', async () => {
		const onOpenTvStream = vi.fn();
		app._actions = { onOpenTvStream } as unknown as AppActions;
		await render(ChatMessages, {
			currentUser: me,
			usersByName: { anna },
			messages: [message('1', 'anna', 'Live: twitch.tv/europeangofederation !', 1)]
		});
		await page.getByRole('button', { name: 'Im TV öffnen' }).click();
		expect(onOpenTvStream).toHaveBeenCalledWith('https://twitch.tv/europeangofederation');
	});

	it('uses onOpenTv when given', async () => {
		const onOpenTv = vi.fn();
		await render(ChatMessages, {
			currentUser: me,
			usersByName: {},
			messages: [message('1', 'anna', 'https://youtu.be/abcdefghijk', 1)],
			onOpenTv
		});
		await page.getByRole('button', { name: 'Im TV öffnen' }).click();
		expect(onOpenTv).toHaveBeenCalledWith('https://youtu.be/abcdefghijk');
	});
});
