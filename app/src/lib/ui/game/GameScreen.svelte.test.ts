import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { app } from '#lib/app.svelte.ts';
import { language } from '#lib/i18n/index.svelte.ts';
import type { AppActions } from '#lib/model/AppActions.ts';
import { getInitialState, handleMessage } from '#lib/model/index.ts';
import { parseSgf } from '#lib/model/sgf.ts';
import type { GameChannel, GameTree, User } from '#lib/model/types.ts';
import GameScreen from './GameScreen.svelte';

const me: User = { name: 'gotvfan', rank: '3k', flags: { connected: true } };
const anna: User = { name: 'anna', rank: '2d', flags: { connected: true } };
const kibitz: User = { name: 'kibitz', rank: '9k', flags: { connected: true } };

// 9x9: B C3 (cg), W G7 (gc). Black (me) is to move.
function treeAtEnd(sgf: string): GameTree {
	const tree = parseSgf(sgf);
	const last = tree.currentLine[tree.currentLine.length - 1];
	return { ...tree, activeNode: last, currentNode: last };
}

function fixtureGame(extra: Partial<GameChannel> = {}): GameChannel {
	return {
		id: 501,
		type: 'ranked',
		time: Date.UTC(2026, 10, 24, 18),
		players: { white: anna, black: me },
		moveNum: 2,
		roomId: 1,
		rules: {
			size: 9,
			komi: 6.5,
			timeSystem: 'byo_yomi',
			mainTime: 600,
			byoYomiTime: 30,
			byoYomiPeriods: 5
		},
		clocks: { white: { time: 540, running: false }, black: { time: 575, running: true } },
		users: ['kibitz'],
		actions: [{ action: 'MOVE', user: { name: 'gotvfan' } }],
		tree: treeAtEnd('(;GM[1]SZ[9];B[cg];W[gc])'),
		...extra
	};
}

function mockActions() {
	const actions = {
		onPlayMove: vi.fn(),
		onMarkLife: vi.fn(),
		onPass: vi.fn(),
		onResign: vi.fn(),
		onUndo: vi.fn(),
		onAddGameTime: vi.fn(),
		onDoneScoring: vi.fn(),
		onLeaveGame: vi.fn(),
		onAcceptUndo: vi.fn(),
		onDeclineUndo: vi.fn(),
		onChangeCurrentNode: vi.fn(),
		onSendGameChat: vi.fn(),
		onUserDetail: vi.fn(),
		onOpenTvStream: vi.fn()
	};
	app._actions = actions as unknown as AppActions;
	return actions;
}

// The transparent hit area of a board point (row-major, like the board).
function clickPoint(x: number, y: number, size = 9) {
	const hits = document.querySelectorAll('.hit');
	hits[y * size + x].dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('GameScreen', () => {
	beforeEach(() => {
		app.state = {
			...getInitialState({ status: 'loggedIn', network: 'online', retryTimes: 0 }),
			currentUser: me,
			usersByName: { gotvfan: me, anna, kibitz },
			roomsById: { 1: { id: 1, name: 'Deutscher Raum' } } as never
		};
	});

	afterEach(() => {
		app._actions = null;
	});

	it('shows players, clocks, board and observers of a watched game', async () => {
		mockActions();
		await render(GameScreen, { game: fixtureGame() });
		await expect.element(page.getByRole('button', { name: /^anna/ }).first()).toBeVisible();
		await expect.element(page.getByRole('button', { name: /^gotvfan/ }).first()).toBeVisible();
		await expect
			.element(page.getByRole('img', { name: /anna \(Weiß\) gegen gotvfan \(Schwarz\), Zug 2/ }))
			.toBeVisible();
		await expect.element(page.getByText('9:00', { exact: true })).toBeVisible();
		// Narrow screen: observers are a tab.
		await page.getByRole('tab', { name: '1 Beobachter' }).click();
		await expect.element(page.getByRole('button', { name: /^kibitz/ })).toBeVisible();
		await page.getByRole('tab', { name: 'Info' }).click();
		await expect.element(page.getByRole('rowheader', { name: 'Komi' })).toBeVisible();
		await expect.element(page.getByText('Deutscher Raum')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Zurück' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Passen' })).not.toBeInTheDocument();
	});

	it('steps through a watched game and leaves it', async () => {
		const actions = mockActions();
		const game = fixtureGame();
		await render(GameScreen, { game });
		await page.getByRole('button', { name: 'Ein Zug zurück' }).click();
		expect(actions.onChangeCurrentNode).toHaveBeenCalledWith(game, game.tree!.currentLine[1]);
		await page.getByRole('button', { name: 'Zurück' }).click();
		expect(actions.onLeaveGame).toHaveBeenCalledWith(game);
	});

	it('plays a free point on our move, with the colour of our role', async () => {
		const actions = mockActions();
		const game = fixtureGame();
		await render(GameScreen, { game, playing: true });
		await expect.element(page.getByRole('img', { name: /Zug 2/ })).toBeVisible();
		clickPoint(4, 4);
		expect(actions.onPlayMove).toHaveBeenCalledWith(game, { x: 4, y: 4 }, 'black');
		// An occupied point (C3 = x 2, y 6) does nothing.
		clickPoint(2, 6);
		expect(actions.onPlayMove).toHaveBeenCalledTimes(1);
	});

	it('does not take clicks when it is not our move', async () => {
		mockActions();
		await render(GameScreen, {
			game: fixtureGame({ actions: [{ action: 'MOVE', user: { name: 'anna' } }] }),
			playing: true
		});
		await expect.element(page.getByRole('button', { name: 'Passen' })).toBeDisabled();
		expect(document.querySelectorAll('.hit')).toHaveLength(0);
	});

	it('passes, resigns, asks for undo and gives time', async () => {
		const actions = mockActions();
		const game = fixtureGame();
		await render(GameScreen, { game, playing: true });
		await page.getByRole('button', { name: 'Passen' }).click();
		expect(actions.onPass).toHaveBeenCalledWith(game);
		await page.getByRole('button', { name: 'Aufgeben' }).click();
		expect(actions.onResign).not.toHaveBeenCalled();
		await page.getByRole('button', { name: 'Weiter spielen' }).click();
		expect(actions.onResign).not.toHaveBeenCalled();
		await page.getByRole('button', { name: 'Aufgeben' }).click();
		await page.getByRole('button', { name: 'Ja, aufgeben' }).click();
		expect(actions.onResign).toHaveBeenCalledWith(game);
		await page.getByRole('button', { name: 'Zug zurück' }).click();
		expect(actions.onUndo).toHaveBeenCalledWith(game);
		await page.getByRole('button', { name: /Mehr/ }).click();
		await page.getByRole('button', { name: '5 Minuten schenken' }).click();
		expect(actions.onAddGameTime).toHaveBeenCalledWith(game, 'white', 300);
		await page.getByRole('button', { name: /Mehr/ }).click();
		await page.getByRole('button', { name: 'Partie verlassen' }).click();
		expect(actions.onLeaveGame).toHaveBeenCalledWith(game);
	});

	it('marks a group while scoring and finishes with "Fertig"', async () => {
		const actions = mockActions();
		const game = fixtureGame({
			actions: [{ action: 'SCORE', user: { name: 'gotvfan' } }]
		});
		await render(GameScreen, { game, playing: true });
		// The white stone on G7 (x 6, y 2): no mark yet, so it is marked dead.
		clickPoint(6, 2);
		expect(actions.onMarkLife).toHaveBeenCalledWith(game, { x: 6, y: 2 }, false);
		await page.getByRole('button', { name: 'Fertig' }).click();
		expect(actions.onDoneScoring).toHaveBeenCalledWith(game);
	});

	it('answers an undo request', async () => {
		const actions = mockActions();
		const game = fixtureGame({ undoRequest: 'white' });
		await render(GameScreen, { game, playing: true });
		await page.getByRole('button', { name: 'Erlauben' }).click();
		expect(actions.onAcceptUndo).toHaveBeenCalledWith(game);
		await page.getByRole('button', { name: 'Ablehnen' }).click();
		expect(actions.onDeclineUndo).toHaveBeenCalledWith(game);
	});

	it('offers to replay a watched game that has ended', async () => {
		mockActions();
		const suggest = vi.spyOn(app, 'suggestGameReplay').mockImplementation(() => {});
		const game = fixtureGame({ over: true, score: 'W+RESIGN' });
		await render(GameScreen, { game });
		await expect
			.element(page.getByRole('heading', { name: 'Partie beendet: W+Aufgabe' }))
			.toBeVisible();
		await page.getByRole('button', { name: 'Nachspielen' }).click();
		expect(suggest).toHaveBeenCalledWith(game);
		await page.getByRole('button', { name: 'Schließen' }).click();
		await expect.element(page.getByRole('button', { name: 'Nachspielen' })).not.toBeInTheDocument();
		suggest.mockRestore();
	});

	it('offers a KataGo review after an own game is over', async () => {
		mockActions();
		const suggest = vi.spyOn(app, 'suggestGameReplay').mockImplementation(() => {});
		// gotvfan (the viewer) played black.
		const game = fixtureGame({ over: true, score: 'W+RESIGN' });
		await render(GameScreen, { game });
		await page.getByRole('button', { name: 'Mit KataGo auswerten' }).click();
		expect(suggest).toHaveBeenCalledWith(game, { kataGo: true });
		suggest.mockRestore();
	});

	it('never offers KataGo while the own game runs', async () => {
		mockActions();
		await render(GameScreen, { game: fixtureGame(), playing: true });
		await expect.element(page.getByRole('button', { name: 'Passen' })).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Mit KataGo auswerten' }))
			.not.toBeInTheDocument();
	});

	it('offers no KataGo review for a watched game of others', async () => {
		mockActions();
		const game = fixtureGame({
			over: true,
			score: 'W+RESIGN',
			players: { white: anna, black: kibitz }
		});
		await render(GameScreen, { game });
		await expect.element(page.getByRole('button', { name: 'Nachspielen' })).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Mit KataGo auswerten' }))
			.not.toBeInTheDocument();
	});

	it('fills the height on an iPad in landscape, players beside the board', async () => {
		mockActions();
		await page.viewport(1180, 820);
		await render(GameScreen, { game: fixtureGame() });
		const board = page.getByRole('img', { name: /Zug 2/ });
		await expect.element(board).toBeVisible();
		const boardBox = board.element().getBoundingClientRect();
		const side = document.querySelector('.GameScreen-side')!.getBoundingClientRect();
		const screen = document.querySelector('.GameScreen')!.getBoundingClientRect();
		expect(side.left).toBeGreaterThanOrEqual(boardBox.right);
		expect(boardBox.height).toBeGreaterThan(screen.height - 80);
		expect(screen.bottom).toBeLessThanOrEqual(820);
		// Wide: observers are listed without a tab.
		await expect.element(page.getByRole('button', { name: /^kibitz/ })).toBeVisible();
		await page.viewport(414, 896);
	});

	it('shows the chat KGS sends with the game (comments in its SGF)', async () => {
		mockActions();
		// A game as KGS delivers it on joining: the chat so far is stored as
		// COMMENT props of the moves.
		const state = handleMessage(app.state, {
			type: 'GAME_JOIN',
			channelId: 777,
			gameType: 'ranked',
			players: { white: anna, black: kibitz },
			users: [],
			sgfEvents: [
				{
					type: 'PROP_GROUP_ADDED',
					nodeId: 0,
					props: [{ name: 'RULES', size: 9, komi: 6.5, rules: 'japanese' }]
				},
				{ type: 'CHILD_ADDED', nodeId: 0, childNodeId: 1 },
				{
					type: 'PROP_GROUP_ADDED',
					nodeId: 1,
					props: [{ name: 'MOVE', color: 'black', loc: { x: 2, y: 6 } }]
				},
				{
					type: 'PROP_ADDED',
					nodeId: 1,
					prop: { name: 'COMMENT', text: 'anna [2d]: schöner Zug\nkibitz [9k]: danke\n' }
				},
				{ type: 'ACTIVATED', nodeId: 1 }
			]
		});
		await render(GameScreen, { game: state.gamesById[777] });
		await expect.element(page.getByText('schöner Zug')).toBeVisible();
		await expect.element(page.getByText('danke')).toBeVisible();
	});

	it('makes the board bigger or smaller with the splitter, remembered', async () => {
		mockActions();
		localStorage.removeItem('gotv.gameSideWidth');
		await page.viewport(1180, 820);
		await render(GameScreen, { game: fixtureGame(), playing: true });
		const splitter = page.getByRole('slider', { name: 'Brett größer oder kleiner' });
		const before = Number(splitter.element().getAttribute('aria-valuenow'));
		(splitter.element() as HTMLElement).focus();
		await userEvent.keyboard('{ArrowRight}{ArrowRight}');
		const after = Number(splitter.element().getAttribute('aria-valuenow'));
		expect(after).toBeGreaterThan(before);
		expect(Number(localStorage.getItem('gotv.gameSideWidth'))).toBe(340);
		await page.viewport(414, 896);
	});

	it('dragging the splitter onto the board places no stone', async () => {
		const actions = mockActions();
		localStorage.removeItem('gotv.gameSideWidth');
		await page.viewport(1180, 820);
		await render(GameScreen, { game: fixtureGame(), playing: true });
		const splitter = page.getByRole('slider', { name: 'Brett größer oder kleiner' });
		const before = Number(splitter.element().getAttribute('aria-valuenow'));
		// A real mouse drag (press on the edge, move onto the board, release there).
		await userEvent.dragAndDrop(splitter, page.getByRole('img', { name: /Brett|board/i }).first());
		expect(actions.onPlayMove).not.toHaveBeenCalled();
		expect(Number(splitter.element().getAttribute('aria-valuenow'))).not.toBe(before);
		await page.viewport(414, 896);
	});

	it('sends game chat', async () => {
		const actions = mockActions();
		await render(GameScreen, { game: fixtureGame() });
		const input = page.getByRole('textbox');
		await input.fill('Schöner Zug');
		input.element().closest('form')!.requestSubmit();
		expect(actions.onSendGameChat).toHaveBeenCalledWith('Schöner Zug', 501);
	});

	it('speaks English, with the original English result', async () => {
		mockActions();
		language.current = 'en';
		await render(GameScreen, {
			game: fixtureGame({ over: true, score: 'W+RESIGN' }),
			playing: true
		});
		await expect.element(page.getByRole('heading', { name: 'Game over: W+Resign' })).toBeVisible();
		await expect
			.element(page.getByRole('img', { name: /anna \(White\) vs gotvfan \(Black\), move 2/ }))
			.toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Resign' })).toBeVisible();
		await expect.element(page.getByRole('tab', { name: '1 observer' })).toBeInTheDocument();
		await expect.element(page.getByText('1 capture')).not.toBeInTheDocument();
		await expect.element(page.getByText('0 captures').first()).toBeInTheDocument();
	});
});
