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

// `reserved`: node ids this client sent already and KGS may not have
// confirmed yet - never given twice (review 27.11.2026: a late answer let a
// second change reuse the id, and a strict server ends the session on that).
export function nextNodeId(tree: GameTree, reserved: Iterable<number> = []): number {
	const taken = new Set(reserved);
	let id = 1;
	while (tree.nodes[id] || taken.has(id)) id++;
	return id;
}

// Whether KGS's answer (GAME_UPDATE) carries a change we sent: the same
// event on the same node.
export function confirmsChange(sent: SgfEvent, received: Array<SgfEvent>): boolean {
	return received.some((event) => {
		if (event.type !== sent.type || event.nodeId !== sent.nodeId) return false;
		if (event.type === 'CHILD_ADDED' && sent.type === 'CHILD_ADDED') {
			return event.childNodeId === sent.childNodeId;
		}
		if ('prop' in event && 'prop' in sent) {
			const a = event.prop;
			const b = sent.prop;
			return a.name === b.name && JSON.stringify(a.loc ?? null) === JSON.stringify(b.loc ?? null);
		}
		return true;
	});
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
	loc: Point,
	reserved: Iterable<number> = []
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
	const childId = nextNodeId(tree, reserved);
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

// Marks on the board of a review (CGoban: triangle, square, circle, cross,
// letters). A click with a tool puts the mark on the node shown, a second
// click on the same mark takes it away. Letters go A, B, C … per node.
export type ReviewTool = 'stone' | 'TRIANGLE' | 'SQUARE' | 'CIRCLE' | 'CROSS' | 'LABEL';

function nextLabel(tree: GameTree, nodeId: number): string {
	const used = new Set(
		tree.nodes[nodeId].props.filter((prop) => prop.name === 'LABEL').map((prop) => prop.text)
	);
	for (let code = 65; code <= 90; code++) {
		const letter = String.fromCharCode(code);
		if (!used.has(letter)) return letter;
	}
	return String(used.size + 1);
}

export function reviewMarkMessage(
	game: GameChannel,
	tree: GameTree,
	nodeId: number,
	loc: Point,
	tool: Exclude<ReviewTool, 'stone'>
): KgsMessage {
	const existing = tree.nodes[nodeId].props.find(
		(prop) => prop.name === tool && !!prop.loc && prop.loc !== 'PASS' && samePoint(prop.loc, loc)
	);
	const sgfEvents: Array<SgfEvent> = existing
		? [{ type: 'PROP_REMOVED', nodeId, prop: existing }]
		: [
				{
					type: 'PROP_ADDED',
					nodeId,
					prop:
						tool === 'LABEL'
							? { name: tool, loc, text: nextLabel(tree, nodeId) }
							: { name: tool, loc }
				}
			];
	return { type: 'KGS_SGF_CHANGE', channelId: game.id, sgfEvents };
}

// The owner of a review (who loaded or started it) gives the control to
// another user and can take it back (GAME_SET_ROLES, role "owner").
export function isReviewOwner(game: GameChannel, name: string): boolean {
	const owner = game.players?.owner?.name;
	return !!owner && !!name && owner.toLowerCase() === name.toLowerCase();
}

export function giveControlMessage(game: GameChannel, name: string): KgsMessage {
	return { type: 'GAME_SET_ROLES', channelId: game.id, owner: name };
}

// Reviews are not kept in the KGS archive by themselves: the owner saves
// them (flag "saved", as CGoban's "Spiel speichern?" on closing).
export function saveReviewMessage(game: GameChannel): KgsMessage {
	return { type: 'GAME_LIST_ENTRY_SET_FLAGS', channelId: game.id, saved: true };
}
