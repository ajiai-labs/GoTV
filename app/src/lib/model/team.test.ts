import { describe, expect, it } from 'vitest';
import {
	addBoard,
	emptyBoards,
	findRunningGames,
	loadBoards,
	removeBoard,
	saveBoards
} from './team';
import type { GameChannel } from './types';

describe('Brettübersicht', () => {
	it('puts games on the first free board and keeps each board fixed', () => {
		let boards = addBoard(emptyBoards(), 90)!;
		boards = addBoard(boards, 91)!;
		boards = addBoard(boards, 92)!;
		expect(boards).toEqual([90, 91, 92, null, null, null]);
		expect(addBoard(boards, 91)).toBe(boards); // already there
		// Taking board 2 off leaves 1 and 3 where they are; the next game fills 2.
		boards = removeBoard(boards, 2);
		expect(boards).toEqual([90, null, 92, null, null, null]);
		expect(addBoard(boards, 93)).toEqual([90, 93, 92, null, null, null]);
	});

	it('says when all boards are taken', () => {
		expect(addBoard([1, 2, 3, 4, 6, 7], 5)).toBeNull();
		// Games of an earlier KGS session are gone: their boards count as free.
		expect(addBoard([1, 2, 3, 4, 6, 7], 5, (id) => id !== 2)).toEqual([1, 5, 3, 4, 6, 7]);
	});

	it('remembers the boards and ignores broken entries', () => {
		saveBoards([90, null, 92, null, null, null], localStorage);
		expect(loadBoards(localStorage)).toEqual([90, null, 92, null, null, null]);
		localStorage.setItem('gotv.team', '["x", 5, -1, 7, 8, 9, 10, 11]');
		expect(loadBoards(localStorage)).toEqual([null, 5, null, 7, 8, 9]);
		localStorage.setItem('gotv.team', 'kaputt');
		expect(loadBoards(localStorage)).toEqual(emptyBoards());
		localStorage.removeItem('gotv.team');
	});

	it('finds the running games of a player for the profile', () => {
		const game = (id: number, white: string, black: string, over = false) =>
			({
				id,
				type: 'ranked',
				over,
				players: { white: { name: white }, black: { name: black } }
			}) as unknown as GameChannel;
		const list = [game(1, 'Lukan', 'x'), game(2, 'y', 'lukan', true), game(3, 'a', 'b')];
		expect(findRunningGames(list, 'LUKAN').map((g) => g.id)).toEqual([1]);
	});
});
