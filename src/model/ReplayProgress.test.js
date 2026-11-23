import {
  MAX_REMEMBERED_GAMES,
  addReplayBookmark,
  getRecentReplays,
  getSgfTextKey,
  loadReplayProgress,
  removeReplayBookmark,
  saveReplayVariations,
  saveReplayMove,
} from "./ReplayProgress";

describe("ReplayProgress", () => {
  beforeEach(() => window.localStorage.clear());

  it("remembers the move per game", () => {
    expect(loadReplayProgress("url:a")).toBe(null);
    saveReplayMove("url:a", 57, "A vs. B", "https://example.org/a.sgf", 1);
    expect(loadReplayProgress("url:a")).toEqual({
      move: 57,
      title: "A vs. B",
      url: "https://example.org/a.sgf",
      updatedAt: 1,
      bookmarks: [],
    });
  });

  it("keeps bookmarks sorted, one per move, and removes them", () => {
    addReplayBookmark("g", 80, "Ko-Kampf", 1);
    addReplayBookmark("g", 57, "  Hier verstehe ich den Kampf nicht ", 2);
    expect(addReplayBookmark("g", 80, "Ko-Kampf, Teil 2", 3)).toEqual([
      { move: 57, note: "Hier verstehe ich den Kampf nicht" },
      { move: 80, note: "Ko-Kampf, Teil 2" },
    ]);
    saveReplayMove("g", 90, "Partie", null, 4);
    expect(loadReplayProgress("g").bookmarks).toHaveLength(2);
    expect(removeReplayBookmark("g", 57)).toEqual([
      { move: 80, note: "Ko-Kampf, Teil 2" },
    ]);
  });

  it("lists reopenable games, newest first, and forgets the oldest", () => {
    for (let i = 0; i < MAX_REMEMBERED_GAMES + 2; i++) {
      saveReplayMove("g" + i, i, "Partie " + i, "https://x/" + i, i);
    }
    saveReplayMove("pasted", 3, "Eingefügt", null, 999);
    let recent = getRecentReplays(3);
    expect(recent.map((entry) => entry.key)).toEqual(["g31", "g30", "g29"]);
    expect(loadReplayProgress("g0")).toBe(null);
  });

  it("keeps variations with the game and drops broken entries", () => {
    saveReplayMove("g", 30, "Partie", "https://x/g", 1);
    saveReplayVariations("g", [
      { path: [0], x: 4, y: 4, comment: "KataGo-Variante: E5" },
      { path: [0, 1], x: 5, y: 5 },
    ]);
    expect(loadReplayProgress("g").variations).toEqual([
      { path: [0], x: 4, y: 4, comment: "KataGo-Variante: E5" },
      { path: [0, 1], x: 5, y: 5 },
    ]);
    expect(loadReplayProgress("g").move).toBe(30);
    let raw = JSON.parse(window.localStorage.getItem("gotv.replays"));
    raw.g.variations.push({ path: ["x"], x: 1, y: 1 }, { x: 2 });
    window.localStorage.setItem("gotv.replays", JSON.stringify(raw));
    expect(loadReplayProgress("g").variations).toHaveLength(2);
  });

  it("names pasted SGF text by a stable key", () => {
    expect(getSgfTextKey("(;SZ[9])")).toBe(getSgfTextKey("(;SZ[9])"));
    expect(getSgfTextKey("(;SZ[9])")).not.toBe(getSgfTextKey("(;SZ[13])"));
  });

  it("ignores broken stored data", () => {
    window.localStorage.setItem("gotv.replays", "{oops");
    expect(loadReplayProgress("g")).toBe(null);
  });
});
