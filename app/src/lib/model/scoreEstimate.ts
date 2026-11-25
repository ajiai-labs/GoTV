// "Ergebnis schätzen" (as in CGoban) for watched games: who owns which
// point and roughly how the game would end now. No AI: many random
// playouts from the position (both sides play random legal moves, never
// into their own single-point eyes, until both pass), and every point is
// given to the side that owned it in most of them. Stones that mostly ended
// up as the opponent's area count as dead. Good enough for a clear position;
// in open fights it is only a rough guess - the dialog says so.
import type { BoardMarkup, BoardState, GameRuleSet, PlayerColor } from './types';

const BLACK = 1;
const WHITE = 2;
type Color = typeof BLACK | typeof WHITE;

// An open point counts for a side if its average ownership is this clear
// (+1: black's in every playout, -1: white's).
const OWNED = 0.5;
// A group counts as dead if its points' average ownership is this clearly
// the opponent's.
const DEAD = 0.3;
export const DEFAULT_PLAYOUTS = 300;

export type ScoreEstimate = {
	// Per point (y, x): +1 always black's, -1 always white's.
	ownership: Array<Array<number>>;
	blackTerritory: number;
	whiteTerritory: number;
	// Stones of this colour that count as dead.
	deadBlack: number;
	deadWhite: number;
	blackScore: number;
	whiteScore: number;
	// Black minus white, komi included: > 0 black leads.
	margin: number;
	markup: BoardMarkup;
};

export type EstimateOptions = {
	komi: number;
	rules?: GameRuleSet;
	// Stones each side has captured so far.
	blackCaptures: number;
	whiteCaptures: number;
	toPlay?: PlayerColor;
	playouts?: number;
	random?: () => number;
};

// A small seeded generator, so a position always gives the same estimate.
export function seededRandom(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function neighboursOf(size: number): Array<Array<number>> {
	const result: Array<Array<number>> = [];
	for (let p = 0; p < size * size; p++) {
		const x = p % size;
		const y = (p - x) / size;
		const list: Array<number> = [];
		if (x > 0) list.push(p - 1);
		if (x < size - 1) list.push(p + 1);
		if (y > 0) list.push(p - size);
		if (y < size - 1) list.push(p + size);
		result.push(list);
	}
	return result;
}

// A position for fast random playouts: stones form groups (a root per
// group, a circular list of its stones) with pseudo-liberties - each
// liberty counted once per adjacent stone, plus the sum and the sum of
// squares of their points, which tells "exactly one liberty" (atari)
// without searching the group.
class Playout {
	cells: Uint8Array;
	root: Int32Array;
	next: Int32Array;
	stones: Int32Array;
	libs: Int32Array;
	libSum: Float64Array;
	libSq: Float64Array;
	empty: Int32Array;
	emptyAt: Int32Array;
	emptyCount = 0;
	ko = -1;

	constructor(
		readonly neighbours: Array<Array<number>>,
		cells: Uint8Array
	) {
		const n = cells.length;
		this.cells = new Uint8Array(n);
		this.root = new Int32Array(n).fill(-1);
		this.next = new Int32Array(n);
		this.stones = new Int32Array(n);
		this.libs = new Int32Array(n);
		this.libSum = new Float64Array(n);
		this.libSq = new Float64Array(n);
		this.empty = new Int32Array(n);
		this.emptyAt = new Int32Array(n).fill(-1);
		for (let p = 0; p < n; p++) {
			if (cells[p]) this.put(p, cells[p] as Color);
			else this.addEmpty(p);
		}
	}

	copy(): Playout {
		const other = Object.create(Playout.prototype) as Playout;
		Object.assign(other, this);
		other.cells = this.cells.slice();
		other.root = this.root.slice();
		other.next = this.next.slice();
		other.stones = this.stones.slice();
		other.libs = this.libs.slice();
		other.libSum = this.libSum.slice();
		other.libSq = this.libSq.slice();
		other.empty = this.empty.slice();
		other.emptyAt = this.emptyAt.slice();
		return other;
	}

	private addEmpty(p: number) {
		this.emptyAt[p] = this.emptyCount;
		this.empty[this.emptyCount++] = p;
	}

	private removeEmpty(p: number) {
		const i = this.emptyAt[p];
		const last = this.empty[--this.emptyCount];
		this.empty[i] = last;
		this.emptyAt[last] = i;
		this.emptyAt[p] = -1;
	}

	private addLib(r: number, p: number) {
		this.libs[r]++;
		this.libSum[r] += p;
		this.libSq[r] += p * p;
	}

	private removeLib(r: number, p: number) {
		this.libs[r]--;
		this.libSum[r] -= p;
		this.libSq[r] -= p * p;
	}

	inAtari(r: number): boolean {
		const libs = this.libs[r];
		return libs > 0 && this.libSum[r] * this.libSum[r] === libs * this.libSq[r];
	}

	// Places a stone (setup, or a checked move); returns the stones captured.
	put(p: number, color: Color): number {
		const { cells, root, neighbours } = this;
		const other = color === BLACK ? WHITE : BLACK;
		cells[p] = color;
		if (this.emptyAt[p] >= 0) this.removeEmpty(p);
		root[p] = p;
		this.next[p] = p;
		this.stones[p] = 1;
		this.libs[p] = 0;
		this.libSum[p] = 0;
		this.libSq[p] = 0;
		for (const n of neighbours[p]) {
			if (cells[n] === 0) this.addLib(p, n);
			else this.removeLib(root[n], p);
		}
		for (const n of neighbours[p]) {
			if (cells[n] === color && root[n] !== root[p]) this.merge(root[p], root[n]);
		}
		let captured = 0;
		for (const n of neighbours[p]) {
			if (cells[n] === other && this.libs[root[n]] === 0) captured += this.capture(root[n]);
		}
		return captured;
	}

	private merge(a: number, b: number) {
		// Relabel the smaller group.
		const [big, small] = this.stones[a] >= this.stones[b] ? [a, b] : [b, a];
		let s = small;
		do {
			this.root[s] = big;
			s = this.next[s];
		} while (s !== small);
		const t = this.next[big];
		this.next[big] = this.next[small];
		this.next[small] = t;
		this.stones[big] += this.stones[small];
		this.libs[big] += this.libs[small];
		this.libSum[big] += this.libSum[small];
		this.libSq[big] += this.libSq[small];
	}

	private capture(r: number): number {
		const { cells, root, neighbours } = this;
		const removed: Array<number> = [];
		let s = r;
		do {
			removed.push(s);
			s = this.next[s];
		} while (s !== r);
		for (const stone of removed) {
			cells[stone] = 0;
			root[stone] = -1;
			this.addEmpty(stone);
		}
		for (const stone of removed) {
			for (const n of neighbours[stone]) {
				if (cells[n] !== 0) this.addLib(root[n], stone);
			}
		}
		return removed.length;
	}

	// Legal for `color` (no suicide, not the ko point) and no own eye.
	isGoodMove(p: number, color: Color): boolean {
		if (p === this.ko) return false;
		const { cells, root, neighbours } = this;
		let eye = true;
		let legal = false;
		for (const n of neighbours[p]) {
			const c = cells[n];
			if (c !== color) eye = false;
			if (c === 0) legal = true;
			else if (c === color) {
				if (!this.inAtari(root[n])) legal = true;
			} else if (this.inAtari(root[n])) {
				legal = true;
			}
		}
		return legal && !eye;
	}

	lastMove = -1;

	private playMove(p: number, color: Color) {
		const captured = this.put(p, color);
		const r = this.root[p];
		// Simple ko: one stone took one stone and is left with one liberty.
		this.ko = -1;
		if (captured === 1 && this.stones[r] === 1 && this.inAtari(r)) {
			this.ko = this.libSum[r] / this.libs[r];
		}
		this.lastMove = p;
	}

	// Next to the last move: take a group in atari, else save an own one
	// (the usual light playout rule - without it, dead stones often "live").
	private urgentMove(color: Color): number {
		const last = this.lastMove;
		if (last < 0 || !this.cells[last]) return -1;
		const { cells, root, neighbours } = this;
		const candidates = [last, ...neighbours[last]];
		for (const n of candidates) {
			if (cells[n] && cells[n] !== color && this.inAtari(root[n])) {
				const p = this.libSum[root[n]] / this.libs[root[n]];
				if (this.isGoodMove(p, color)) return p;
			}
		}
		for (const n of neighbours[last]) {
			if (cells[n] === color && this.inAtari(root[n])) {
				const p = this.libSum[root[n]] / this.libs[root[n]];
				if (this.isGoodMove(p, color)) return p;
			}
		}
		return -1;
	}

	// Plays a good move (urgent first, else random); false if none (pass).
	playRandom(color: Color, random: () => number): boolean {
		const urgent = this.urgentMove(color);
		if (urgent >= 0) {
			this.playMove(urgent, color);
			return true;
		}
		const count = this.emptyCount;
		const start = Math.floor(random() * count);
		for (let i = 0; i < count; i++) {
			const p = this.empty[(start + i) % count];
			if (!this.isGoodMove(p, color)) continue;
			this.playMove(p, color);
			return true;
		}
		this.ko = -1;
		this.lastMove = -1;
		return false;
	}
}

// One random game to the end; adds each point's owner to `sum`.
function playout(start: Playout, first: Color, random: () => number, sum: Float64Array) {
	const game = start.copy();
	const points = game.cells.length;
	let color = first;
	let passes = 0;
	const maxMoves = points * 3;
	for (let move = 0; move < maxMoves && passes < 2; move++) {
		passes = game.playRandom(color, random) ? 0 : passes + 1;
		color = color === BLACK ? WHITE : BLACK;
	}
	for (let p = 0; p < points; p++) {
		const owner = game.cells[p] || eyeOwner(game.cells, game.neighbours, p);
		if (owner === BLACK) sum[p] += 1;
		else if (owner === WHITE) sum[p] -= 1;
	}
}

// After a playout every empty point is an eye or between both colours.
function eyeOwner(cells: Uint8Array, neighbours: Array<Array<number>>, p: number): number {
	let owner = 0;
	for (const n of neighbours[p]) {
		const c = cells[n];
		if (!c) continue;
		if (owner && owner !== c) return 0;
		owner = c;
	}
	return owner;
}

// The connected points from `start` for which `inside` holds.
function flood(
	cells: Uint8Array,
	neighbours: Array<Array<number>>,
	start: number,
	inside: (p: number) => boolean
): Array<number> {
	const found = [start];
	const seen = new Set([start]);
	for (let i = 0; i < found.length; i++) {
		for (const n of neighbours[found[i]]) {
			if (!seen.has(n) && inside(n)) {
				seen.add(n);
				found.push(n);
			}
		}
	}
	return found;
}

export function estimateScore(board: BoardState, options: EstimateOptions): ScoreEstimate {
	const size = board.length;
	const neighbours = neighboursOf(size);
	const cells = new Uint8Array(size * size);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const c = board[y]?.[x];
			cells[y * size + x] = c === 'black' ? BLACK : c === 'white' ? WHITE : 0;
		}
	}
	const playouts = options.playouts ?? DEFAULT_PLAYOUTS;
	const random = options.random ?? seededRandom(hashCells(cells));
	const first: Color = options.toPlay === 'white' ? WHITE : BLACK;
	const sum = new Float64Array(cells.length);
	const position = new Playout(neighbours, cells);
	for (let i = 0; i < playouts; i++) {
		// Alternate who moves first, so the side to move gets no big edge.
		playout(position, i % 2 ? (first === BLACK ? WHITE : BLACK) : first, random, sum);
	}

	const own = Array.from(sum, (v) => v / playouts);
	const ownership: Array<Array<number>> = [];
	for (let y = 0; y < size; y++) ownership.push(own.slice(y * size, (y + 1) * size));

	// Dead stones, decided per group: the opponent owned it on average.
	const alive = cells.slice();
	const seen = new Uint8Array(cells.length);
	let deadBlack = 0;
	let deadWhite = 0;
	const dead = new Uint8Array(cells.length);
	for (let p = 0; p < cells.length; p++) {
		if (!cells[p] || seen[p]) continue;
		const group = flood(cells, neighbours, p, (q) => cells[q] === cells[p]);
		for (const q of group) seen[q] = 1;
		const mean = group.reduce((total, q) => total + own[q], 0) / group.length;
		const isDead = cells[p] === BLACK ? mean < -DEAD : mean > DEAD;
		if (!isDead) continue;
		for (const q of group) {
			dead[q] = 1;
			alive[q] = 0;
		}
		if (cells[p] === BLACK) deadBlack += group.length;
		else deadWhite += group.length;
	}

	// Areas without living stones: closed by one colour -> its territory;
	// touching both -> point by point by the playouts.
	const owner = new Int8Array(cells.length);
	const visited = new Uint8Array(cells.length);
	for (let p = 0; p < cells.length; p++) {
		if (alive[p] || visited[p]) continue;
		const area = flood(alive, neighbours, p, (q) => alive[q] === 0);
		let borders = 0;
		for (const q of area) {
			visited[q] = 1;
			for (const n of neighbours[q]) if (alive[n]) borders |= alive[n];
		}
		for (const q of area) {
			if (borders === BLACK) owner[q] = 1;
			else if (borders === WHITE) owner[q] = -1;
			else if (own[q] >= OWNED) owner[q] = 1;
			else if (own[q] <= -OWNED) owner[q] = -1;
		}
	}

	const markup: BoardMarkup = { marks: {}, labels: {} };
	let blackTerritory = 0;
	let whiteTerritory = 0;
	let blackStones = 0;
	let whiteStones = 0;
	for (let p = 0; p < cells.length; p++) {
		const x = p % size;
		const y = (p - x) / size;
		let mark: 'blackTerritory' | 'whiteTerritory' | 'dead' | null = null;
		if (alive[p] === BLACK) blackStones++;
		else if (alive[p] === WHITE) whiteStones++;
		else if (owner[p] === 1) {
			blackTerritory++;
			mark = 'blackTerritory';
		} else if (owner[p] === -1) {
			whiteTerritory++;
			mark = 'whiteTerritory';
		}
		if (dead[p]) mark = 'dead';
		if (mark) {
			markup.marks[y] = markup.marks[y] || {};
			markup.marks[y][x] = mark;
		}
	}

	// Territory rules count captures and dead stones as prisoners; area
	// rules count living stones instead.
	const territoryRules = !options.rules || options.rules === 'japanese';
	const blackScore = territoryRules
		? blackTerritory + options.blackCaptures + deadWhite
		: blackTerritory + blackStones;
	const whiteScore =
		(territoryRules
			? whiteTerritory + options.whiteCaptures + deadBlack
			: whiteTerritory + whiteStones) + options.komi;

	return {
		ownership,
		blackTerritory,
		whiteTerritory,
		deadBlack,
		deadWhite,
		blackScore,
		whiteScore,
		margin: blackScore - whiteScore,
		markup
	};
}

function hashCells(cells: Uint8Array): number {
	let h = 2166136261;
	for (const c of cells) h = Math.imul(h ^ c, 16777619);
	return h >>> 0;
}
