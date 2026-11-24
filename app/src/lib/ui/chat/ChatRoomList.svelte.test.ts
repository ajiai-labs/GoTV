import { page } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Index, Room } from '#lib/model/types.ts';
import ChatRoomList from './ChatRoomList.svelte';
import { favoriteRooms } from './favoriteRooms.svelte.ts';

const ROOMS = {
	3: { id: 3, name: 'Deutscher Raum', category: 'NATIONAL' },
	7: { id: 7, name: 'English Game Room', category: 'MAIN' }
} as unknown as Index<Room>;

describe('ChatRoomList', () => {
	beforeEach(() => {
		window.localStorage.clear();
		favoriteRooms.reload();
	});
	afterEach(() => {
		window.localStorage.clear();
		favoriteRooms.reload();
	});

	it('joins a room with a click', async () => {
		const onJoinRoom = vi.fn();
		await render(ChatRoomList, { roomsById: ROOMS, onJoinRoom });
		await page.getByRole('button', { name: 'Deutscher Raum', exact: true }).click();
		expect(onJoinRoom).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
	});

	it('stars a room as favourite and remembers it with id and name', async () => {
		const onJoinRoom = vi.fn();
		await render(ChatRoomList, { roomsById: ROOMS, onJoinRoom });
		await expect.element(page.getByText(/nach jeder Anmeldung automatisch betreten/)).toBeVisible();
		const star = page.getByRole('button', {
			name: 'Raum Deutscher Raum nach jeder Anmeldung betreten'
		});
		await expect.element(star).toHaveAttribute('aria-pressed', 'false');
		await star.click();
		const active = page.getByRole('button', {
			name: 'Raum Deutscher Raum nicht mehr automatisch betreten'
		});
		await expect.element(active).toHaveAttribute('aria-pressed', 'true');
		expect(JSON.parse(window.localStorage.getItem('gotv.favoriteRooms') ?? '[]')).toEqual([
			{ id: 3, name: 'Deutscher Raum' }
		]);
		expect(onJoinRoom).not.toHaveBeenCalled();
		await active.click();
		expect(JSON.parse(window.localStorage.getItem('gotv.favoriteRooms') ?? '[]')).toEqual([]);
	});
});
