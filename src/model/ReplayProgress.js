// @flow
// "Nachspielen fortsetzen": where the viewer stopped in each replayed game,
// plus personal bookmarks ("Hier verstehe ich den Kampf nicht"). Kept in
// this browser only (localStorage), for the most recent games.

export type ReplayBookmark = { move: number, note: string };

export type ReplayProgress = {
  // Move number on the game's main line.
  move: number,
  title: string,
  // Set when the game can be reopened from its address.
  url?: string,
  updatedAt: number,
  bookmarks: Array<ReplayBookmark>,
};

const STORAGE_KEY = "gotv.replays";
export const MAX_REMEMBERED_GAMES = 30;
export const MAX_NOTE_LENGTH = 200;

type Store = { [key: string]: ReplayProgress };

// A stable key for SGF text without an address (file or paste).
export function getSgfTextKey(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return "sgf:" + (hash >>> 0).toString(36) + ":" + text.length;
}

function readBookmarks(value: mixed): Array<ReplayBookmark> {
  let bookmarks = [];
  if (Array.isArray(value)) {
    for (let raw of value) {
      if (
        raw &&
        typeof raw === "object" &&
        typeof raw.move === "number" &&
        typeof raw.note === "string"
      ) {
        bookmarks.push({ move: raw.move, note: raw.note });
      }
    }
  }
  return bookmarks;
}

function readStore(): Store {
  try {
    let data = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {};
    }
    let store = {};
    for (let key of Object.keys(data)) {
      let raw = data[key];
      if (raw && typeof raw === "object" && typeof raw.move === "number") {
        store[key] = {
          move: raw.move,
          title: typeof raw.title === "string" ? raw.title : "",
          updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : 0,
          bookmarks: readBookmarks(raw.bookmarks),
          ...(typeof raw.url === "string" ? { url: raw.url } : {}),
        };
      }
    }
    return store;
  } catch (err) {
    return {};
  }
}

// Only the most recent games are kept.
function writeStore(store: Store) {
  let keys = Object.keys(store)
    .sort((a, b) => store[b].updatedAt - store[a].updatedAt)
    .slice(0, MAX_REMEMBERED_GAMES);
  let kept = {};
  for (let key of keys) {
    kept[key] = store[key];
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
  } catch (err) {
    // storage disabled: nothing is remembered
  }
}

export function loadReplayProgress(key: string): ?ReplayProgress {
  return readStore()[key] || null;
}

export function saveReplayMove(
  key: string,
  move: number,
  title: string,
  url: ?string,
  now: number = Date.now()
) {
  let store = readStore();
  let old = store[key];
  store[key] = {
    ...(old || { bookmarks: [] }),
    move,
    title,
    updatedAt: now,
    ...(url ? { url } : {}),
  };
  writeStore(store);
}

export function addReplayBookmark(
  key: string,
  move: number,
  note: string,
  now: number = Date.now()
): Array<ReplayBookmark> {
  let store = readStore();
  let old = store[key] || { move, title: "", updatedAt: now, bookmarks: [] };
  let bookmarks = [
    ...old.bookmarks.filter((bookmark) => bookmark.move !== move),
    { move, note: note.trim().slice(0, MAX_NOTE_LENGTH) },
  ].sort((a, b) => a.move - b.move);
  store[key] = { ...old, bookmarks, updatedAt: now };
  writeStore(store);
  return bookmarks;
}

export function removeReplayBookmark(
  key: string,
  move: number
): Array<ReplayBookmark> {
  let store = readStore();
  let old = store[key];
  if (!old) {
    return [];
  }
  let bookmarks = old.bookmarks.filter((bookmark) => bookmark.move !== move);
  store[key] = { ...old, bookmarks };
  writeStore(store);
  return bookmarks;
}

// Games that can be reopened, most recent first.
export function getRecentReplays(
  limit: number
): Array<ReplayProgress & { key: string }> {
  let store = readStore();
  return Object.keys(store)
    .filter((key) => !!store[key].url)
    .map((key) => ({ ...store[key], key }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}
