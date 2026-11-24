// Favourite KGS rooms: starred in the room list, joined automatically after
// every KGS login. Kept in this browser (gotv.favoriteRooms, also in the
// "Meine Daten" backup) with id and name - the name only for showing, KGS
// joins by id.
import type { ChannelMembership, Index, Room } from './types';

export const FAVORITE_ROOMS_KEY = 'gotv.favoriteRooms';
export const MAX_FAVORITE_ROOMS = 50;

export type FavoriteRoom = { id: number; name: string };

function isFavoriteRoomEntry(value: unknown): value is FavoriteRoom {
	const entry = value as FavoriteRoom | null;
	return (
		!!entry &&
		typeof entry === 'object' &&
		Number.isInteger(entry.id) &&
		entry.id > 0 &&
		typeof entry.name === 'string'
	);
}

// Valid entries only, each room once.
function cleanList(value: unknown): Array<FavoriteRoom> {
	const list = Array.isArray(value) ? value.filter(isFavoriteRoomEntry) : [];
	return list
		.filter((room, index) => list.findIndex((other) => other.id === room.id) === index)
		.map((room) => ({ id: room.id, name: room.name }));
}

export function loadFavoriteRooms(storage: Storage = window.localStorage): Array<FavoriteRoom> {
	try {
		return cleanList(JSON.parse(storage.getItem(FAVORITE_ROOMS_KEY) || '[]'));
	} catch {
		return []; // storage disabled or broken entry
	}
}

export function saveFavoriteRooms(
	rooms: Array<FavoriteRoom>,
	storage: Storage = window.localStorage
) {
	try {
		storage.setItem(FAVORITE_ROOMS_KEY, JSON.stringify(rooms));
	} catch {
		// not remembered without storage
	}
}

export function isFavoriteRoom(rooms: Array<FavoriteRoom>, id: number): boolean {
	return rooms.some((room) => room.id === id);
}

// A new list with the room added (at the end) or removed.
export function toggleFavoriteRoom(
	rooms: Array<FavoriteRoom>,
	room: { id: number; name?: string | null }
): Array<FavoriteRoom> {
	return isFavoriteRoom(rooms, room.id)
		? rooms.filter((favorite) => favorite.id !== room.id)
		: [...rooms, { id: room.id, name: room.name || '' }].slice(0, MAX_FAVORITE_ROOMS);
}

// Both lists together, each room once, own entries first ("Meine Daten").
export function mergeFavoriteRooms(own: unknown, incoming: unknown): Array<FavoriteRoom> {
	return cleanList([...cleanList(own), ...cleanList(incoming)]).slice(0, MAX_FAVORITE_ROOMS);
}

// The favourite rooms to join now: known to KGS (in the room names sent at
// login - a room that no longer exists is skipped) and not joined yet.
export function getRoomsToJoin(
	favorites: Array<FavoriteRoom>,
	roomsById: Index<Room>,
	channelMembership: ChannelMembership
): Array<Room> {
	return favorites.flatMap((favorite) => {
		const room = roomsById[favorite.id];
		return room && !channelMembership[favorite.id] ? [room] : [];
	});
}
