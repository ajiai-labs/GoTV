// @flow
import React, { PureComponent as Component } from "react";
import StreamEmbed from "./StreamEmbed";
import { formatChannelSchedule } from "../../model/tvChannels";
import type { TvChannel } from "../../model/tv";

type Props = {
  channel: TvChannel,
  // One of the channel's fixed air times is running right now.
  onAir?: boolean,
};

const PLATFORM_LABEL = {
  youtube: "YouTube",
  twitch: "Twitch",
};

// A standing entry in the "Kanäle" tab: always shown, independent of any
// event date (unlike CalendarEventCard). Reuses StreamEmbed's two-click
// embed (see 415b1d7) - a channel always has a channel_id, so embedding is
// always attempted.
export default class ChannelCard extends Component<Props> {
  render() {
    let { channel, onAir } = this.props;
    let schedule = formatChannelSchedule(channel);
    return (
      <div className={"ChannelCard" + (onAir ? " ChannelCard-on-air" : "")}>
        <div className="ChannelCard-header">
          <div className="ChannelCard-name">{channel.name}</div>
          <div
            className={
              "ChannelCard-badge ChannelCard-badge-" + channel.platform
            }>
            {PLATFORM_LABEL[channel.platform]}
          </div>
        </div>
        {schedule ? (
          <div className="ChannelCard-schedule">
            {onAir ? (
              <span className="ChannelCard-live">läuft gerade (geplant)</span>
            ) : null}
            Feste Sendezeit: {schedule} (deutsche Zeit)
          </div>
        ) : null}
        {channel.notes ? (
          <div className="ChannelCard-notes">{channel.notes}</div>
        ) : null}
        <StreamEmbed channel={channel} />
      </div>
    );
  }
}
