import { describe, expect, it } from 'vitest';
import {
	FAVORITE_ROOMS_KEY,
	getRoomsToJoin,
	isFavoriteRoom,
	loadFavoriteRooms,
	mergeFavoriteRooms,
	saveFavoriteRooms,
	toggleFavoriteRoom
} from './FavoriteRooms';

describe('FavoriteRooms', () => {
	it('stars and unstars a room', () => {
		const one = toggleFavoriteRoom([], { id: 3, name: 'Deutscher Raum' });
		expect(one).toEqual([{ id: 3, name: 'Deutscher Raum' }]);
		expect(isFavoriteRoom(one, 3)).toBe(true);
		const two = toggleFavoriteRoom(one, { id: 7, name: 'English Game Room' });
		expect(two.map((room) => room.id)).toEqual([3, 7]);
		expect(toggleFavoriteRoom(two, { id: 3 })).toEqual([{ id: 7, name: 'English Game Room' }]);
	});

	it('keeps the list in storage and ignores broken entries', () => {
		window.localStorage.clear();
		saveFavoriteRooms([{ id: 3, name: 'Deutscher Raum' }]);
		expect(loadFavoriteRooms()).toEqual([{ id: 3, name: 'Deutscher Raum' }]);
		window.localStorage.setItem(
			FAVORITE_ROOMS_KEY,
			JSON.stringify([
				{ id: 3, name: 'a' },
				{ id: 'x' },
				null,
				{ id: 3, name: 'b' },
				{ id: 4, name: 'c' }
			])
		);
		expect(loadFavoriteRooms()).toEqual([
			{ id: 3, name: 'a' },
			{ id: 4, name: 'c' }
		]);
		window.localStorage.setItem(FAVORITE_ROOMS_KEY, '{kaputt');
		expect(loadFavoriteRooms()).toEqual([]);
		window.localStorage.clear();
	});

	it('merges two lists as a union', () => {
		expect(
			mergeFavoriteRooms(
				[{ id: 3, name: 'Deutscher Raum' }],
				[
					{ id: 3, name: 'Deutscher Raum' },
					{ id: 9, name: 'Go Club' }
				]
			)
		).toEqual([
			{ id: 3, name: 'Deutscher Raum' },
			{ id: 9, name: 'Go Club' }
		]);
		expect(mergeFavoriteRooms(null, [{ id: 9, name: 'Go Club' }])).toEqual([
			{ id: 9, name: 'Go Club' }
		]);
	});

	it('joins only known rooms that are not joined yet', () => {
		const favorites = [
			{ id: 1, name: 'Eins' },
			{ id: 2, name: 'Zwei' },
			{ id: 3, name: 'Weg' }
		];
		const roomsById = {
			1: { id: 1, name: 'Eins' },
			2: { id: 2, name: 'Zwei' }
		} as never;
		const membership = { 2: { type: 'room', complete: true, stale: false } } as never;
		expect(getRoomsToJoin(favorites, roomsById, membership)).toEqual([{ id: 1, name: 'Eins' }]);
	});
});
