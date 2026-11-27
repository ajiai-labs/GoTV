// Editing a KGS review or demonstration (27.11.2026, as in CGoban): whoever
// holds the control ("Kontrolle", action EDIT in GAME_STATE) puts stones and
// moves through the game for everyone in the channel. KGS_SGF_CHANGE carries
// the change; KGS sends it back to all users (also to us) as GAME_UPDATE, and
// only that changes the board here - nothing is drawn ahead of KGS.
//
// Protocol (gokgs.com/json, SGF events): a move is a new child node of the
// current node with a MOVE property, activated at once. A client names the
// new node itself: the lowest free node id (as other KGS clients do).
import { getColorToPlay, getMoveError, getNodeMove } from '../ReplayVariation';
import type { GameChannel, GameTree, KgsMessage, Point, PlayerColor, SgfEvent } from '../types';

const EDITABLE_TYPES = ['review', 'rengo_review', 'demonstration'];

// Who holds the control of a review, or null (a game that is played).
export function getReviewEditor(game: GameChannel): string | null {
	if (!EDITABLE_TYPES.includes(game.type)) return null;
	const edit = game.actions?.find((item) => item.action === 'EDIT');
	return edit?.user?.name ?? null;
}

export function canEditReview(game: GameChannel, name: string): boolean {
	const editor = getReviewEditor(game);
	return !!game.tree && !!name && !!editor && editor.toLowerCase() === name.toLowerCase();
}

export function nextNodeId(tree: GameTree): number {
	let id = 1;
	while (tree.nodes[id]) id++;
	return id;
}

function samePoint(a: Point | null | undefined, b: Point): boolean {
	return !!a && a.x === b.x && a.y === b.y;
}

export type ReviewMoveResult =
	{ ok: true; message: KgsMessage } | { ok: false; error: 'occupied' | 'suicide' | 'ko' };

// What to send for a click on loc while the board shows nodeId: going to an
// existing child that plays loc, or a new node with the move.
export function reviewMoveMessage(
	game: GameChannel,
	tree: GameTree,
	nodeId: number,
	loc: Point
): ReviewMoveResult {
	const color: PlayerColor = getColorToPlay(tree, nodeId);
	const existing = tree.nodes[nodeId].children.find((child) => {
		const move = tree.nodes[child]?.props.find((prop) => prop.name === 'MOVE');
		return move?.color === color && samePoint(getNodeMove(tree, child), loc);
	});
	if (existing !== undefined) {
		return { ok: true, message: activateMessage(game, tree, existing) };
	}
	const error = getMoveError(tree, nodeId, loc);
	if (error) return { ok: false, error };
	const childId = nextNodeId(tree);
	const sgfEvents: Array<SgfEvent> = [
		{
			type: 'CHILD_ADDED',
			nodeId,
			childNodeId: childId,
			position: tree.nodes[nodeId].children.length
		},
		{ type: 'ACTIVATED', nodeId: childId, prevNodeId: tree.activeNode },
		{ type: 'PROP_ADDED', nodeId: childId, prop: { name: 'MOVE', color, loc } }
	];
	return { ok: true, message: { type: 'KGS_SGF_CHANGE', channelId: game.id, sgfEvents } };
}

// Shows nodeId to everyone in the review.
export function activateMessage(game: GameChannel, tree: GameTree, nodeId: number): KgsMessage {
	return {
		type: 'KGS_SGF_CHANGE',
		channelId: game.id,
		sgfEvents: [{ type: 'ACTIVATED', nodeId, prevNodeId: tree.activeNode }]
	};
}
