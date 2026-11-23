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
