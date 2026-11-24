import { InvariantError } from '../../util/error';
import type { SgfLoc, SgfProp, SgfColor, GameRuleSet, BoardState, Point } from '../types';
export function createBoardState(size: number): BoardState {
	const board: BoardState = [];

	while (size) {
		board.push([]);
		size--;
	}

	return board;
}
export function copyBoardState(board: BoardState): BoardState {
	const newBoard = [...board];

	for (let i = 0; i < newBoard.length; i++) {
		newBoard[i] = [...newBoard[i]];
	}

	return newBoard;
}
type StoneGroup = {
	id: number;
	color: 'white' | 'black';
	points: Array<Point>;
	liberties: number;
};
export function getStoneGroup(board: BoardState, x: number, y: number): StoneGroup | null {
	const color = board[y][x];

	if (!color) {
		return null;
	}

	const size = board.length;
	let id = y * size + x;
	const points: Array<Point> = [];
	let liberties = 0;
	const pointsChecked = {
		[id]: true
	};
	const pointsToCheck: Array<Point> = [
		{
			x,
			y
		}
	];

	let pt: Point | undefined;
	while ((pt = pointsToCheck.pop())) {
		const ptId = pt.y * size + pt.x;

		if (ptId < id) {
			id = ptId;
		}

		points.push(pt);

		if (pt.y > 0) {
			const bpt = board[pt.y - 1][pt.x];
			const bptId = (pt.y - 1) * size + pt.x;

			if (!bpt) {
				liberties++;
			} else if (bpt === color && !pointsChecked[bptId]) {
				pointsChecked[bptId] = true;
				pointsToCheck.push({
					y: pt.y - 1,
					x: pt.x
				});
			}
		}

		if (pt.y < size - 1) {
			const bpt = board[pt.y + 1][pt.x];
			const bptId = (pt.y + 1) * size + pt.x;

			if (!bpt) {
				liberties++;
			} else if (bpt === color && !pointsChecked[bptId]) {
				pointsChecked[bptId] = true;
				pointsToCheck.push({
					y: pt.y + 1,
					x: pt.x
				});
			}
		}

		if (pt.x > 0) {
			const bpt = board[pt.y][pt.x - 1];
			const bptId = pt.y * size + pt.x - 1;

			if (!bpt) {
				liberties++;
			} else if (bpt === color && !pointsChecked[bptId]) {
				pointsChecked[bptId] = true;
				pointsToCheck.push({
					y: pt.y,
					x: pt.x - 1
				});
			}
		}

		if (pt.x < size - 1) {
			const bpt = board[pt.y][pt.x + 1];
			const bptId = pt.y * size + pt.x + 1;

			if (!bpt) {
				liberties++;
			} else if (bpt === color && !pointsChecked[bptId]) {
				pointsChecked[bptId] = true;
				pointsToCheck.push({
					y: pt.y,
					x: pt.x + 1
				});
			}
		}
	}

	return {
		id,
		color,
		points,
		liberties
	};
}

function removeDeadStonesAround(board: BoardState, x: number, y: number) {
	const color = board[y][x];

	if (!color) {
		return null;
	}

	const oppositeColor = color === 'white' ? 'black' : 'white';
	const size = board.length;
	const groups: Record<number, StoneGroup> = {};

	// Above
	if (y > 0) {
		const group = getStoneGroup(board, x, y - 1);

		if (group && group.color === oppositeColor && !group.liberties) {
			groups[group.id] = group;
		}
	}

	// Below
	if (y < size - 1) {
		const group = getStoneGroup(board, x, y + 1);

		if (group && group.color === oppositeColor && !group.liberties && !groups[group.id]) {
			groups[group.id] = group;
		}
	}

	// Left
	if (x > 0) {
		const group = getStoneGroup(board, x - 1, y);

		if (group && group.color === oppositeColor && !group.liberties && !groups[group.id]) {
			groups[group.id] = group;
		}
	}

	// Right
	if (x < size - 1) {
		const group = getStoneGroup(board, x + 1, y);

		if (group && group.color === oppositeColor && !group.liberties && !groups[group.id]) {
			groups[group.id] = group;
		}
	}

	const groupIds = Object.keys(groups);

	if (!groupIds.length) {
		return null;
	}

	const newBoard = copyBoardState(board);
	let blackCaps = 0;
	let whiteCaps = 0;

	for (const groupId of groupIds) {
		const group = groups[Number(groupId)];

		if (group.color === 'white') {
			blackCaps += group.points.length;
		} else {
			whiteCaps += group.points.length;
		}

		for (const gPt of group.points) {
			newBoard[gPt.y][gPt.x] = null;
		}
	}

	return {
		blackCaptures: blackCaps,
		whiteCaptures: whiteCaps,
		board: newBoard
	};
}

export function applyPropsToBoard(props: Array<SgfProp>, board: BoardState, ruleset: GameRuleSet) {
	if (!ruleset) {
		// TODO - actually use ruleset
		throw new InvariantError('Rule set required');
	}

	let blackCaps = 0;
	let whiteCaps = 0;
	let newBoard = copyBoardState(board);

	for (const prop of props) {
		const loc: SgfLoc | null | undefined = prop.loc;

		if (prop.name === 'MOVE' || prop.name === 'ADDSTONE') {
			if (!loc || !prop.color) {
				throw new InvariantError('Missing loc or color on MOVE/ADDSTONE prop');
			}

			const color: SgfColor = prop.color;

			if (loc !== 'PASS') {
				newBoard[loc.y][loc.x] = color === 'empty' ? null : color;

				if (prop.name === 'MOVE') {
					const ret = removeDeadStonesAround(newBoard, loc.x, loc.y);

					// TODO - check for auto-capture for appropriate rulesets
					if (ret) {
						newBoard = ret.board;
						blackCaps += ret.blackCaptures;
						whiteCaps += ret.whiteCaptures;
					}
				}
			}
		}
	}

	return {
		blackCaptures: blackCaps,
		whiteCaptures: whiteCaps,
		board: newBoard
	};
}
