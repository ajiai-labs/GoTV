// @flow
import React, { PureComponent as Component } from "react";
import { getMyGoTvItems } from "../../model/MyGoTv";
import type { MyGoTvItem } from "../../model/MyGoTv";
import type { TvChannel, TvEvent } from "../../model/tv";
import type { TvFavorites } from "../../model/TvFavorites";

type Props = {
  favorites: TvFavorites,
  channels: Array<TvChannel>,
  events: Array<TvEvent>,
  now: number,
  remindersEnabled: boolean,
  // null: the browser has no notifications at all.
  notificationPermission: ?string,
  onToggleReminders: () => any,
  onShowChannels: () => any,
  onShowCalendar: () => any,
};

function formatStart(start: Date, now: Date): string {
  let sameDay = start.toDateString() === now.toDateString();
  let time = start.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (sameDay) {
    return "heute " + time + " Uhr";
  }
  return (
    start.toLocaleDateString("de-DE", {
      weekday: "short",
      day: "numeric",
      month: "numeric",
    }) +
    " " +
    time +
    " Uhr"
  );
}

function describe(item: MyGoTvItem, now: Date): string {
  if (item.status === "now") {
    return item.planned ? "läuft gerade (geplant)" : "läuft gerade";
  }
  if (item.status === "next" && item.start) {
    let when = item.timed
      ? formatStart(item.start, now)
      : item.start.toLocaleDateString("de-DE", {
          weekday: "short",
          day: "numeric",
          month: "numeric",
        });
    return item.planned ? "nächste Sendung " + when + " (geplant)" : when;
  }
  return "keine feste Sendezeit";
}

// "Mein GoTV" at the top of Live: what the starred channels and tournaments
// do now and next. Nothing starred: a one-line hint where the stars are.
export default class MyGoTv extends Component<Props> {
  render() {
    let { favorites, channels, events, onShowChannels } = this.props;
    let now = new Date(this.props.now);
    let items = getMyGoTvItems(favorites, channels, events, now);
    if (!items.length) {
      return (
        <div className="MyGoTv MyGoTv-empty">
          <span className="MyGoTv-title">Mein GoTV</span> Markiere Kanäle und
          Turniere mit ☆ - sie erscheinen dann hier mit ihrem nächsten Termin.{" "}
          <button
            type="button"
            className="Button Button-small Button-secondary"
            onClick={onShowChannels}>
            Zu den Kanälen
          </button>
        </div>
      );
    }
    return (
      <div className="MyGoTv">
        <div className="MyGoTv-header">
          <span className="MyGoTv-title">Mein GoTV</span>
          {this._renderReminderSwitch()}
        </div>
        {items.map((item) => (
          <button
            type="button"
            key={item.kind + ":" + item.id}
            className={
              "MyGoTv-item" + (item.status === "now" ? " MyGoTv-item-now" : "")
            }
            onClick={
              item.kind === "channel"
                ? this.props.onShowChannels
                : this.props.onShowCalendar
            }>
            <span className="MyGoTv-item-star">★</span>
            <span className="MyGoTv-item-name">{item.name}</span>
            <span className="MyGoTv-item-kind">
              {item.kind === "channel" ? "Kanal" : "Turnier"}
            </span>
            <span className="MyGoTv-item-when">{describe(item, now)}</span>
          </button>
        ))}
      </div>
    );
  }

  _renderReminderSwitch() {
    let { remindersEnabled, notificationPermission } = this.props;
    if (!notificationPermission) {
      return null; // no Notification API (e.g. some tablets)
    }
    if (notificationPermission === "denied") {
      return (
        <span className="MyGoTv-reminder-note">
          Erinnerungen sind im Browser blockiert
        </span>
      );
    }
    return (
      <label className="MyGoTv-reminder">
        <input
          type="checkbox"
          checked={remindersEnabled && notificationPermission === "granted"}
          onChange={this.props.onToggleReminders}
        />{" "}
        10 Min. vorher erinnern (solange GoTV offen ist)
      </label>
    );
  }
}
