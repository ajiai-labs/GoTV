import { createBoardState, applyPropsToBoard } from './board';
import { formatGameScore } from './display';
import { InvariantError } from '../../util/error';
import type {
	GameChannel,
	GameSummary,
	GameTree,
	GameNodeComputedState,
	GameRuleSet,
	GameProposal,
	GameRole,
	GameChatSection,
	GamePlayers,
	GameAction,
	UnparsedUser,
	BoardMarkup,
	BoardPointMark,
	SgfProp,
	PendingMove,
	PlayerColor
} from '../types';
export function getGameLine(tree: GameTree, nodeId: number): Array<number> {
	let node = tree.nodes[nodeId];

	if (!node) {
		throw new InvariantError('No node with id ' + nodeId);
	}

	// Go to end of line first
	let child = node.children[0];

	while (typeof child === 'number') {
		nodeId = child;
		node = tree.nodes[child];

		if (!node) {
			throw new InvariantError('No node with id ' + nodeId);
		}

		child = node.children[0];
	}

	// Now traverse back to root
	const line = [nodeId];
	let parent = node.parent;

	while (typeof parent === 'number') {
		line.push(parent);
		node = tree.nodes[parent];
		parent = node.parent;
	}

	line.reverse();
	return line;
}
export function validateRuleSet(ruleset: unknown): GameRuleSet {
	if (
		ruleset === 'japanese' ||
		ruleset === 'chinese' ||
		ruleset === 'aga' ||
		ruleset === 'new_zealand'
	) {
		return ruleset;
	}

	throw new InvariantError('Invalid ruleset ' + String(ruleset));
}
const BOARD_MARKS: Record<string, BoardPointMark> = {
	CIRCLE: 'circle',
	TRIANGLE: 'triangle',
	SQUARE: 'square',
	CROSS: 'cross',
	DEAD: 'dead'
};
export function getMarkupForProps(props: Array<SgfProp>): BoardMarkup {
	const markup: BoardMarkup = {
		marks: {},
		labels: {}
	};

	for (const prop of props) {
		const loc = prop.loc;

		if (!loc || loc === 'PASS') {
			continue;
		}

		if (prop.name === 'MOVE') {
			if (!markup.marks[loc.y]) {
				markup.marks[loc.y] = {};
			}

			markup.marks[loc.y][loc.x] = 'active';
		} else {
			let mark = BOARD_MARKS[prop.name];

			if (!mark && prop.name === 'TERRITORY') {
				mark = prop.color === 'black' ? 'blackTerritory' : 'whiteTerritory';
			}

			if (mark) {
				if (!markup.marks[loc.y]) {
					markup.marks[loc.y] = {};
				}

				markup.marks[loc.y][loc.x] = mark;
			} else if (prop.name === 'LABEL') {
				const label = typeof prop.text === 'string' ? prop.text : null;

				if (label) {
					if (!markup.labels[loc.y]) {
						markup.labels[loc.y] = {};
					}

					markup.labels[loc.y][loc.x] = label;
				}
			}
		}
	}

	return markup;
}

function addPendingMoveMarkup(markup: BoardMarkup, pendingMove: PendingMove) {
	const { x, y } = pendingMove.loc;

	if (!markup.marks[y]) {
		markup.marks[y] = {};
	}

	markup.marks[y][x] = pendingMove.color === 'white' ? 'pendingWhite' : 'pendingBlack';
}

export function computeGameNodeStates(
	tree: GameTree,
	nodeId: number
): Record<number, GameNodeComputedState> {
	const line = getGameLine(tree, nodeId);

	if (!line.length) {
		throw new InvariantError('Unexpected empty game line');
	}

	// Determine rules to use
	const rootNode = tree.nodes[tree.rootNode];
	// The RULES prop of the root carries the game settings beyond SgfProp.
	const rulesProp: (SgfProp & { size?: unknown; rules?: unknown; mainTime?: unknown }) | undefined =
		rootNode.props.find((p) => p.name === 'RULES');
	const size = rulesProp && typeof rulesProp.size === 'number' ? rulesProp.size : 19;
	const ruleset: GameRuleSet =
		rulesProp && typeof rulesProp.rules !== 'undefined'
			? validateRuleSet(rulesProp.rules)
			: 'japanese';
	const mainTime = rulesProp && typeof rulesProp.mainTime === 'number' ? rulesProp.mainTime : -1;
	// Don't redo already-computed state. Anything that happened before
	// the node we're looking at is still valid.
	const computedState: Record<number, GameNodeComputedState> = { ...tree.computedState };
	let startIdx = line.indexOf(nodeId);
	let blackCaps;
	let whiteCaps;
	let blackTimeLeft;
	let whiteTimeLeft;
	let board;

	if (startIdx > 0 && computedState[line[startIdx - 1]]) {
		const prevState = computedState[line[startIdx - 1]];
		blackCaps = prevState.blackCaptures;
		whiteCaps = prevState.whiteCaptures;
		blackTimeLeft = prevState.blackTimeLeft;
		whiteTimeLeft = prevState.whiteTimeLeft;
		board = prevState.board;
	} else {
		startIdx = 0;
		blackCaps = 0;
		whiteCaps = 0;
		blackTimeLeft = mainTime;
		whiteTimeLeft = mainTime;
		board = createBoardState(size);
	}

	for (let i = startIdx; i < line.length; i++) {
		const cursorId = line[i];
		const node = tree.nodes[cursorId];
		const ret = applyPropsToBoard(node.props, board, ruleset);
		const markup = getMarkupForProps(node.props);

		if (tree.pendingMove && tree.pendingMove.nodeId === cursorId) {
			addPendingMoveMarkup(markup, tree.pendingMove);
		}

		board = ret.board;
		blackCaps += ret.blackCaptures;
		whiteCaps += ret.whiteCaptures;

		for (const prop of node.props) {
			if (prop.name === 'TIMELEFT' && prop.float) {
				if (prop.color === 'black') {
					blackTimeLeft = prop.float;
				} else {
					whiteTimeLeft = prop.float;
				}
			}
		}

		computedState[cursorId] = {
			blackCaptures: blackCaps,
			whiteCaptures: whiteCaps,
			blackTimeLeft,
			whiteTimeLeft,
			board,
			markup
		};
	}

	return computedState;
}
export function isGameOverNode(game: GameChannel, nodeId: number) {
	const tree = game.tree;

	if (!tree || !game.over) {
		return false;
	}

	return (
		// Last node in the branch
		!tree.nodes[nodeId].children.length && // Game being played - i.e., not a review
		(game.type === 'free' ||
			game.type === 'ranked' ||
			game.type === 'simul' ||
			game.type === 'rengo' ||
			game.type === 'tournament')
	);
}
export function isGamePlaying(game: GameChannel) {
	return (
		!game.over &&
		(game.type === 'free' ||
			game.type === 'ranked' ||
			game.type === 'simul' ||
			game.type === 'rengo' ||
			game.type === 'tournament')
	);
}

function getGameNodeActions(game: GameChannel, nodeId: number) {
	const actions: Array<string> = [];

	if (!game.tree) {
		return actions;
	}

	const passProp = game.tree.nodes[nodeId].props.find((p) => p.loc === 'PASS');

	if (passProp) {
		actions.push((passProp.color === 'black' ? 'Black' : 'White') + ' passed');
	}

	if (isGameOverNode(game, nodeId) && game.score) {
		actions.push('Game Over: ' + formatGameScore(game.score));
	}

	return actions;
}

export function getGameChatSections(game: GameChannel): Array<GameChatSection> {
	const sections: Array<GameChatSection> = [];
	const tree = game.tree;

	if (!tree) {
		return sections;
	}

	const line = getGameLine(tree, tree.activeNode);

	for (let i = 0; i < line.length; i++) {
		const nodeId = line[i];
		const messages = tree.messages[nodeId];
		const actions = getGameNodeActions(game, nodeId);

		if ((messages && messages.length) || actions.length) {
			sections.push({
				nodeId,
				moveNum: i,
				actions,
				messages
			});
		}
	}

	return sections;
}
export function isGameProposalPlayer(name: string, proposal: GameProposal) {
	return !!proposal.players.find((p) => p.name === name || (p.user && p.user.name === name));
}
export function getGamePlayerRole(name: string, players: GamePlayers): GameRole | null | undefined {
	for (const role of Object.keys(players)) {
		if (players[role as GameRole]?.name === name) {
			return role as any;
		}
	}

	return null;
}
export function isGamePlayer(name: string, players: GamePlayers) {
	return !!getGamePlayerRole(name, players);
}
export function isPlayerMove(game: GameChannel, name: string) {
	const actions = game.actions;

	if (!actions) {
		return false;
	}

	const moveAction = actions.find((a) => a.action === 'MOVE');
	return !!(moveAction && moveAction.user.name === name);
}
export function getGamePlayerOtherRole(
	name: string,
	players: GamePlayers
): GameRole | null | undefined {
	for (const role of Object.keys(players)) {
		if (players[role as GameRole]?.name !== name) {
			return role as any;
		}
	}

	return null;
}
export function isGameScoring(game: GameChannel) {
	if (game.over || !game.actions) {
		return false;
	}

	return !!game.actions.find((a) => a.action === 'SCORE');
}
export function getGameRoleColor(role: GameRole): PlayerColor | null | undefined {
	if (role === 'white' || role === 'white_2') {
		return 'white';
	}

	if (role === 'black' || role === 'black_2') {
		return 'black';
	}

	return null;
}
export function getKgsSgfUrl(summary: GameSummary) {
	const [y, m, d] = summary.timestamp.split('-');
	const player1 = summary.players.white || summary.players.owner;
	if (!player1) {
		throw new InvariantError('Game summary without white player or owner');
	}
	const black = summary.players.black;
	let url =
		'https://files.gokgs.com/games/' +
		y +
		'/' +
		parseInt(m, 10) +
		'/' +
		parseInt(d, 10) +
		'/' +
		player1.name;

	if (
		summary.type !== 'demonstration' &&
		summary.type !== 'review' &&
		summary.type !== 'rengo_review' &&
		black
	) {
		url += '-' + black.name;
	}

	if (summary.revision) {
		url += '-' + (parseInt(summary.revision, 10) + 1);
	}

	url += '.sgf';
	return url;
}
export function getActionsForUser(
	actions:
		| Array<{
				action: GameAction;
				user: UnparsedUser;
		  }>
		| null
		| undefined,
	name: string
): Partial<Record<GameAction, true>> {
	const ret: Partial<Record<GameAction, true>> = {};

	if (!actions) {
		return ret;
	}

	for (const action of actions) {
		if (action.user.name === name) {
			ret[action.action] = true;
		}
	}

	return ret;
}
