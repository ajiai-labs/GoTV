import {
  getPvPoints,
  parseGtpMove,
  compareGameMove,
  getGameNextMove,
  getKataGoPosition,
  toAnalysis,
} from "./KataGoEngine";
import { parseSgf } from "./sgf";
import { getMainLine, playVariationMove } from "./ReplayVariation";

describe("KataGo position", () => {
  it("passes board, player to move, moves, komi and rules", () => {
    let tree = parseSgf("(;GM[1]SZ[9]KM[7.5]RU[Chinese];B[cc];W[gg];B[])");
    let line = getMainLine(tree);
    let position = getKataGoPosition(tree, line[2]);
    expect(position.currentPlayer).toBe("black");
    expect(position.moveHistory).toEqual([
      { x: 2, y: 2, player: "black" },
      { x: 6, y: 6, player: "white" },
    ]);
    expect(position.board[2][2]).toBe("black");
    expect(position.board).toHaveLength(9);
    expect(position.komi).toBe(7.5);
    expect(position.rules).toBe("chinese");
    // A pass is sent as -1/-1.
    expect(getKataGoPosition(tree, line[3]).moveHistory[2]).toEqual({
      x: -1,
      y: -1,
      player: "black",
    });
  });

  it("follows an own variation", () => {
    let tree = parseSgf("(;GM[1]SZ[9];B[cc];W[gg])");
    let line = getMainLine(tree);
    let played = playVariationMove(tree, line[1], { x: 4, y: 4 });
    let position = getKataGoPosition(played.tree, played.nodeId);
    expect(position.moveHistory[1]).toEqual({ x: 4, y: 4, player: "white" });
    expect(getGameNextMove(played.tree, played.nodeId)).toBe(null);
  });
});

describe("KataGo lines", () => {
  it("reads GTP moves like the board labels", () => {
    expect(parseGtpMove("Q16", 19)).toEqual({ x: 15, y: 3 });
    expect(parseGtpMove("j1", 19)).toEqual({ x: 8, y: 18 });
    expect(parseGtpMove("pass", 19)).toBe(null);
    expect(parseGtpMove("T20", 19)).toBe(null);
    expect(parseGtpMove("I5", 19)).toBe(null);
  });

  it("turns the expected line into points up to a pass", () => {
    let move = { x: 15, y: 3, pv: ["Q16", "D4", "pass", "Q4"] };
    expect(getPvPoints(move, 19)).toEqual([
      { x: 15, y: 3 },
      { x: 3, y: 15 },
    ]);
    expect(getPvPoints({ x: 2, y: 2, pv: [] }, 9)).toEqual([{ x: 2, y: 2 }]);
  });
});

describe("KataGo results", () => {
  let analysis = toAnalysis(
    {
      rootWinRate: 0.62,
      rootScoreLead: 3.4,
      rootVisits: 100,
      moves: [
        {
          x: 3,
          y: 3,
          winRate: 0.63,
          scoreLead: 3.6,
          visits: 60,
          pointsLost: 0,
          order: 0,
        },
        {
          x: -1,
          y: -1,
          winRate: 0.4,
          scoreLead: 0,
          visits: 1,
          pointsLost: 9,
          order: 9,
        },
        {
          x: 15,
          y: 15,
          winRate: 0.58,
          scoreLead: 2.1,
          visits: 30,
          pointsLost: 1.5,
          order: 1,
        },
      ],
    },
    "black",
    "wasm"
  );

  it("keeps the top moves on the board, black's view", () => {
    expect(analysis.winRate).toBe(0.62);
    expect(analysis.moves.map((move) => [move.x, move.y])).toEqual([
      [3, 3],
      [15, 15],
    ]);
    expect(analysis.backend).toBe("wasm");
  });

  it("compares the game's move with KataGo's best", () => {
    expect(compareGameMove(analysis, { x: 3, y: 3 })).toBe(null);
    expect(compareGameMove(analysis, { x: 15, y: 15 })).toEqual({
      best: analysis.moves[0],
      played: analysis.moves[1],
    });
    expect(compareGameMove(analysis, { x: 9, y: 9 })).toEqual({
      best: analysis.moves[0],
      played: null,
    });
    expect(compareGameMove(analysis, null)).toBe(null);
  });

  it("finds the game's next move on the main line", () => {
    let tree = parseSgf("(;GM[1]SZ[9];B[cc];W[gg])");
    let line = getMainLine(tree);
    expect(getGameNextMove(tree, line[1])).toEqual({
      x: 6,
      y: 6,
      color: "white",
    });
    expect(getGameNextMove(tree, line[2])).toBe(null);
  });
});
