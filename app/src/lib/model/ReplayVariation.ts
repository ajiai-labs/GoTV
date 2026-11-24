// Trying own moves while replaying ("Partie untersuchen"): a click puts a
// stone as a new side branch of the game tree, entirely in the browser.
// The game itself stays the first child everywhere ("Hauptlinie"), so the
// move list, navigation and the hidden result keep following the game.
// Captures come from the existing board logic (computeGameNodeStates).
import { GameNode } from './types';
import { computeGameNodeStates, getGameLine } from './game/tree';
import type { BoardState, GameTree, Point, PlayerColor } from './types';
// The game as played: root, then always the first child.
export function getMainLine(tree: GameTree): Array<number> {
	return getGameLine(tree, tree.rootNode);
}
export function isOnMainLine(tree: GameTree, nodeId: number): boolean {
	return getMainLine(tree).includes(nodeId);
}
// The last move of the game shown so far: where an own variation starts
// (null on the main line).
export function getBranchPoint(tree: GameTree, nodeId: number): number | null | undefined {
	const mainLine = getMainLine(tree);
	let cursor: number | null | undefined = nodeId;

	while (typeof cursor === 'number' && !mainLine.includes(cursor)) {
		cursor = tree.nodes[cursor].parent;
	}

	return cursor === nodeId ? null : cursor;
}

function getMoveColor(tree: GameTree, nodeId: number): PlayerColor | null | undefined {
	const move = tree.nodes[nodeId].props.find((prop) => prop.name === 'MOVE');
	return move && (move.color === 'black' || move.color === 'white') ? move.color : null;
}

// Who moves after nodeId: the opposite of the last move; at the start
// black, or white when black got handicap stones.
export function getColorToPlay(tree: GameTree, nodeId: number): PlayerColor {
	let cursor: number | null | undefined = nodeId;

	while (typeof cursor === 'number') {
		const color = getMoveColor(tree, cursor);

		if (color) {
			return color === 'black' ? 'white' : 'black';
		}

		cursor = tree.nodes[cursor].parent;
	}

	const root = tree.nodes[tree.rootNode];
	const handicapStones = root.props.filter(
		(prop) => prop.name === 'ADDSTONE' && prop.color === 'black'
	).length;
	return handicapStones > 1 ? 'white' : 'black';
}

function findChildWithMove(
	tree: GameTree,
	nodeId: number,
	loc: Point,
	color: PlayerColor
): number | null | undefined {
	return tree.nodes[nodeId].children.find((childId) =>
		tree.nodes[childId].props.some(
			(prop) =>
				prop.name === 'MOVE' &&
				prop.color === color &&
				prop.loc &&
				prop.loc !== 'PASS' &&
				prop.loc.x === loc.x &&
				prop.loc.y === loc.y
		)
	);
}

export type MoveError = 'occupied' | 'suicide' | 'ko';
type MoveAttempt =
	| {
			ok: true;
			tree: GameTree;
			nodeId: number;
	  }
	| {
			ok: false;
			error: MoveError;
	  };

// Empty points are null or undefined (a fresh board has holes).
function boardsEqual(a: BoardState, b: BoardState): boolean {
	for (let y = 0; y < a.length; y++) {
		for (let x = 0; x < a.length; x++) {
			if ((a[y][x] || null) !== (b[y][x] || null)) {
				return false;
			}
		}
	}

	return true;
}

// Does the group at loc still have a liberty?
function hasLiberty(board: BoardState, loc: Point): boolean {
	const color = board[loc.y][loc.x];
	const seen = new Set();
	const stack = [loc];

	let next: Point | undefined;
	while ((next = stack.pop())) {
		const { x, y } = next;
		const key = y * board.length + x;

		if (seen.has(key)) {
			continue;
		}

		seen.add(key);

		for (const [dx, dy] of [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1]
		]) {
			const nx = x + dx;
			const ny = y + dy;

			if (ny < 0 || ny >= board.length || nx < 0 || nx >= board.length) {
				continue;
			}

			const neighbour = board[ny][nx];

			if (!neighbour) {
				return true;
			}

			if (neighbour === color) {
				stack.push({
					x: nx,
					y: ny
				});
			}
		}
	}

	return false;
}

function getBoard(tree: GameTree, nodeId: number): BoardState {
	const state = tree.computedState[nodeId];
	return state ? state.board : computeGameNodeStates(tree, nodeId)[nodeId].board;
}

function tryMove(tree: GameTree, nodeId: number, loc: Point): MoveAttempt {
	const board = getBoard(tree, nodeId);

	if (!board[loc.y] || board[loc.y][loc.x]) {
		return {
			ok: false,
			error: 'occupied'
		};
	}

	const color = getColorToPlay(tree, nodeId);
	const existing = findChildWithMove(tree, nodeId, loc, color);
	const next: GameTree = { ...tree };
	let childId;

	if (typeof existing === 'number') {
		childId = existing; // the game's own move is always allowed
	} else {
		childId = Math.max(...Object.keys(tree.nodes).map(Number)) + 1;
		const parent = tree.nodes[nodeId];
		next.nodes = {
			...tree.nodes,
			[nodeId]: new GameNode(parent.props, [...parent.children, childId], parent.parent),
			[childId]: new GameNode(
				[
					{
						name: 'MOVE',
						color,
						loc: {
							x: loc.x,
							y: loc.y
						}
					}
				],
				[],
				nodeId
			)
		};
	}

	next.computedState = computeGameNodeStates(next, childId);

	if (typeof existing !== 'number') {
		const after = next.computedState[childId].board;

		// Suicide: the own stone has no liberty after captures.
		if (after[loc.y][loc.x] !== color || !hasLiberty(after, loc)) {
			return {
				ok: false,
				error: 'suicide'
			};
		}

		// Ko: the move brings back the position before the opponent's move.
		const parentId = tree.nodes[nodeId].parent;

		if (typeof parentId === 'number' && boardsEqual(after, getBoard(tree, parentId))) {
			return {
				ok: false,
				error: 'ko'
			};
		}
	}

	next.currentLine = getGameLine(next, childId);
	next.currentNode = childId;
	return {
		ok: true,
		tree: next,
		nodeId: childId
	};
}

// Why loc cannot be played after nodeId, or null when it can.
export function getMoveError(
	tree: GameTree,
	nodeId: number,
	loc: Point
): MoveError | null | undefined {
	const result = tryMove(tree, nodeId, loc);
	return result.ok ? null : result.error;
}
// Plays loc after nodeId. Returns the new tree (the old one is untouched)
// and the node now shown, or null when the move is not allowed (taken
// point, suicide, ko). Playing the game's own next move follows the game.
export function playVariationMove(
	tree: GameTree,
	nodeId: number,
	loc: Point
):
	| {
			tree: GameTree;
			nodeId: number;
	  }
	| null
	| undefined {
	const result = tryMove(tree, nodeId, loc);
	return result.ok
		? {
				tree: result.tree,
				nodeId: result.nodeId
			}
		: null;
}
// Back to the game where the variation left it.
export function returnToGame(tree: GameTree, nodeId: number): GameTree {
	const branch = getBranchPoint(tree, nodeId);
	const target = typeof branch === 'number' ? branch : nodeId;
	return { ...tree, currentNode: target, currentLine: getMainLine(tree) };
}
// Plays a sequence of moves after nodeId (e.g. KataGo's expected line),
// stopping at a taken point. The first new node can carry a comment.
// Returns null when not even the first move fits.
export function playVariationLine(
	tree: GameTree,
	nodeId: number,
	points: Array<Point>,
	comment?: string
):
	| {
			tree: GameTree;
			firstNodeId: number;
	  }
	| null
	| undefined {
	let current = tree;
	let cursor = nodeId;
	let firstNodeId = null;

	for (const point of points) {
		const played = playVariationMove(current, cursor, point);

		if (!played) {
			break;
		}

		current = played.tree;
		cursor = played.nodeId;

		if (firstNodeId === null) {
			firstNodeId = cursor;
		}
	}

	if (firstNodeId === null) {
		return null;
	}

	if (comment && !isOnMainLine(current, firstNodeId)) {
		const first = current.nodes[firstNodeId];

		if (!first.props.some((prop) => prop.name === 'COMMENT')) {
			current = {
				...current,
				nodes: {
					...current.nodes,
					[firstNodeId]: new GameNode(
						[
							...first.props,
							{
								name: 'COMMENT',
								text: comment
							}
						],
						first.children,
						first.parent
					)
				}
			};
		}
	}

	return {
		tree: { ...current, currentNode: firstNodeId, currentLine: getGameLine(current, firstNodeId) },
		firstNodeId
	};
}
// The continuations after nodeId when there is more than one: the game's
// own move first, then the variations in the order they were laid.
export function getContinuations(
	tree: GameTree,
	nodeId: number
): Array<{
	nodeId: number;
	isGame: boolean;
	comment: string | null | undefined;
}> {
	const children = tree.nodes[nodeId].children;

	if (children.length < 2) {
		return [];
	}

	const mainLine = getMainLine(tree);
	return children.map((childId) => {
		const commentProp: any = tree.nodes[childId].props.find((prop) => prop.name === 'COMMENT');
		return {
			nodeId: childId,
			isGame: mainLine.includes(childId),
			comment: commentProp ? String(commentProp.text) : null
		};
	});
}
// The move a node plays, for labels ("E5"), or null.
export function getNodeMove(tree: GameTree, nodeId: number): Point | null | undefined {
	const move: any = tree.nodes[nodeId].props.find((prop) => prop.name === 'MOVE');
	return move && move.loc && move.loc !== 'PASS' ? move.loc : null;
}
// Shows a continuation: the line through childId to its end.
export function showContinuation(tree: GameTree, childId: number): GameTree {
	const next = { ...tree, currentNode: childId, currentLine: getGameLine(tree, childId) };

	if (!next.computedState[childId]) {
		next.computedState = computeGameNodeStates(next, childId);
	}

	return next;
}
// Removes the own variation nodeId belongs to (from where it left the game,
// with everything after it) and returns to the game there.
export function removeVariation(tree: GameTree, nodeId: number): GameTree {
	const branch = getBranchPoint(tree, nodeId);

	if (typeof branch !== 'number') {
		return tree;
	}

	// The first node of the variation: the child of the branch point on the
	// way to nodeId.
	let start = nodeId;

	while (tree.nodes[start].parent !== branch) {
		start = Number(tree.nodes[start].parent);
	}

	const removed = new Set();
	const stack = [start];

	let id: number | undefined;
	while ((id = stack.pop()) !== undefined) {
		removed.add(id);
		stack.push(...tree.nodes[id].children);
	}

	const nodes: GameTree['nodes'] = {};
	const computedState: GameTree['computedState'] = {};

	for (const key of Object.keys(tree.nodes)) {
		const id = Number(key);

		if (!removed.has(id)) {
			nodes[id] = tree.nodes[id];

			if (tree.computedState[id]) {
				computedState[id] = tree.computedState[id];
			}
		}
	}

	const parent = tree.nodes[branch];
	nodes[branch] = new GameNode(
		parent.props,
		parent.children.filter((id) => id !== start),
		parent.parent
	);
	return {
		...tree,
		nodes,
		computedState,
		currentNode: branch,
		currentLine: getMainLine({ ...tree, nodes })
	};
}
// A stored variation move: the path of child indexes from the root to its
// parent, the point, and a comment if it carries one ("KataGo-Variante").
export type VariationEntry = {
	path: Array<number>;
	x: number;
	y: number;
	comment?: string;
};
// All own and KataGo variation moves, parents before children and
// siblings in their order, so they can be laid again the same way.
export function getVariationEntries(tree: GameTree): Array<VariationEntry> {
	const mainLine = getMainLine(tree);
	const entries: Array<VariationEntry> = [];
	const stack: Array<{
		nodeId: number;
		path: Array<number>;
	}> = [
		{
			nodeId: tree.rootNode,
			path: []
		}
	];

	let item: { nodeId: number; path: Array<number> } | undefined;
	while ((item = stack.pop())) {
		const { nodeId, path } = item;
		const children = tree.nodes[nodeId].children;

		for (let index = children.length - 1; index >= 0; index--) {
			stack.push({
				nodeId: children[index],
				path: [...path, index]
			});
		}

		if (mainLine.includes(nodeId)) {
			continue;
		}

		const move = getNodeMove(tree, nodeId);

		if (!move) {
			continue;
		}

		const commentProp: any = tree.nodes[nodeId].props.find((prop) => prop.name === 'COMMENT');
		const entry: VariationEntry = {
			path: path.slice(0, -1),
			x: move.x,
			y: move.y
		};

		if (commentProp && typeof commentProp.text === 'string') {
			entry.comment = commentProp.text;
		}

		entries.push(entry);
	}

	return entries;
}

function findByPath(tree: GameTree, path: Array<number>): number | null | undefined {
	let nodeId = tree.rootNode;

	for (const index of path) {
		const child = tree.nodes[nodeId].children[index];

		if (typeof child !== 'number') {
			return null;
		}

		nodeId = child;
	}

	return nodeId;
}

function setComment(tree: GameTree, nodeId: number, text: string): GameTree {
	const node = tree.nodes[nodeId];

	if (node.props.some((prop) => prop.name === 'COMMENT')) {
		return tree;
	}

	return {
		...tree,
		nodes: {
			...tree.nodes,
			[nodeId]: new GameNode(
				[
					...node.props,
					{
						name: 'COMMENT',
						text
					}
				],
				node.children,
				node.parent
			)
		}
	};
}

// Lays stored variations again; entries that no longer fit are skipped.
// The view stays where it was (current node and line).
export function applyVariationEntries(tree: GameTree, entries: Array<VariationEntry>): GameTree {
	let current = tree;

	for (const entry of entries) {
		const parentId = findByPath(current, entry.path);

		if (typeof parentId !== 'number') {
			continue;
		}

		const played = playVariationMove(current, parentId, {
			x: entry.x,
			y: entry.y
		});

		if (!played) {
			continue;
		}

		current = played.tree;

		if (entry.comment) {
			current = setComment(current, played.nodeId, entry.comment);
		}
	}

	return {
		...current,
		currentNode: tree.currentNode,
		currentLine: tree.currentLine,
		computedState: { ...current.computedState, ...tree.computedState }
	};
}
