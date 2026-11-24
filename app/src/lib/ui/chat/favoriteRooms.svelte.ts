// The favourite KGS rooms as reactive state: the star in the room list and
// the watcher that joins them after login read the same list.
import {
	isFavoriteRoom,
	loadFavoriteRooms,
	saveFavoriteRooms,
	toggleFavoriteRoom
} from '#lib/model/FavoriteRooms.ts';
import type { FavoriteRoom } from '#lib/model/FavoriteRooms.ts';

class FavoriteRoomsState {
	rooms: Array<FavoriteRoom> = $state(
		typeof localStorage === 'undefined' ? [] : loadFavoriteRooms()
	);

	has(id: number): boolean {
		return isFavoriteRoom(this.rooms, id);
	}

	toggle(room: { id: number; name?: string | null }) {
		this.rooms = toggleFavoriteRoom(this.rooms, room);
		saveFavoriteRooms(this.rooms);
	}

	// Reads the list again (tests, a restored backup).
	reload() {
		this.rooms = loadFavoriteRooms();
	}
}

export const favoriteRooms = new FavoriteRoomsState();
