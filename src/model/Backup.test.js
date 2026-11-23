import {
  collectBackup,
  describeBackup,
  getBackupFileName,
  parseBackup,
  restoreBackup,
} from "./Backup";

const NOW = new Date(2026, 10, 23, 19, 30);

function storageFrom(entries) {
  let map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    key: (index) => Array.from(map.keys())[index] || null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    map,
  };
}

const DESKTOP = {
  "gotv.favorites": JSON.stringify({
    channels: ["jupptube"],
    events: ["sg-1"],
  }),
  "gotv.replays": JSON.stringify({
    "url:a": {
      move: 80,
      title: "A",
      updatedAt: 200,
      bookmarks: [{ move: 57, note: "Kampf" }],
      variations: [
        { path: [0], x: 1, y: 1 },
        { path: [0, 1], x: 2, y: 2 },
      ],
    },
  }),
  "gotv.katago": "1",
  "gotv.notified": JSON.stringify(["channel:x:1"]),
  "other.app": "not ours",
};

describe("collectBackup", () => {
  it("takes every GoTV key except the reminder log", () => {
    let backup = collectBackup(storageFrom(DESKTOP), NOW);
    expect(backup.format).toBe("gotv-backup");
    expect(backup.version).toBe(1);
    expect(Object.keys(backup.data).sort()).toEqual([
      "gotv.favorites",
      "gotv.katago",
      "gotv.replays",
    ]);
    expect(getBackupFileName(NOW)).toBe("gotv-sicherung-2026-11-23.json");
  });

  it("describes what the file holds", () => {
    let backup = collectBackup(storageFrom(DESKTOP), NOW);
    expect(describeBackup(backup)).toEqual({
      favoriteChannels: 1,
      favoriteEvents: 1,
      games: 1,
      bookmarks: 1,
      variationMoves: 2,
      settings: 1,
    });
  });
});

describe("parseBackup", () => {
  it("reads its own files back", () => {
    let backup = collectBackup(storageFrom(DESKTOP), NOW);
    expect(parseBackup(JSON.stringify(backup))).toEqual({ ok: true, backup });
  });

  it("refuses foreign files with a readable message", () => {
    expect(parseBackup("not json").error).toContain("keine GoTV-Sicherung");
    expect(parseBackup('{"format":"x"}').error).toContain(
      "keine GoTV-Sicherung"
    );
    expect(
      parseBackup('{"format":"gotv-backup","version":99,"data":{}}').error
    ).toContain("neueren GoTV-Version");
  });

  it("leaves out foreign or broken entries", () => {
    let parsed = parseBackup(
      JSON.stringify({
        format: "gotv-backup",
        version: 1,
        data: {
          "gotv.katago": "1",
          "evil.key": "x",
          "gotv.cinemaSplit": 60,
          "gotv.notified": "[]",
        },
      })
    );
    expect(parsed.backup.data).toEqual({ "gotv.katago": "1" });
  });
});

describe("restoreBackup", () => {
  it("merges collections and never deletes what is already here", () => {
    let tablet = storageFrom({
      "gotv.favorites": JSON.stringify({ channels: ["egf"], events: [] }),
      "gotv.replays": JSON.stringify({
        "url:a": { move: 10, title: "A", updatedAt: 100, bookmarks: [] },
        "url:b": { move: 5, title: "B", updatedAt: 300, bookmarks: [] },
      }),
      "gotv.ogsLinks": JSON.stringify({ e1: 11 }),
      "gotv.katago": "0",
    });
    let backup = collectBackup(storageFrom(DESKTOP), NOW);
    backup.data["gotv.ogsLinks"] = JSON.stringify({ e2: 22 });
    let changed = restoreBackup(tablet, backup);
    expect(changed).toBe(4);
    expect(JSON.parse(tablet.getItem("gotv.favorites"))).toEqual({
      channels: ["egf", "jupptube"],
      events: ["sg-1"],
    });
    let replays = JSON.parse(tablet.getItem("gotv.replays"));
    // The desktop's newer state of game A wins, game B stays.
    expect(replays["url:a"].move).toBe(80);
    expect(replays["url:a"].variations).toHaveLength(2);
    expect(replays["url:b"].move).toBe(5);
    expect(JSON.parse(tablet.getItem("gotv.ogsLinks"))).toEqual({
      e1: 11,
      e2: 22,
    });
    expect(tablet.getItem("gotv.katago")).toBe("1");
  });

  it("keeps the newer game on this device and is repeatable", () => {
    let tablet = storageFrom({
      "gotv.replays": JSON.stringify({
        "url:a": { move: 120, title: "A", updatedAt: 999, bookmarks: [] },
      }),
    });
    let backup = collectBackup(storageFrom(DESKTOP), NOW);
    restoreBackup(tablet, backup);
    expect(JSON.parse(tablet.getItem("gotv.replays"))["url:a"].move).toBe(120);
    // A second restore of the same file changes nothing more.
    expect(restoreBackup(tablet, backup)).toBe(0);
  });

  it("keeps the local value when the file's collection is broken", () => {
    let tablet = storageFrom({ "gotv.favorites": '{"channels":["egf"]}' });
    let changed = restoreBackup(tablet, {
      format: "gotv-backup",
      version: 1,
      createdAt: "",
      data: { "gotv.favorites": "{broken" },
    });
    expect(changed).toBe(0);
    expect(tablet.getItem("gotv.favorites")).toBe('{"channels":["egf"]}');
  });
});
