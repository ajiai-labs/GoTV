import React from "react";
import ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";
import SgfReplayView, { getReadableComment } from "./SgfReplayView";
import { parseSgf } from "../../model/sgf";

describe("SgfReplayView", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
  });

  it("shows the result only at the last move", () => {
    let tree = parseSgf("(;SZ[9]PB[a]PW[b]RE[B+R];B[aa];W[bb])");
    tree.currentNode = tree.currentLine[0];
    act(() => {
      ReactDOM.render(<SgfReplayView initialTree={tree} />, container);
    });
    expect(container.querySelector(".SgfReplay-result")).toBe(null);
    act(() => container.querySelector(".BoardNav-last").click());
    expect(container.querySelector(".SgfReplay-result").textContent).toBe(
      " · B+R"
    );
  });

  it("drops OGS chat lines without readable text", () => {
    expect(getReadableComment("Kravets: [object Object]")).toBe(null);
    expect(
      getReadableComment("Fan: schöner Zug\nKravets: [object Object]\n")
    ).toBe("Fan: schöner Zug");
    expect(getReadableComment(undefined)).toBe(null);
  });
});
