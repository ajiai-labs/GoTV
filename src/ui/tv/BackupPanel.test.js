import React from "react";
import ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";
import BackupPanel, { formatSummary } from "./BackupPanel";

function chooseFile(input, text) {
  let file = new File([text], "gotv-sicherung.json", {
    type: "application/json",
  });
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  return act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    // FileReader finishes on a later tick.
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe("BackupPanel", () => {
  let container;

  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
    window.localStorage.clear();
    jest.useRealTimers();
  });

  it("summarises a backup in words", () => {
    expect(
      formatSummary({
        favoriteChannels: 1,
        favoriteEvents: 2,
        games: 3,
        bookmarks: 1,
        variationMoves: 12,
        settings: 4,
      })
    ).toBe(
      "1 Lieblingskanal, 2 Lieblingsturniere, 3 nachgespielte Partien" +
        " (1 Lesezeichen, 12 Variantenzüge), 4 Einstellungen"
    );
    expect(
      formatSummary({
        favoriteChannels: 0,
        favoriteEvents: 0,
        games: 0,
        bookmarks: 0,
        variationMoves: 0,
        settings: 0,
      })
    ).toBe("keine Daten");
  });

  it("saves this browser's data as a file", () => {
    window.localStorage.setItem(
      "gotv.favorites",
      JSON.stringify({ channels: ["jupptube"], events: [] })
    );
    let saved;
    global.URL.createObjectURL = jest.fn((blob) => {
      saved = blob;
      return "blob:backup";
    });
    global.URL.revokeObjectURL = jest.fn();
    let click = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    act(() => {
      ReactDOM.render(<BackupPanel />, container);
    });
    act(() => container.querySelector(".BackupPanel-save").click());
    expect(click).toHaveBeenCalled();
    expect(saved.type).toBe("application/json");
    expect(container.querySelector(".BackupPanel-message").textContent).toBe(
      "Sicherung gespeichert: 1 Lieblingskanal."
    );
    click.mockRestore();
  });

  it("shows what a file holds and merges it on request", async () => {
    window.localStorage.setItem(
      "gotv.favorites",
      JSON.stringify({ channels: ["egf"], events: [] })
    );
    let onRestored = jest.fn();
    act(() => {
      ReactDOM.render(<BackupPanel onRestored={onRestored} />, container);
    });
    await chooseFile(
      container.querySelector(".BackupPanel-input"),
      JSON.stringify({
        format: "gotv-backup",
        version: 1,
        createdAt: "2026-11-23T18:30:00.000Z",
        data: {
          "gotv.favorites": JSON.stringify({
            channels: ["jupptube"],
            events: [],
          }),
        },
      })
    );
    expect(
      container.querySelector(".BackupPanel-confirm").textContent
    ).toContain("1 Lieblingskanal");
    jest.useFakeTimers();
    act(() => container.querySelector(".BackupPanel-restore").click());
    expect(JSON.parse(window.localStorage.getItem("gotv.favorites"))).toEqual({
      channels: ["egf", "jupptube"],
      events: [],
    });
    expect(container.querySelector(".BackupPanel-message").textContent).toBe(
      "Sicherung übernommen. GoTV lädt neu …"
    );
    act(() => jest.runAllTimers());
    expect(onRestored).toHaveBeenCalled();
  });

  it("says why a file is refused", async () => {
    act(() => {
      ReactDOM.render(<BackupPanel />, container);
    });
    await chooseFile(container.querySelector(".BackupPanel-input"), "hallo");
    expect(container.querySelector(".BackupPanel-error").textContent).toContain(
      "keine GoTV-Sicherung"
    );
    expect(container.querySelector(".BackupPanel-confirm")).toBe(null);
  });
});
