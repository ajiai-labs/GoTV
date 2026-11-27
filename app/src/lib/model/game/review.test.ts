// Editing a KGS review (27.11.2026): what goes to KGS for a click and for
// moving through the game - checked against the documented SGF events.
import { describe, expect, it } from 'vitest';
import { parseSgf } from '../sgf';
import type { GameChannel, GameTree } from '../types';
import {
	activateMessage,
	canEditReview,
	getReviewEditor,
	giveControlMessage,
	isReviewOwner,
	nextNodeId,
	reviewMarkMessage,
	reviewMoveMessage,
	saveReviewMessage
} from './review';

function atEnd(sgf: string): GameTree {
	const tree = parseSgf(sgf);
	const last = tree.currentLine[tree.currentLine.length - 1];
	return { ...tree, activeNode: last, currentNode: last };
}

function review(tree: GameTree, editor = 'andy1975', type = 'review'): GameChannel {
	return {
		id: 77,
		type,
		tree,
		actions: [{ action: 'EDIT', user: { name: editor } }]
	} as unknown as GameChannel;
}

describe('KGS review editing', () => {
	it('knows who holds the control, only in reviews and demonstrations', () => {
		const tree = atEnd('(;GM[1]SZ[9];B[cc])');
		expect(getReviewEditor(review(tree))).toBe('andy1975');
		expect(canEditReview(review(tree), 'Andy1975')).toBe(true);
		expect(canEditReview(review(tree, 'anna'), 'andy1975')).toBe(false);
		expect(getReviewEditor(review(tree, 'andy1975', 'ranked'))).toBeNull();
		expect(canEditReview(review(tree, 'andy1975', 'demonstration'), 'andy1975')).toBe(true);
	});

	it('sends a new node with the move of the side to play', () => {
		const tree = atEnd('(;GM[1]SZ[9];B[cc])');
		const parent = tree.currentNode;
		const result = reviewMoveMessage(review(tree), tree, parent, { x: 4, y: 4 });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const id = nextNodeId(tree);
		expect(tree.nodes[id]).toBeUndefined();
		expect(result.message).toEqual({
			type: 'KGS_SGF_CHANGE',
			channelId: 77,
			sgfEvents: [
				{ type: 'CHILD_ADDED', nodeId: parent, childNodeId: id, position: 0 },
				{ type: 'ACTIVATED', nodeId: id, prevNodeId: parent },
				{
					type: 'PROP_ADDED',
					nodeId: id,
					prop: { name: 'MOVE', color: 'white', loc: { x: 4, y: 4 } }
				}
			]
		});
	});

	it('goes to the existing continuation instead of adding it twice', () => {
		const tree = atEnd('(;GM[1]SZ[9];B[cc];W[ee])');
		const [, first, second] = tree.currentLine;
		const result = reviewMoveMessage(review(tree), tree, first, { x: 4, y: 4 });
		expect(result).toEqual({ ok: true, message: activateMessage(review(tree), tree, second) });
	});

	it('adds a variation as a further child, after the game move', () => {
		const tree = atEnd('(;GM[1]SZ[9];B[cc];W[ee])');
		const first = tree.currentLine[1];
		const result = reviewMoveMessage(review(tree), tree, first, { x: 6, y: 6 });
		expect(result.ok && result.message.sgfEvents[0]).toMatchObject({
			type: 'CHILD_ADDED',
			nodeId: first,
			position: 1
		});
	});

	it('refuses a taken point and a suicide', () => {
		// White to move; a1 (x 0, y 8) is surrounded by black.
		const tree = atEnd('(;GM[1]SZ[9];B[ah];W[ee];B[bi])');
		const node = tree.currentNode;
		expect(reviewMoveMessage(review(tree), tree, node, { x: 0, y: 7 })).toEqual({
			ok: false,
			error: 'occupied'
		});
		expect(reviewMoveMessage(review(tree), tree, node, { x: 0, y: 8 })).toEqual({
			ok: false,
			error: 'suicide'
		});
	});

	it('puts a mark on the node shown and takes it away again', () => {
		const tree = atEnd('(;GM[1]SZ[9];B[cc])');
		const node = tree.currentNode;
		const add = reviewMarkMessage(review(tree), tree, node, { x: 4, y: 4 }, 'TRIANGLE');
		expect(add.sgfEvents).toEqual([
			{ type: 'PROP_ADDED', nodeId: node, prop: { name: 'TRIANGLE', loc: { x: 4, y: 4 } } }
		]);
		const marked = atEnd('(;GM[1]SZ[9];B[cc]TR[ee])');
		const remove = reviewMarkMessage(
			review(marked),
			marked,
			marked.currentNode,
			{ x: 4, y: 4 },
			'TRIANGLE'
		);
		expect(remove.sgfEvents[0]).toMatchObject({ type: 'PROP_REMOVED', prop: { name: 'TRIANGLE' } });
	});

	it('gives letters in order, A first, then the next free one', () => {
		const tree = atEnd('(;GM[1]SZ[9];B[cc]LB[ee:A])');
		const message = reviewMarkMessage(
			review(tree),
			tree,
			tree.currentNode,
			{ x: 5, y: 5 },
			'LABEL'
		);
		expect(message.sgfEvents[0]).toMatchObject({ prop: { name: 'LABEL', text: 'B' } });
	});

	it('the owner gives the control away and saves the review', () => {
		const tree = atEnd('(;GM[1]SZ[9];B[cc])');
		const game = { ...review(tree), players: { owner: { name: 'andy1975' } } } as GameChannel;
		expect(isReviewOwner(game, 'ANDY1975')).toBe(true);
		expect(isReviewOwner(game, 'anna')).toBe(false);
		expect(giveControlMessage(game, 'anna')).toEqual({
			type: 'GAME_SET_ROLES',
			channelId: 77,
			owner: 'anna'
		});
		expect(saveReviewMessage(game)).toEqual({
			type: 'GAME_LIST_ENTRY_SET_FLAGS',
			channelId: 77,
			saved: true
		});
	});
});
