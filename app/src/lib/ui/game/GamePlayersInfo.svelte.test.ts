import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { parseSgf } from '#lib/model/sgf.ts';
import type { GameChannel } from '#lib/model/types.ts';
import GamePlayersInfo from './GamePlayersInfo.svelte';

function game(running: 'white' | 'black', over = false): GameChannel {
	const tree = parseSgf('(;SZ[19];B[pd])');
	const last = tree.currentLine[1];
	return {
		id: 1,
		type: 'ranked',
		over,
		players: { white: { name: 'anna', rank: '2d' }, black: { name: 'bert', rank: '1d' } },
		clocks: {
			white: { running: running === 'white', time: 600 },
			black: { running: running === 'black', time: 590 }
		},
		tree: { ...tree, activeNode: last, currentNode: last }
	} as unknown as GameChannel;
}

describe('GamePlayersInfo', () => {
	it('marks the player whose clock runs', async () => {
		const view = await render(GamePlayersInfo, { game: game('white'), onUserDetail: () => {} });
		expect(view.container.querySelector('.GamePlayersInfo-white')?.classList).toContain(
			'GamePlayersInfo-toMove'
		);
		expect(view.container.querySelector('.GamePlayersInfo-black')?.classList).not.toContain(
			'GamePlayersInfo-toMove'
		);
	});

	it('marks no one when the game is over', async () => {
		const view = await render(GamePlayersInfo, {
			game: game('white', true),
			onUserDetail: () => {}
		});
		expect(view.container.querySelector('.GamePlayersInfo-toMove')).toBeNull();
	});
});
