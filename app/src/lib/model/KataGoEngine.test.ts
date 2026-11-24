import {
	KataGoEngine,
	findMistakes,
	getPvPoints,
	parseGtpMove,
	compareGameMove,
	getGameNextMove,
	getKataGoPosition,
	toAnalysis
} from './KataGoEngine';
import { parseSgf } from './sgf';
import { getMainLine, playVariationMove } from './ReplayVariation';
describe('KataGo position', () => {
	it('passes board, player to move, moves, komi and rules', () => {
		const tree = parseSgf('(;GM[1]SZ[9]KM[7.5]RU[Chinese];B[cc];W[gg];B[])');
		const line = getMainLine(tree);
		const position = getKataGoPosition(tree, line[2]);
		expect(position.currentPlayer).toBe('black');
		expect(position.moveHistory).toEqual([
			{
				x: 2,
				y: 2,
				player: 'black'
			},
			{
				x: 6,
				y: 6,
				player: 'white'
			}
		]);
		expect(position.board[2][2]).toBe('black');
		expect(position.board).toHaveLength(9);
		expect(position.komi).toBe(7.5);
		expect(position.rules).toBe('chinese');
		// A pass is sent as -1/-1.
		expect(getKataGoPosition(tree, line[3]).moveHistory[2]).toEqual({
			x: -1,
			y: -1,
			player: 'black'
		});
	});
	it('follows an own variation', () => {
		const tree = parseSgf('(;GM[1]SZ[9];B[cc];W[gg])');
		const line = getMainLine(tree);
		const played = playVariationMove(tree, line[1], {
			x: 4,
			y: 4
		});
		const position = getKataGoPosition(played.tree, played.nodeId);
		expect(position.moveHistory[1]).toEqual({
			x: 4,
			y: 4,
			player: 'white'
		});
		expect(getGameNextMove(played.tree, played.nodeId)).toBe(null);
	});
});
describe('KataGo lines', () => {
	it('reads GTP moves like the board labels', () => {
		expect(parseGtpMove('Q16', 19)).toEqual({
			x: 15,
			y: 3
		});
		expect(parseGtpMove('j1', 19)).toEqual({
			x: 8,
			y: 18
		});
		expect(parseGtpMove('pass', 19)).toBe(null);
		expect(parseGtpMove('T20', 19)).toBe(null);
		expect(parseGtpMove('I5', 19)).toBe(null);
	});
	it('turns the expected line into points up to a pass', () => {
		const move = {
			x: 15,
			y: 3,
			pv: ['Q16', 'D4', 'pass', 'Q4']
		};
		expect(getPvPoints(move, 19)).toEqual([
			{
				x: 15,
				y: 3
			},
			{
				x: 3,
				y: 15
			}
		]);
		expect(
			getPvPoints(
				{
					x: 2,
					y: 2,
					pv: []
				},
				9
			)
		).toEqual([
			{
				x: 2,
				y: 2
			}
		]);
	});
});
describe('KataGo results', () => {
	const analysis = toAnalysis(
		{
			rootWinRate: 0.62,
			rootScoreLead: 3.4,
			rootVisits: 100,
			moves: [
				{
					x: 3,
					y: 3,
					winRate: 0.63,
					scoreLead: 3.6,
					visits: 60,
					pointsLost: 0,
					order: 0
				},
				{
					x: -1,
					y: -1,
					winRate: 0.4,
					scoreLead: 0,
					visits: 1,
					pointsLost: 9,
					order: 9
				},
				{
					x: 15,
					y: 15,
					winRate: 0.58,
					scoreLead: 2.1,
					visits: 30,
					pointsLost: 1.5,
					order: 1
				}
			]
		},
		'black',
		'wasm'
	);
	it("keeps the top moves on the board, black's view", () => {
		expect(analysis.winRate).toBe(0.62);
		expect(analysis.moves.map((move) => [move.x, move.y])).toEqual([
			[3, 3],
			[15, 15]
		]);
		expect(analysis.backend).toBe('wasm');
	});
	it("compares the game's move with KataGo's best", () => {
		expect(
			compareGameMove(analysis, {
				x: 3,
				y: 3
			})
		).toBe(null);
		expect(
			compareGameMove(analysis, {
				x: 15,
				y: 15
			})
		).toEqual({
			best: analysis.moves[0],
			played: analysis.moves[1]
		});
		expect(
			compareGameMove(analysis, {
				x: 9,
				y: 9
			})
		).toEqual({
			best: analysis.moves[0],
			played: null
		});
		expect(compareGameMove(analysis, null)).toBe(null);
	});
	it("finds the game's next move on the main line", () => {
		const tree = parseSgf('(;GM[1]SZ[9];B[cc];W[gg])');
		const line = getMainLine(tree);
		expect(getGameNextMove(tree, line[1])).toEqual({
			x: 6,
			y: 6,
			color: 'white'
		});
		expect(getGameNextMove(tree, line[2])).toBe(null);
	});
});
describe('findMistakes', () => {
	it('ranks moves by the win chance their player gave away', () => {
		const tree = parseSgf('(;SZ[9];B[cc];W[gg];B[cg];W[gc])');
		const line = getMainLine(tree);
		const leads = [0.5, 1.0, 4.0, -3.5, -3.0]; // black's view

		const wins = [0.5, 0.52, 0.7, 0.3, 0.32];
		const evals = line.map((nodeId, move) => ({
			nodeId,
			move,
			winRate: wins[move],
			scoreLead: leads[move]
		}));
		const mistakes = findMistakes(evals, tree);
		// B C3 (move 3) gave away 40 %, W G3 (move 2) 18 %.
		expect(
			mistakes.map((m) => [
				m.move,
				m.color,
				m.beforeNodeId,
				m.pointsLost,
				Math.round(m.winRateLost * 100)
			])
		).toEqual([
			[3, 'black', line[2], 7.5, 40],
			[2, 'white', line[1], 3, 18]
		]);
		expect(findMistakes(evals, tree, 1)).toHaveLength(1);
		expect(findMistakes(evals, tree, 5, 10)).toEqual([]);
	});
	it('puts a game-deciding loss before a bigger one in a decided game', () => {
		const tree = parseSgf('(;SZ[9];B[cc];W[gg];B[cg])');
		const line = getMainLine(tree);
		const evals = [
			{
				nodeId: line[0],
				move: 0,
				winRate: 0.5,
				scoreLead: 0
			},
			{
				nodeId: line[1],
				move: 1,
				winRate: 0.2,
				scoreLead: -4
			}, // B: -30 %
			{
				nodeId: line[2],
				move: 2,
				winRate: 0.2,
				scoreLead: -4
			},
			{
				nodeId: line[3],
				move: 3,
				winRate: 0.19,
				scoreLead: -24
			} // B: -20 pts
		];
		expect(findMistakes(evals, tree).map((m) => m.move)).toEqual([1, 3]);
	});
});
describe('verifyMistakes', () => {
	// Game: B C7 (cc), W G3 (gg), B C3 (cg).
	const tree = parseSgf('(;SZ[9];B[cc];W[gg];B[cg])');
	const line = getMainLine(tree);

	const candidate = (move) => ({
		move,
		nodeId: line[move],
		beforeNodeId: line[move - 1],
		color: move % 2 ? 'black' : 'white',
		pointsLost: 9
	});

	const move = (x, y, scoreLead, pointsLost) => ({
		x,
		y,
		scoreLead,
		pointsLost,
		winRate: 0.5,
		visits: 10,
		order: 0,
		pv: []
	});

	it("measures the played move against KataGo's best with a search", async () => {
		const engine = new KataGoEngine();
		const analyses = {
			// Before W G3: G3 listed, 3.5 points worse than E5.
			[line[1]]: {
				scoreLead: 1,
				moves: [move(4, 4, 1, 0), move(6, 6, 4.5, 3.5)]
			},
			// Before B C3: the game's move is KataGo's best.
			[line[2]]: {
				scoreLead: 0,
				moves: [move(2, 6, 0, 0)]
			}
		};
		engine.analyze = vi.fn((t, nodeId) => Promise.resolve(analyses[nodeId]));
		const onProgress = vi.fn();
		const verified = await engine.verifyMistakes(
			tree,
			[candidate(2), candidate(3)],
			onProgress,
			() => false
		);
		expect(verified.map((m) => [m.move, m.pointsLost])).toEqual([
			[2, 3.5],
			[3, 0]
		]);
		expect(onProgress).toHaveBeenLastCalledWith(2, 2);
	});
	it('compares the position after an unlisted move', async () => {
		const engine = new KataGoEngine();
		engine.analyze = vi.fn((t, nodeId) =>
			Promise.resolve(
				nodeId === line[1]
					? {
							scoreLead: 1,
							moves: [move(4, 4, 1, 0)]
						}
					: {
							scoreLead: 7,
							moves: []
						} // after W G3: black leads by 7
			)
		);
		const verified = await engine.verifyMistakes(
			tree,
			[candidate(2)],
			() => {},
			() => false
		);
		// White gave up 6 points (black's lead 1 -> 7).
		expect(verified[0].pointsLost).toBe(6);
		expect(
			await engine.verifyMistakes(
				tree,
				[candidate(2)],
				() => {},
				() => true
			)
		).toBe(null);
	});
});
