// KataGo analysis in the browser: the KataGo engine of Web KaTrain (MIT),
// bundled as a Web Worker in public/katago/ (see tools/katago-worker/).
// It runs on WebGPU where the browser has it, else WASM or plain JS - on
// any graphics card, also on a tablet, without a server. Values come back
// from black's point of view.
import { errorMessage } from '../util/error';
import { getMainLine, getColorToPlay } from './ReplayVariation';
import { getGameLine } from './game/tree';
import type { GameTree, PlayerColor } from './types';
export const KATAGO_BASE_URL = (process.env.PUBLIC_URL || '') + '/katago/';
export const DEFAULT_MODEL_URL = KATAGO_BASE_URL + 'models/katago-small.bin.gz';
export const DEFAULT_VISITS = 100;
export const TOP_MOVES = 5;
// The worker stops after 0.8 s unless told otherwise; the chosen visits
// should be reached, up to this limit (slow devices without WebGPU).
export const MAX_ANALYSIS_MS = 30000;
export type KataGoMove = {
	x: number;
	y: number;
	winRate: number;
	scoreLead: number;
	visits: number;
	pointsLost: number;
	order: number;
	// The line KataGo expects after this move, this move first ("Q16").
	pv: Array<string>;
};
// Longest expected line taken over as a variation.
export const MAX_PV_MOVES = 12;
const COLUMNS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';
// Board point as on the board labels: no "I" column, row 1 at the bottom.
export function formatPoint(x: number, y: number, size: number): string {
	return (COLUMNS[x] || '?') + String(size - y);
}
// "Q16" -> {x, y}; null for "pass" or anything off the board.
export function parseGtpMove(
	text: string,
	size: number
):
	| {
			x: number;
			y: number;
	  }
	| null
	| undefined {
	const match = /^([A-HJ-Z])(\d{1,2})$/i.exec(String(text).trim());

	if (!match) {
		return null;
	}

	const x = COLUMNS.indexOf(match[1].toUpperCase());
	const y = size - Number(match[2]);
	return x >= 0 && x < size && y >= 0 && y < size
		? {
				x,
				y
			}
		: null;
}
// The expected line as board points, up to the first pass.
export function getPvPoints(
	move: KataGoMove,
	size: number
): Array<{
	x: number;
	y: number;
}> {
	const points = [];

	for (const text of move.pv.slice(0, MAX_PV_MOVES)) {
		const point = parseGtpMove(text, size);

		if (!point) {
			break;
		}

		points.push(point);
	}

	return points.length
		? points
		: [
				{
					x: move.x,
					y: move.y
				}
			];
}
export type KataGoAnalysis = {
	winRate: number;
	// black's chance to win, 0..1
	scoreLead: number;
	// black's lead in points
	visits: number;
	moves: Array<KataGoMove>;
	toPlay: PlayerColor;
	backend: string | null | undefined;
};
type Position = {
	board: Array<Array<PlayerColor | null | undefined>>;
	currentPlayer: PlayerColor;
	moveHistory: Array<{
		x: number;
		y: number;
		player: PlayerColor;
	}>;
	komi: number;
	rules: string;
};
const RULES: Record<string, string> = {
	japanese: 'japanese',
	chinese: 'chinese',
	aga: 'aga',
	new_zealand: 'new-zealand'
};
// The position at nodeId as the worker expects it.
export function getKataGoPosition(tree: GameTree, nodeId: number): Position {
	const rulesProp: any = tree.nodes[tree.rootNode].props.find((prop) => prop.name === 'RULES');
	const komi = rulesProp && typeof rulesProp.komi === 'number' ? rulesProp.komi : 6.5;
	const rules =
		(rulesProp && RULES[String(rulesProp.rules)]) || (komi > 7 ? 'chinese' : 'japanese');
	const line = getGameLine(tree, nodeId);
	const moveHistory = [];

	for (const id of line.slice(0, line.indexOf(nodeId) + 1)) {
		for (const prop of tree.nodes[id].props) {
			if (prop.name === 'MOVE' && (prop.color === 'black' || prop.color === 'white')) {
				const loc = prop.loc;
				moveHistory.push(
					loc && loc !== 'PASS'
						? {
								x: loc.x,
								y: loc.y,
								player: prop.color
							}
						: {
								x: -1,
								y: -1,
								player: prop.color
							}
				);
			}
		}
	}

	return {
		board: tree.computedState[nodeId].board,
		currentPlayer: getColorToPlay(tree, nodeId),
		moveHistory,
		komi,
		rules
	};
}
export function toAnalysis(
	payload: Record<string, any>,
	toPlay: PlayerColor,
	backend: string | null | undefined
): KataGoAnalysis {
	const moves = (payload.moves || [])
		.filter((move: any) => move.x >= 0 && move.y >= 0)
		.slice(0, TOP_MOVES)
		.map((move: any) => ({
			x: move.x,
			y: move.y,
			winRate: move.winRate,
			scoreLead: move.scoreLead,
			visits: move.visits,
			pointsLost: move.pointsLost,
			order: move.order,
			pv: Array.isArray(move.pv) ? move.pv.map(String) : []
		}));
	return {
		winRate: payload.rootWinRate,
		scoreLead: payload.rootScoreLead,
		visits: payload.rootVisits,
		moves,
		toPlay,
		backend: backend || null
	};
}
// The game's next move after nodeId on the main line, if any.
export function getGameNextMove(
	tree: GameTree,
	nodeId: number
):
	| {
			x: number;
			y: number;
			color: PlayerColor;
	  }
	| null
	| undefined {
	const mainLine = getMainLine(tree);
	const index = mainLine.indexOf(nodeId);

	if (index < 0 || index + 1 >= mainLine.length) {
		return null;
	}

	const move: any = tree.nodes[mainLine[index + 1]].props.find((prop) => prop.name === 'MOVE');

	if (!move || !move.loc || move.loc === 'PASS') {
		return null;
	}

	return {
		x: move.loc.x,
		y: move.loc.y,
		color: move.color
	};
}
// "Was wäre hier besser gewesen?": how the game's move compares with
// KataGo's best one. null when the game move is KataGo's first choice.
export function compareGameMove(
	analysis: KataGoAnalysis,
	gameMove:
		| {
				x: number;
				y: number;
		  }
		| null
		| undefined
):
	| {
			best: KataGoMove;
			played: KataGoMove | null | undefined;
	  }
	| null
	| undefined {
	if (!gameMove || !analysis.moves.length) {
		return null;
	}

	const best = analysis.moves[0];

	if (best.x === gameMove.x && best.y === gameMove.y) {
		return null;
	}

	const played = analysis.moves.find((move) => move.x === gameMove.x && move.y === gameMove.y);
	return {
		best,
		played: played || null
	};
}
type Pending = {
	resolve: (arg0: any) => any;
	reject: (arg0: Error) => any;
	toPlay: PlayerColor;
	// "background": the whole-game check, not cancelled by moving around.
	kind: 'analyze' | 'batch' | 'background';
};
// One position of a whole game, black's view, straight from the network
// (no search): fast enough for every move of a game.
export type PositionEval = {
	nodeId: number;
	move: number;
	winRate: number;
	scoreLead: number;
};
export type GameMistake = {
	move: number;
	// move number of the mistake
	nodeId: number;
	// position after the mistake
	beforeNodeId: number;
	// position before it (where KataGo shows better)
	color: PlayerColor;
	pointsLost: number;
	winRateLost: number; // 0..1, the player's own chance to win
};
// Positions per worker request while evaluating a whole game.
export const GAME_BATCH_SIZE = 24;
// Candidates re-checked with a search, and its size.
export const VERIFY_CANDIDATES = 10;
export const VERIFY_VISITS = 60;
// One worker per page, created on first use (nothing loads before the
// viewer switches the analysis on).
export class KataGoEngine {
	_worker: Worker | null | undefined = null;
	_nextId: number = 1;
	_pending: Record<number, Pending> = {};
	_modelUrl: string = DEFAULT_MODEL_URL;
	backend: string | null | undefined = null;

	setModelUrl(url: string) {
		this._modelUrl = url;
	}

	getModelUrl(): string {
		return this._modelUrl;
	}

	_getWorker(): Worker {
		if (!this._worker) {
			const worker = new Worker(KATAGO_BASE_URL + 'katago-worker.js');
			worker.onmessage = this._onMessage;

			worker.onerror = (e: Record<string, any>) => {
				this._failAll(new Error(e.message || 'KataGo konnte nicht starten'));
			};

			this._worker = worker;
		}

		return this._worker;
	}

	_failAll(err: Error) {
		for (const id of Object.keys(this._pending)) {
			this._pending[Number(id)].reject(err);
		}

		this._pending = {};
	}

	_onMessage = (ev: Record<string, any>) => {
		const msg = ev.data || {};

		if (msg.type !== 'katago:analyze_result' && msg.type !== 'katago:eval_batch_result') {
			return; // progress updates and backend notices are not shown
		}

		const pending = this._pending[msg.id];

		if (!pending) {
			return;
		}

		delete this._pending[msg.id];

		if (msg.backend) {
			this.backend = msg.backend;
		}

		if (pending.kind === 'batch' && msg.ok && Array.isArray(msg.evals)) {
			pending.resolve(msg.evals);
		} else if (pending.kind !== 'batch' && msg.ok && msg.analysis) {
			pending.resolve(toAnalysis(msg.analysis, pending.toPlay, msg.backend));
		} else {
			pending.reject(new Error(msg.canceled ? 'canceled' : msg.error || 'Analyse fehlgeschlagen'));
		}
	};

	// Analyses one position; a newer request cancels the older one.
	analyze(
		tree: GameTree,
		nodeId: number,
		visits: number = DEFAULT_VISITS,
		background: boolean = false
	): Promise<KataGoAnalysis> {
		const worker = this._getWorker();

		const position = getKataGoPosition(tree, nodeId);

		if (!background) {
			this.cancel();
		}

		const id = this._nextId++;
		return new Promise((resolve, reject) => {
			this._pending[id] = {
				resolve,
				reject,
				toPlay: position.currentPlayer,
				kind: background ? 'background' : 'analyze'
			};
			worker.postMessage({
				type: 'katago:analyze',
				id,
				analysisGroup: background ? 'background' : 'interactive',
				modelUrl: new URL(this._modelUrl, window.location.href).href,
				backend: 'webgpu',
				board: position.board,
				currentPlayer: position.currentPlayer,
				moveHistory: position.moveHistory,
				komi: position.komi,
				rules: position.rules,
				topK: TOP_MOVES,
				visits,
				maxTimeMs: MAX_ANALYSIS_MS
			});
		});
	}

	_evalBatch(
		positions: Array<Record<string, any>>,
		rules: string
	): Promise<Array<Record<string, any>>> {
		const worker = this._getWorker();

		const id = this._nextId++;
		return new Promise((resolve, reject) => {
			this._pending[id] = {
				resolve,
				reject,
				toPlay: 'black',
				kind: 'batch'
			};
			worker.postMessage({
				type: 'katago:eval_batch',
				id,
				modelUrl: new URL(this._modelUrl, window.location.href).href,
				backend: 'webgpu',
				positions,
				rules
			});
		});
	}

	// Every position of the game's main line, in batches; onProgress gets
	// the number of positions done. shouldStop() ends it early (null result).
	async evaluateGame(
		tree: GameTree,
		onProgress: (done: number, total: number) => any,
		shouldStop: () => boolean
	): Promise<Array<PositionEval> | null | undefined> {
		const mainLine = getMainLine(tree);
		const results: Array<PositionEval> = [];

		for (let start = 0; start < mainLine.length; start += GAME_BATCH_SIZE) {
			if (shouldStop()) {
				return null;
			}

			const nodeIds = mainLine.slice(start, start + GAME_BATCH_SIZE);
			const positions = nodeIds.map((nodeId) => {
				const position = getKataGoPosition(tree, nodeId);
				return {
					board: position.board,
					currentPlayer: position.currentPlayer,
					moveHistory: position.moveHistory,
					komi: position.komi
				};
			});
			const rules = getKataGoPosition(tree, tree.rootNode).rules;
			const evals = await this._evalBatch(positions, rules);
			nodeIds.forEach((nodeId, index) => {
				const value = evals[index] || {};
				results.push({
					nodeId,
					move: start + index,
					winRate: Number(value.rootWinRate),
					scoreLead: Number(value.rootScoreLead)
				});
			});
			onProgress(results.length, mainLine.length);
		}

		return results;
	}

	// Re-checks the candidates of findMistakes with a real search: the
	// network alone swings in ko fights. The loss is what the played move
	// gives up against KataGo's best move in the position before it.
	async verifyMistakes(
		tree: GameTree,
		candidates: Array<GameMistake>,
		onProgress: (done: number, total: number) => any,
		shouldStop: () => boolean,
		visits: number = VERIFY_VISITS
	): Promise<Array<GameMistake> | null | undefined> {
		const verified = [];

		for (let i = 0; i < candidates.length; i++) {
			if (shouldStop()) {
				return null;
			}

			const candidate = candidates[i];

			try {
				const before = await this.analyze(tree, candidate.beforeNodeId, visits, true);
				const played = getGameNextMove(tree, candidate.beforeNodeId);
				const best = before.moves[0];
				const listed =
					played && before.moves.find((move) => move.x === played.x && move.y === played.y);
				let pointsLost;

				if (!best || (played && best.x === played.x && best.y === played.y)) {
					pointsLost = 0;
				} else if (listed) {
					pointsLost = Math.max(0, listed.pointsLost - best.pointsLost);
				} else {
					const after = await this.analyze(tree, candidate.nodeId, visits, true);
					const change = after.scoreLead - best.scoreLead; // black's view

					pointsLost = Math.max(0, candidate.color === 'black' ? -change : change);
				}

				verified.push({ ...candidate, pointsLost });
			} catch (err) {
				if (errorMessage(err) !== 'canceled') {
					throw err;
				}
			}

			onProgress(i + 1, candidates.length);
		}

		return verified;
	}

	cancel() {
		const worker = this._worker;

		for (const id of Object.keys(this._pending)) {
			if (this._pending[Number(id)].kind !== 'analyze') {
				continue; // a running game evaluation finishes its batch
			}

			if (worker) {
				worker.postMessage({
					type: 'katago:cancel',
					id: Number(id),
					analysisGroup: 'interactive'
				});
			}

			this._pending[Number(id)].reject(new Error('canceled'));

			delete this._pending[Number(id)];
		}
	}
}
let sharedEngine: KataGoEngine | null | undefined = null;
export function getKataGoEngine(): KataGoEngine {
	if (!sharedEngine) {
		sharedEngine = new KataGoEngine();
	}

	return sharedEngine;
}
// The moves that hurt their player most: ranked by the win chance they
// gave away (a big point loss in a decided game hardly matters), counted
// only from minPoints on. Black's view in the evals, so a black move loses
// what black's values drop, a white move what they rise.
export function findMistakes(
	evals: Array<PositionEval>,
	tree: GameTree,
	limit: number = 5,
	minPoints: number = 2
): Array<GameMistake> {
	const mistakes = [];

	for (let i = 1; i < evals.length; i++) {
		const before = evals[i - 1];
		const after = evals[i];

		if (
			!isFinite(before.scoreLead) ||
			!isFinite(after.scoreLead) ||
			!isFinite(before.winRate) ||
			!isFinite(after.winRate)
		) {
			continue;
		}

		const move: any = tree.nodes[after.nodeId].props.find((prop) => prop.name === 'MOVE');

		if (!move || (move.color !== 'black' && move.color !== 'white')) {
			continue;
		}

		const sign = move.color === 'black' ? -1 : 1;
		const pointsLost = sign * (after.scoreLead - before.scoreLead);
		const winRateLost = sign * (after.winRate - before.winRate);

		if (pointsLost >= minPoints) {
			mistakes.push({
				move: after.move,
				nodeId: after.nodeId,
				beforeNodeId: before.nodeId,
				color: move.color,
				pointsLost,
				winRateLost: Math.max(0, winRateLost)
			});
		}
	}

	return mistakes
		.sort((a, b) => b.winRateLost - a.winRateLost || b.pointsLost - a.pointsLost)
		.slice(0, limit);
}
