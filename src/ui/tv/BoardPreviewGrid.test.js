import React from "react";
import ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";
import BoardPreviewGrid, { getPreviewBoard } from "./BoardPreviewGrid";
import { parseSgf } from "../../model/sgf";

function game(id, extra = {}) {
  return {
    id,
    type: "free",
    players: {
      black: { name: "Schwarz" + id, rank: "5d" },
      white: { name: "Weiss" + id, rank: "4d" },
    },
    moveNum: 12,
    ...extra,
  };
}

describe("BoardPreviewGrid", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
  });

  it("draws the live position, falls back without moves", () => {
    let tree = parseSgf("(;SZ[9];B[cc];W[gg])");
    tree.activeNode = tree.currentLine[2];
    tree.computedState = require("../../model/game/tree").computeGameNodeStates(
      tree,
      tree.activeNode
    );
    let board = getPreviewBoard({ tree });
    expect(board[2][2]).toBe("black");
    expect(board[6][6]).toBe("white");
    expect(getPreviewBoard({})).toBe(null);
  });

  it("shows one tile per board and selects on click", () => {
    let tree = parseSgf("(;SZ[9];B[cc])");
    tree.activeNode = tree.currentLine[1]; // live boards follow the last move
    let onSelect = jest.fn();
    let games = [game(1, { tvSource: "ogs", tree }), game(2, { over: true })];
    act(() => {
      ReactDOM.render(
        <BoardPreviewGrid
          games={games}
          selectedKey="ogs-1"
          getKey={(g) => (g.tvSource || "kgs") + "-" + g.id}
          onSelect={onSelect}
        />,
        container
      );
    });
    let tiles = container.querySelectorAll(".BoardPreview");
    expect(tiles).toHaveLength(2);
    expect(tiles[0].getAttribute("aria-pressed")).toBe("true");
    expect(tiles[0].querySelectorAll(".BoardPreview-stone")).toHaveLength(1);
    expect(tiles[0].textContent).toContain("● Schwarz1 5d");
    expect(tiles[0].textContent).toContain("OGS");
    expect(tiles[0].textContent).toContain("Zug 12");
    // A finished game says so without its result.
    expect(tiles[1].textContent).toContain("beendet");
    expect(tiles[1].textContent).toContain("Brett nach Klick");
    act(() => tiles[1].click());
    expect(onSelect).toHaveBeenCalledWith(2, games[1]);
  });
});
