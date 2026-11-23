// @flow
// "Meine Daten mitnehmen": everything GoTV keeps in this browser (stars,
// replays with bookmarks and variations, OGS links, board delays, settings)
// as one file, to carry from the desktop to a tablet and back. No account,
// no server: the viewer moves the file.
//
// Restoring merges and never deletes: lists are joined, a replayed game
// keeps its newer state, plain settings come from the file.
import { MAX_REMEMBERED_GAMES } from "./ReplayProgress";

export const BACKUP_FORMAT = "gotv-backup";
export const BACKUP_VERSION = 1;
const KEY_RE = /^gotv\.[A-Za-z]+$/;
// Reminders already shown here: carrying them over would silence the
// other device's own reminders.
const LOCAL_ONLY_KEYS = ["gotv.notified"];
const MAX_VALUE_LENGTH = 1024 * 1024;
const MAX_KEYS = 100;

export type BackupData = { [key: string]: string };

export type Backup = {
  format: string,
  version: number,
  createdAt: string,
  data: BackupData,
};

export type BackupSummary = {
  favoriteChannels: number,
  favoriteEvents: number,
  games: number,
  bookmarks: number,
  variationMoves: number,
  settings: number,
};

type Storage = {
  length: number,
  key: (index: number) => ?string,
  getItem: (key: string) => ?string,
  setItem: (key: string, value: string) => void,
};

export function collectBackup(storage: Storage, now: Date): Backup {
  let data = {};
  for (let i = 0; i < storage.length; i++) {
    let key = storage.key(i);
    if (key && KEY_RE.test(key) && !LOCAL_ONLY_KEYS.includes(key)) {
      let value = storage.getItem(key);
      if (typeof value === "string") {
        data[key] = value;
      }
    }
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: now.toISOString(),
    data,
  };
}

// The file name with the date: "gotv-sicherung-2026-11-23.json".
export function getBackupFileName(now: Date): string {
  let pad = (n) => String(n).padStart(2, "0");
  return (
    "gotv-sicherung-" +
    now.getFullYear() +
    "-" +
    pad(now.getMonth() + 1) +
    "-" +
    pad(now.getDate()) +
    ".json"
  );
}

// A checked backup, or an error message for the viewer.
export type ParsedBackup =
  | { ok: true, backup: Backup }
  | { ok: false, error: string };

export function parseBackup(text: string): ParsedBackup {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      error: "Die Datei ist keine GoTV-Sicherung (kein JSON).",
    };
  }
  if (!raw || typeof raw !== "object" || raw.format !== BACKUP_FORMAT) {
    return {
      ok: false,
      error: "Die Datei ist keine GoTV-Sicherung.",
    };
  }
  if (!Number.isInteger(raw.version) || raw.version > BACKUP_VERSION) {
    return {
      ok: false,
      error:
        "Die Sicherung stammt aus einer neueren GoTV-Version. Bitte GoTV aktualisieren.",
    };
  }
  let data = raw.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      ok: false,
      error: "Die Sicherung enthält keine Daten.",
    };
  }
  let keys = Object.keys(data);
  if (keys.length > MAX_KEYS) {
    return {
      ok: false,
      error: "Die Sicherung ist zu groß.",
    };
  }
  let checked = {};
  for (let key of keys) {
    let value = data[key];
    if (
      !KEY_RE.test(key) ||
      LOCAL_ONLY_KEYS.includes(key) ||
      typeof value !== "string" ||
      value.length > MAX_VALUE_LENGTH
    ) {
      continue; // foreign or broken entries are left out, not trusted
    }
    checked[key] = value;
  }
  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: raw.version,
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
      data: checked,
    },
  };
}

function parseJson(value: ?string): any {
  if (typeof value !== "string") {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
}

function isPlainObject(value: mixed): boolean %checks {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function joinLists(own: mixed, incoming: mixed): Array<mixed> {
  let result = Array.isArray(own) ? [...own] : [];
  for (let item of Array.isArray(incoming) ? incoming : []) {
    if (!result.includes(item)) {
      result.push(item);
    }
  }
  return result;
}

function mergeFavorites(own: any, incoming: any): any {
  return {
    channels: joinLists(own && own.channels, incoming && incoming.channels),
    events: joinLists(own && own.events, incoming && incoming.events),
  };
}

// Per game the newer state wins; only the most recent games are kept, as
// ReplayProgress does itself.
function mergeReplays(own: any, incoming: any): any {
  let merged = { ...(isPlainObject(own) ? own : {}) };
  for (let key of Object.keys(isPlainObject(incoming) ? incoming : {})) {
    let theirs = incoming[key];
    let mine = merged[key];
    let mineTime =
      mine && typeof mine.updatedAt === "number" ? mine.updatedAt : -1;
    let theirTime =
      theirs && typeof theirs.updatedAt === "number" ? theirs.updatedAt : 0;
    if (!mine || theirTime > mineTime) {
      merged[key] = theirs;
    }
  }
  let kept = {};
  Object.keys(merged)
    .sort((a, b) => (merged[b].updatedAt || 0) - (merged[a].updatedAt || 0))
    .slice(0, MAX_REMEMBERED_GAMES)
    .forEach((key) => {
      kept[key] = merged[key];
    });
  return kept;
}

const MERGERS: { [key: string]: (own: any, incoming: any) => any } = {
  "gotv.favorites": mergeFavorites,
  "gotv.replays": mergeReplays,
  // Per event / per channel: the file's value wins, others stay.
  "gotv.ogsLinks": (own, incoming) => ({
    ...(isPlainObject(own) ? own : {}),
    ...(isPlainObject(incoming) ? incoming : {}),
  }),
  "gotv.boardDelays": (own, incoming) => ({
    ...(isPlainObject(own) ? own : {}),
    ...(isPlainObject(incoming) ? incoming : {}),
  }),
};

// Writes the backup into storage, merging where the data is a collection.
// Returns how many keys changed.
export function restoreBackup(storage: Storage, backup: Backup): number {
  let changed = 0;
  for (let key of Object.keys(backup.data)) {
    let incoming = backup.data[key];
    let current = storage.getItem(key);
    let value = incoming;
    let merge = MERGERS[key];
    if (merge) {
      let theirs = parseJson(incoming);
      if (theirs === null) {
        continue; // broken collection in the file: keep what is here
      }
      let mine = parseJson(current);
      value = JSON.stringify(mine === null ? theirs : merge(mine, theirs));
    }
    if (value !== current) {
      storage.setItem(key, value);
      changed++;
    }
  }
  return changed;
}

// What the file holds, in words the viewer can check before restoring.
export function describeBackup(backup: Backup): BackupSummary {
  let favorites = parseJson(backup.data["gotv.favorites"]) || {};
  let replays = parseJson(backup.data["gotv.replays"]) || {};
  let games = isPlainObject(replays) ? Object.keys(replays) : [];
  let count = (field) =>
    games.reduce((sum, key) => {
      let list = replays[key] && replays[key][field];
      return sum + (Array.isArray(list) ? list.length : 0);
    }, 0);
  let known = ["gotv.favorites", "gotv.replays"];
  return {
    favoriteChannels: Array.isArray(favorites.channels)
      ? favorites.channels.length
      : 0,
    favoriteEvents: Array.isArray(favorites.events)
      ? favorites.events.length
      : 0,
    games: games.length,
    bookmarks: count("bookmarks"),
    variationMoves: count("variations"),
    settings: Object.keys(backup.data).filter((key) => !known.includes(key))
      .length,
  };
}
