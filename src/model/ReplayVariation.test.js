import { parseSgf } from "./sgf";
import {
  getBranchPoint,
  getColorToPlay,
  getMainLine,
  isOnMainLine,
  playVariationMove,
  returnToGame,
} from "./ReplayVariation";

// 9x9: B C3 (cg), W G7 (gc), B C7 (cc).
const SGF = "(;GM[1]SZ[9];B[cg];W[gc];B[cc])";

function stoneAt(tree, nodeId, x, y) {
  return tree.computedState[nodeId].board[y][x];
}

describe("ReplayVariation", () => {
  it("plays an own move as a side branch and keeps the game as main line", () => {
    let tree = parseSgf(SGF);
    let mainLine = getMainLine(tree);
    let afterFirst = mainLine[1];
    expect(getColorToPlay(tree, afterFirst)).toBe("white");
    let played = playVariationMove(tree, afterFirst, { x: 4, y: 4 });
    expect(played).not.toBe(null);
    let { tree: next, nodeId } = played;
    expect(stoneAt(next, nodeId, 4, 4)).toBe("white");
    expect(isOnMainLine(next, nodeId)).toBe(false);
    expect(getBranchPoint(next, nodeId)).toBe(afterFirst);
    // The game itself is unchanged and still the first child.
    expect(getMainLine(next)).toEqual(mainLine);
    expect(tree.nodes[afterFirst].children).toHaveLength(1);
    // Next own move alternates the colour.
    expect(getColorToPlay(next, nodeId)).toBe("black");
  });

  it("follows the game when the click is the game's next move", () => {
    let tree = parseSgf(SGF);
    let mainLine = getMainLine(tree);
    let played = playVariationMove(tree, mainLine[1], { x: 6, y: 2 });
    expect(played.nodeId).toBe(mainLine[2]);
    expect(isOnMainLine(played.tree, played.nodeId)).toBe(true);
  });

  it("refuses an occupied point", () => {
    let tree = parseSgf(SGF);
    expect(playVariationMove(tree, getMainLine(tree)[1], { x: 2, y: 6 })).toBe(
      null
    );
  });

  it("captures with the existing board rules", () => {
    // Black stone at A1 (ai), white at B1 (bi), then white A2 captures.
    let tree = parseSgf("(;GM[1]SZ[9];B[ai];W[bi];B[ee])");
    let line = getMainLine(tree);
    let played = playVariationMove(tree, line[3], { x: 0, y: 7 });
    expect(stoneAt(played.tree, played.nodeId, 0, 8)).toBe(null);
    expect(played.tree.computedState[played.nodeId].whiteCaptures).toBe(1);
  });

  it("returns to the game where the variation left it", () => {
    let tree = parseSgf(SGF);
    let mainLine = getMainLine(tree);
    let first = playVariationMove(tree, mainLine[1], { x: 4, y: 4 });
    let second = playVariationMove(first.tree, first.nodeId, { x: 5, y: 5 });
    let back = returnToGame(second.tree, second.nodeId);
    expect(back.currentNode).toBe(mainLine[1]);
    expect(back.currentLine).toEqual(mainLine);
  });
});
