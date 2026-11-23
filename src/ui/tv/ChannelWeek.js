// @flow
import React, { PureComponent as Component } from "react";
import {
  getGermanClock,
  getWeekPlan,
  isChannelOnAir,
} from "../../model/tvChannels";
import type { TvChannel } from "../../model/tv";

type Props = {
  channels: Array<TvChannel>,
  now: number,
  favoriteIds?: Array<string>,
};

// The channels' fixed air times as a week (German time), today marked.
// Shown only when at least one channel has a schedule.
export default class ChannelWeek extends Component<Props> {
  render() {
    let now = new Date(this.props.now);
    let week = getWeekPlan(this.props.channels);
    if (!week.some((day) => day.entries.length)) {
      return null;
    }
    let today = getGermanClock(now).weekday;
    let favoriteIds = this.props.favoriteIds || [];
    return (
      <div className="ChannelWeek">
        <div className="ChannelWeek-title">
          Wochenplan · feste Sendezeiten (deutsche Zeit, geplant)
        </div>
        <div className="ChannelWeek-days">
          {week.map((day) => (
            <div
              key={day.weekday}
              className={
                "ChannelWeek-day" +
                (day.weekday === today ? " ChannelWeek-day-today" : "")
              }>
              <div className="ChannelWeek-day-label">{day.label}</div>
              {day.entries.length ? (
                day.entries.map((entry) => (
                  <div
                    key={entry.channel.id + entry.time}
                    className={
                      "ChannelWeek-entry" +
                      (day.weekday === today &&
                      isChannelOnAir(entry.channel, now)
                        ? " ChannelWeek-entry-now"
                        : "")
                    }>
                    <span className="ChannelWeek-entry-time">{entry.time}</span>{" "}
                    {favoriteIds.includes(entry.channel.id) ? "★ " : ""}
                    {entry.channel.name}
                  </div>
                ))
              ) : (
                <div className="ChannelWeek-empty">–</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
}
