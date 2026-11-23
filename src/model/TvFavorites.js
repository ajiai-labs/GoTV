// @flow
// "Mein GoTV": channels and tournaments the viewer marked with a star.
// Stored only in this browser (localStorage), like the OGS links and the
// board delay - no account, no server.

export type TvFavorites = {
  channels: Array<string>,
  events: Array<string>,
};

export type FavoriteKind = "channels" | "events";

const FAVORITES_KEY = "gotv.favorites";
const REMINDERS_KEY = "gotv.reminders";
const NOTIFIED_KEY = "gotv.notified";
// Keys of reminders already shown; old ones fall out after this many.
const NOTIFIED_LIMIT = 50;

export const EMPTY_FAVORITES: TvFavorites = { channels: [], events: [] };

function readIds(value: mixed): Array<string> {
  let ids = [];
  if (Array.isArray(value)) {
    for (let id of value) {
      if (typeof id === "string" && id) {
        ids.push(id);
      }
    }
  }
  return ids;
}

export function parseFavorites(raw: ?string): TvFavorites {
  if (!raw) {
    return EMPTY_FAVORITES;
  }
  try {
    let data = JSON.parse(raw);
    if (!data || typeof data !== "object") {
      return EMPTY_FAVORITES;
    }
    return { channels: readIds(data.channels), events: readIds(data.events) };
  } catch (err) {
    return EMPTY_FAVORITES; // corrupt entry: start over
  }
}

export function loadFavorites(): TvFavorites {
  try {
    return parseFavorites(window.localStorage.getItem(FAVORITES_KEY));
  } catch (err) {
    return EMPTY_FAVORITES; // storage disabled
  }
}

export function saveFavorites(favorites: TvFavorites) {
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch (err) {
    // storage disabled: the star holds for this session only
  }
}

// Returns a new object; the newest star goes to the end of its list.
export function toggleFavorite(
  favorites: TvFavorites,
  kind: FavoriteKind,
  id: string
): TvFavorites {
  let ids = favorites[kind];
  let next = ids.includes(id)
    ? ids.filter((other) => other !== id)
    : [...ids, id];
  return kind === "channels"
    ? { ...favorites, channels: next }
    : { ...favorites, events: next };
}

export function isFavorite(
  favorites: TvFavorites,
  kind: FavoriteKind,
  id: string
): boolean {
  return favorites[kind].includes(id);
}

export function loadRemindersEnabled(): boolean {
  try {
    return window.localStorage.getItem(REMINDERS_KEY) === "1";
  } catch (err) {
    return false;
  }
}

export function saveRemindersEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(REMINDERS_KEY, enabled ? "1" : "0");
  } catch (err) {
    // storage disabled
  }
}

export function loadNotifiedKeys(): Array<string> {
  try {
    return readIds(
      JSON.parse(window.localStorage.getItem(NOTIFIED_KEY) || "[]")
    );
  } catch (err) {
    return [];
  }
}

export function saveNotifiedKeys(keys: Array<string>) {
  try {
    window.localStorage.setItem(
      NOTIFIED_KEY,
      JSON.stringify(keys.slice(-NOTIFIED_LIMIT))
    );
  } catch (err) {
    // storage disabled: a reminder may then repeat after a reload
  }
}
