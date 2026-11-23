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

  it("lets the viewer try an own move and return to the game", () => {
    let tree = parseSgf("(;SZ[9]PB[a]PW[b]RE[B+R];B[aa];W[bb])");
    let view;
    act(() => {
      ReactDOM.render(
        <SgfReplayView
          ref={(ref) => {
            view = ref;
          }}
          initialTree={tree}
        />,
        container
      );
    });
    act(() => container.querySelector(".BoardNav-next").click());
    // White to play after B[aa]; an own move instead of the game's W[bb].
    act(() => view._onClickPoint(null, { x: 4, y: 4 }, null));
    expect(
      container.querySelector(".SgfReplay-variation").textContent
    ).toContain("Variante ab Zug 1 · Schwarz ist am Zug");
    // The end of the own line is not the end of the game: no result.
    expect(container.querySelector(".SgfReplay-result")).toBe(null);
    // An occupied point does nothing.
    act(() => view._onClickPoint(null, { x: 0, y: 0 }, "black"));
    act(() => container.querySelector(".SgfReplay-variation button").click());
    expect(container.querySelector(".SgfReplay-variation")).toBe(null);
    act(() => container.querySelector(".BoardNav-last").click());
    expect(container.querySelector(".SgfReplay-result").textContent).toBe(
      " · B+R"
    );
  });

  it("lays a line as a variation, switches to it and removes it", () => {
    let tree = parseSgf("(;SZ[9]PB[a]PW[b];B[aa];W[bb];B[cc])");
    let view;
    act(() => {
      ReactDOM.render(
        <SgfReplayView
          ref={(ref) => {
            view = ref;
          }}
          initialTree={tree}
        />,
        container
      );
    });
    act(() => container.querySelector(".BoardNav-next").click());
    act(() =>
      view._onLayLine(
        [
          { x: 4, y: 4 },
          { x: 5, y: 5 },
        ],
        "KataGo-Variante: E5"
      )
    );
    expect(container.querySelector(".SgfReplay-comment-text").textContent).toBe(
      "KataGo-Variante: E5"
    );
    act(() => container.querySelector(".BoardNav-prev").click());
    let labels = () =>
      Array.from(container.querySelectorAll(".SgfReplay-continuation")).map(
        (button) => button.textContent
      );
    expect(labels()).toEqual(["Partie B8", "KataGo E5"]);
    expect(
      container.querySelector(".SgfReplay-continuation-shown").textContent
    ).toBe("KataGo E5");
    act(() => container.querySelectorAll(".SgfReplay-continuation")[0].click());
    expect(container.querySelector(".SgfReplay-variation")).toBe(null);
    // One move back is the fork again, now following the game.
    act(() => container.querySelector(".BoardNav-prev").click());
    expect(
      container.querySelector(".SgfReplay-continuation-shown").textContent
    ).toBe("Partie B8");
    act(() => container.querySelectorAll(".SgfReplay-continuation")[1].click());
    expect(container.querySelector(".SgfReplay-variation")).not.toBe(null);
    act(() => container.querySelector(".SgfReplay-variation-remove").click());
    expect(container.querySelector(".SgfReplay-continuations")).toBe(null);
    expect(
      container.querySelector(".SgfReplay-captures").textContent
    ).toContain("Zug 1");
  });

  it("explains why a ko retake is not played", () => {
    let tree = parseSgf("(;SZ[9]AB[ba][ab][bc]AW[bb][ca][db][cc];B[cb])");
    let view;
    act(() => {
      ReactDOM.render(
        <SgfReplayView
          ref={(ref) => {
            view = ref;
          }}
          initialTree={tree}
        />,
        container
      );
    });
    act(() => container.querySelector(".BoardNav-last").click());
    act(() => view._onClickPoint(null, { x: 1, y: 1 }, null));
    expect(container.querySelector(".SgfReplay-move-notice").textContent).toBe(
      "Ko: sofort zurückschlagen ist verboten – erst woanders spielen."
    );
    expect(container.querySelector(".SgfReplay-variation")).toBe(null);
    act(() => container.querySelector(".BoardNav-prev").click());
    expect(container.querySelector(".SgfReplay-move-notice")).toBe(null);
  });

  it("continues where the viewer stopped and keeps bookmarks", () => {
    window.localStorage.clear();
    let sgf = "(;SZ[9]PB[a]PW[b];B[aa];W[bb];B[cc])";
    act(() => {
      ReactDOM.render(
        <SgfReplayView initialTree={parseSgf(sgf)} replayKey="kgs-1" />,
        container
      );
    });
    act(() => container.querySelector(".BoardNav-next").click());
    act(() => container.querySelector(".BoardNav-next").click());
    act(() => container.querySelector(".SgfReplay-bookmark-add").click());
    let input = container.querySelector(".SgfReplay-bookmark-input");
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      ).set.call(input, "Kampf unklar");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      container
        .querySelector(".SgfReplay-bookmark-form")
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true })
        );
    });
    expect(
      container.querySelector(".SgfReplay-bookmark-jump").textContent
    ).toBe("Zug 2: Kampf unklar");
    ReactDOM.unmountComponentAtNode(container);
    act(() => {
      ReactDOM.render(
        <SgfReplayView initialTree={parseSgf(sgf)} replayKey="kgs-1" />,
        container
      );
    });
    expect(container.querySelector(".SgfReplay-resumed").textContent).toContain(
      "Weiter bei Zug 2"
    );
    expect(
      container.querySelector(".SgfReplay-captures").textContent
    ).toContain("Zug 2");
    act(() => container.querySelector(".SgfReplay-resumed button").click());
    expect(
      container.querySelector(".SgfReplay-captures").textContent
    ).toContain("Zug 0");
    window.localStorage.clear();
  });

  it("drops OGS chat lines without readable text", () => {
    expect(getReadableComment("Kravets: [object Object]")).toBe(null);
    expect(
      getReadableComment("Fan: schöner Zug\nKravets: [object Object]\n")
    ).toBe("Fan: schöner Zug");
    expect(getReadableComment(undefined)).toBe(null);
  });
});
