// @flow
// Trying own moves while replaying ("Partie untersuchen"): a click puts a
// stone as a new side branch of the game tree, entirely in the browser.
// The game itself stays the first child everywhere ("Hauptlinie"), so the
// move list, navigation and the hidden result keep following the game.
// Captures come from the existing board logic (computeGameNodeStates).
import { GameNode } from "./types";
import { computeGameNodeStates, getGameLine } from "./game/tree";
import type { GameTree, Point, PlayerColor } from "./types";

// The game as played: root, then always the first child.
export function getMainLine(tree: GameTree): Array<number> {
  return getGameLine(tree, tree.rootNode);
}

export function isOnMainLine(tree: GameTree, nodeId: number): boolean {
  return getMainLine(tree).includes(nodeId);
}

// The last move of the game shown so far: where an own variation starts
// (null on the main line).
export function getBranchPoint(tree: GameTree, nodeId: number): ?number {
  let mainLine = getMainLine(tree);
  let cursor = nodeId;
  while (typeof cursor === "number" && !mainLine.includes(cursor)) {
    cursor = tree.nodes[cursor].parent;
  }
  return cursor === nodeId ? null : cursor;
}

function getMoveColor(tree: GameTree, nodeId: number): ?PlayerColor {
  let move = tree.nodes[nodeId].props.find((prop) => prop.name === "MOVE");
  return move && (move.color === "black" || move.color === "white")
    ? move.color
    : null;
}

// Who moves after nodeId: the opposite of the last move; at the start
// black, or white when black got handicap stones.
export function getColorToPlay(tree: GameTree, nodeId: number): PlayerColor {
  let cursor = nodeId;
  while (typeof cursor === "number") {
    let color = getMoveColor(tree, cursor);
    if (color) {
      return color === "black" ? "white" : "black";
    }
    cursor = tree.nodes[cursor].parent;
  }
  let root = tree.nodes[tree.rootNode];
  let handicapStones = root.props.filter(
    (prop) => prop.name === "ADDSTONE" && prop.color === "black"
  ).length;
  return handicapStones > 1 ? "white" : "black";
}

function findChildWithMove(
  tree: GameTree,
  nodeId: number,
  loc: Point,
  color: PlayerColor
): ?number {
  return tree.nodes[nodeId].children.find((childId) =>
    tree.nodes[childId].props.some(
      (prop) =>
        prop.name === "MOVE" &&
        prop.color === color &&
        prop.loc &&
        prop.loc !== "PASS" &&
        prop.loc.x === loc.x &&
        prop.loc.y === loc.y
    )
  );
}

// Plays loc after nodeId. Returns the new tree (the old one is untouched)
// and the node now shown, or null when the point is taken. Playing the
// game's own next move just follows the game.
export function playVariationMove(
  tree: GameTree,
  nodeId: number,
  loc: Point
): ?{ tree: GameTree, nodeId: number } {
  let state = tree.computedState[nodeId];
  let board = state
    ? state.board
    : computeGameNodeStates(tree, nodeId)[nodeId].board;
  if (!board[loc.y] || board[loc.y][loc.x]) {
    return null;
  }
  let color = getColorToPlay(tree, nodeId);
  let existing = findChildWithMove(tree, nodeId, loc, color);
  let next: GameTree = { ...tree };
  let childId;
  if (typeof existing === "number") {
    childId = existing;
  } else {
    childId = Math.max(...Object.keys(tree.nodes).map(Number)) + 1;
    let parent = tree.nodes[nodeId];
    next.nodes = {
      ...tree.nodes,
      [nodeId]: new GameNode(
        parent.props,
        [...parent.children, childId],
        parent.parent
      ),
      [childId]: new GameNode(
        [{ name: "MOVE", color, loc: { x: loc.x, y: loc.y } }],
        [],
        nodeId
      ),
    };
  }
  next.computedState = computeGameNodeStates(next, childId);
  next.currentLine = getGameLine(next, childId);
  next.currentNode = childId;
  return { tree: next, nodeId: childId };
}

// Back to the game where the variation left it.
export function returnToGame(tree: GameTree, nodeId: number): GameTree {
  let branch = getBranchPoint(tree, nodeId);
  let target = typeof branch === "number" ? branch : nodeId;
  return {
    ...tree,
    currentNode: target,
    currentLine: getMainLine(tree),
  };
}

// Plays a sequence of moves after nodeId (e.g. KataGo's expected line),
// stopping at a taken point. The first new node can carry a comment.
// Returns null when not even the first move fits.
export function playVariationLine(
  tree: GameTree,
  nodeId: number,
  points: Array<Point>,
  comment?: string
): ?{ tree: GameTree, firstNodeId: number } {
  let current = tree;
  let cursor = nodeId;
  let firstNodeId = null;
  for (let point of points) {
    let played = playVariationMove(current, cursor, point);
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
    let first = current.nodes[firstNodeId];
    if (!first.props.some((prop) => prop.name === "COMMENT")) {
      current = {
        ...current,
        nodes: {
          ...current.nodes,
          [firstNodeId]: new GameNode(
            [...first.props, { name: "COMMENT", text: comment }],
            first.children,
            first.parent
          ),
        },
      };
    }
  }
  return {
    tree: {
      ...current,
      currentNode: firstNodeId,
      currentLine: getGameLine(current, firstNodeId),
    },
    firstNodeId,
  };
}

// The continuations after nodeId when there is more than one: the game's
// own move first, then the variations in the order they were laid.
export function getContinuations(
  tree: GameTree,
  nodeId: number
): Array<{ nodeId: number, isGame: boolean, comment: ?string }> {
  let children = tree.nodes[nodeId].children;
  if (children.length < 2) {
    return [];
  }
  let mainLine = getMainLine(tree);
  return children.map((childId) => {
    let commentProp: any = tree.nodes[childId].props.find(
      (prop) => prop.name === "COMMENT"
    );
    return {
      nodeId: childId,
      isGame: mainLine.includes(childId),
      comment: commentProp ? String(commentProp.text) : null,
    };
  });
}

// The move a node plays, for labels ("E5"), or null.
export function getNodeMove(tree: GameTree, nodeId: number): ?Point {
  let move: any = tree.nodes[nodeId].props.find((prop) => prop.name === "MOVE");
  return move && move.loc && move.loc !== "PASS" ? move.loc : null;
}

// Shows a continuation: the line through childId to its end.
export function showContinuation(tree: GameTree, childId: number): GameTree {
  let next = {
    ...tree,
    currentNode: childId,
    currentLine: getGameLine(tree, childId),
  };
  if (!next.computedState[childId]) {
    next.computedState = computeGameNodeStates(next, childId);
  }
  return next;
}

// Removes the own variation nodeId belongs to (from where it left the game,
// with everything after it) and returns to the game there.
export function removeVariation(tree: GameTree, nodeId: number): GameTree {
  let branch = getBranchPoint(tree, nodeId);
  if (typeof branch !== "number") {
    return tree;
  }
  // The first node of the variation: the child of the branch point on the
  // way to nodeId.
  let start = nodeId;
  while (tree.nodes[start].parent !== branch) {
    start = Number(tree.nodes[start].parent);
  }
  let removed = new Set();
  let stack = [start];
  while (stack.length) {
    let id = stack.pop();
    removed.add(id);
    stack.push(...tree.nodes[id].children);
  }
  let nodes = {};
  let computedState = {};
  for (let key of Object.keys(tree.nodes)) {
    let id = Number(key);
    if (!removed.has(id)) {
      nodes[id] = tree.nodes[id];
      if (tree.computedState[id]) {
        computedState[id] = tree.computedState[id];
      }
    }
  }
  let parent = tree.nodes[branch];
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
    currentLine: getMainLine({ ...tree, nodes }),
  };
}
