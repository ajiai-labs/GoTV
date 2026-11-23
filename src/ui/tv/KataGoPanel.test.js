import React from "react";
import ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";
import KataGoPanel, { formatPoint } from "./KataGoPanel";
import { parseSgf } from "../../model/sgf";
import { getMainLine } from "../../model/ReplayVariation";
import * as engineModule from "../../model/KataGoEngine";

describe("KataGoPanel", () => {
  let container;
  let analyze;

  beforeEach(() => {
    jest.useFakeTimers();
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    analyze = jest.fn(() =>
      Promise.resolve({
        winRate: 0.7,
        scoreLead: -2.5,
        visits: 100,
        toPlay: "white",
        backend: "wasm",
        moves: [
          {
            x: 4,
            y: 4,
            winRate: 0.68,
            scoreLead: -2.4,
            visits: 70,
            pointsLost: 0,
            order: 0,
          },
          {
            x: 6,
            y: 6,
            winRate: 0.75,
            scoreLead: -1.2,
            visits: 20,
            pointsLost: 1.2,
            order: 1,
          },
        ],
      })
    );
    jest.spyOn(engineModule, "getKataGoEngine").mockReturnValue({
      analyze,
      cancel: jest.fn(),
      setModelUrl: jest.fn(),
    });
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("names points like the board (no I column)", () => {
    expect(formatPoint(0, 0, 19)).toBe("A19");
    expect(formatPoint(8, 18, 19)).toBe("J1");
    expect(formatPoint(15, 3, 19)).toBe("Q16");
  });

  it("stays off until switched on, then rates the game's move", async () => {
    let tree = parseSgf("(;GM[1]SZ[9];B[cc];W[gg])");
    let nodeId = getMainLine(tree)[1];
    let onMoves = jest.fn();
    act(() => {
      ReactDOM.render(
        <KataGoPanel tree={tree} nodeId={nodeId} onMoves={onMoves} />,
        container
      );
    });
    expect(analyze).not.toHaveBeenCalled();
    expect(container.textContent).toContain("rechnet im Browser");
    act(() => container.querySelector(".KataGoPanel-switch input").click());
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });
    expect(analyze).toHaveBeenCalledWith(tree, nodeId, 100);
    let text = container.querySelector(".KataGoPanel-body").textContent;
    expect(text).toContain("Gewinnchance Schwarz 70 %");
    expect(text).toContain("Weiß führt mit 2,5 Punkten");
    // The game played G3 (6,6): KataGo's second choice, 1.2 points worse.
    expect(container.querySelector(".KataGoPanel-compare").textContent).toBe(
      "Die Partie spielte G3: laut KataGo 1,2 Punkte schlechter als E5."
    );
    expect(onMoves).toHaveBeenLastCalledWith(nodeId, expect.any(Array));
    expect(window.localStorage.getItem("gotv.katago")).toBe("1");
  });
});
