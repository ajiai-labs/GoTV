// @flow
// The "Kanäle" tab: internet channels of players and of federations or
// tournaments, kept apart from the tournament calendar. A channel may carry
// fixed weekly air times ("schedule"); they are given in German time
// (Europe/Berlin), because the roster is maintained in Germany and the
// streamers announce them that way.
import type { TvChannel } from "./tv";

export type ChannelKind = "player" | "organization";

export type ChannelSlot = {
  // ISO weekday: 1 = Monday ... 7 = Sunday.
  weekday: number,
  // "HH:MM", German time.
  time: string,
  duration_minutes: number,
};

export const CHANNEL_TIME_ZONE = "Europe/Berlin";
export const DEFAULT_SLOT_MINUTES = 120;
const MINUTES_PER_DAY = 24 * 60;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const WEEKDAY_PLURAL = [
  "",
  "montags",
  "dienstags",
  "mittwochs",
  "donnerstags",
  "freitags",
  "samstags",
  "sonntags",
];

const SHORT_WEEKDAYS = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function validateChannelKind(value: mixed): ?ChannelKind {
  return value === "player" || value === "organization" ? value : null;
}

function validateSlot(value: mixed): ?ChannelSlot {
  if (!value || typeof value !== "object") {
    return null;
  }
  let { weekday, time, duration_minutes: duration } = (value: Object);
  if (
    typeof weekday !== "number" ||
    !Number.isInteger(weekday) ||
    weekday < 1 ||
    weekday > 7
  ) {
    return null;
  }
  if (typeof time !== "string" || !TIME_RE.test(time)) {
    return null;
  }
  if (duration === undefined || duration === null) {
    duration = DEFAULT_SLOT_MINUTES;
  }
  if (
    typeof duration !== "number" ||
    !Number.isInteger(duration) ||
    duration <= 0 ||
    duration > MINUTES_PER_DAY
  ) {
    return null;
  }
  return { weekday, time, duration_minutes: duration };
}

// null: the field is malformed (the whole channel is skipped, like any
// other invalid field); an empty array: no fixed air times.
export function validateChannelSchedule(value: mixed): ?Array<ChannelSlot> {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    return null;
  }
  let slots = [];
  for (let raw of value) {
    let slot = validateSlot(raw);
    if (!slot) {
      return null;
    }
    slots.push(slot);
  }
  return slots;
}

export function getChannelKind(channel: TvChannel): ChannelKind {
  return channel.kind === "player" ? "player" : "organization";
}

function toMinutes(time: string): number {
  let [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Weekday and minute of the day in German time, whatever the viewer's zone.
export function getGermanClock(now: Date): { weekday: number, minute: number } {
  let parts = {};
  for (let part of new Intl.DateTimeFormat("en-US", {
    timeZone: CHANNEL_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)) {
    parts[part.type] = part.value;
  }
  return {
    weekday: SHORT_WEEKDAYS[parts.weekday] || 1,
    minute: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
  };
}

// True while one of the channel's fixed air times runs. A slot that runs
// past midnight continues into the next weekday.
export function isChannelOnAir(channel: TvChannel, now: Date): boolean {
  let schedule = channel.schedule || [];
  if (!schedule.length) {
    return false;
  }
  let clock = getGermanClock(now);
  return schedule.some((slot) => {
    let start = toMinutes(slot.time);
    let end = start + slot.duration_minutes;
    if (slot.weekday === clock.weekday) {
      return clock.minute >= start && clock.minute < end;
    }
    let nextDay = (slot.weekday % 7) + 1;
    return (
      nextDay === clock.weekday &&
      end > MINUTES_PER_DAY &&
      clock.minute < end - MINUTES_PER_DAY
    );
  });
}

// "sonntags 10:30 Uhr" (or several, joined by " · ").
export function formatChannelSchedule(channel: TvChannel): ?string {
  let schedule = channel.schedule || [];
  if (!schedule.length) {
    return null;
  }
  return schedule
    .slice()
    .sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time))
    .map((slot) => WEEKDAY_PLURAL[slot.weekday] + " " + slot.time + " Uhr")
    .join(" · ");
}

// Players first, then federations and tournaments; inside each group the
// channels on air right now come first, the rest keep the file's order.
export function groupChannels(
  channels: Array<TvChannel>,
  now: Date
): { player: Array<TvChannel>, organization: Array<TvChannel> } {
  let groups = { player: [], organization: [] };
  for (let channel of channels) {
    groups[getChannelKind(channel)].push(channel);
  }
  let onAirFirst = (list: Array<TvChannel>) =>
    list
      .map((channel, index) => ({
        channel,
        index,
        onAir: isChannelOnAir(channel, now),
      }))
      .sort((a, b) => Number(b.onAir) - Number(a.onAir) || a.index - b.index)
      .map((entry) => entry.channel);
  return {
    player: onAirFirst(groups.player),
    organization: onAirFirst(groups.organization),
  };
}

export function getChannelsOnAir(
  channels: Array<TvChannel>,
  now: Date
): Array<TvChannel> {
  return channels.filter((channel) => isChannelOnAir(channel, now));
}

// Offset of German time from UTC at the given instant, in minutes.
function getGermanOffsetMinutes(at: number): number {
  let parts = {};
  for (let part of new Intl.DateTimeFormat("en-US", {
    timeZone: CHANNEL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(at))) {
    parts[part.type] = part.value;
  }
  let asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute)
  );
  return Math.round((asUtc - Math.floor(at / 60000) * 60000) / 60000);
}

// The instant of a wall-clock time in German time (year/month 0-based/day
// may overflow, as with Date.UTC).
function germanWallTime(
  year: number,
  month: number,
  day: number,
  minute: number
): number {
  let guess = Date.UTC(year, month, day, 0, minute);
  let offset = getGermanOffsetMinutes(guess);
  let at = guess - offset * 60000;
  // Across a DST switch the offset at the result can differ: once more.
  let corrected = getGermanOffsetMinutes(at);
  return corrected === offset ? at : guess - corrected * 60000;
}

function getGermanDate(
  now: Date
): { year: number, month: number, day: number } {
  let parts = {};
  for (let part of new Intl.DateTimeFormat("en-US", {
    timeZone: CHANNEL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)) {
    parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month) - 1,
    day: Number(parts.day),
  };
}

// The air time running now, else the next one within a week; null for a
// channel without fixed air times.
export function getNextAirTime(
  channel: TvChannel,
  now: Date
): ?{ start: Date, end: Date } {
  let schedule = channel.schedule || [];
  if (!schedule.length) {
    return null;
  }
  let today = getGermanDate(now);
  let best = null;
  // From yesterday (a slot running past midnight) to a week ahead.
  for (let offset = -1; offset <= 7; offset++) {
    let date = new Date(Date.UTC(today.year, today.month, today.day + offset));
    let weekday = date.getUTCDay() || 7;
    for (let slot of schedule) {
      if (slot.weekday !== weekday) {
        continue;
      }
      let start = germanWallTime(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        toMinutes(slot.time)
      );
      let end = start + slot.duration_minutes * 60000;
      if (end > now.getTime() && (!best || start < best.start)) {
        best = { start, end };
      }
    }
  }
  return best ? { start: new Date(best.start), end: new Date(best.end) } : null;
}
