// @flow
import React, { PureComponent as Component } from "react";
import StreamEmbed from "./StreamEmbed";
import FavoriteStar from "./FavoriteStar";
import StreamChat from "./StreamChat";
import {
  formatChannelSchedule,
  getChannelLiveUrl,
} from "../../model/tvChannels";
import { getChannelChat } from "../../model/StreamChat";
import type { TvChannel } from "../../model/tv";

type Props = {
  channel: TvChannel,
  // One of the channel's fixed air times is running right now.
  onAir?: boolean,
  // "Mein GoTV" star; without onToggleFavorite there is no star.
  favorite?: boolean,
  onToggleFavorite?: (channelId: string) => any,
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
    let { channel, onAir, favorite, onToggleFavorite } = this.props;
    let schedule = formatChannelSchedule(channel);
    let chat = getChannelChat(channel, window.location.hostname);
    return (
      <div className={"ChannelCard" + (onAir ? " ChannelCard-on-air" : "")}>
        <div className="ChannelCard-header">
          <div className="ChannelCard-name">
            {onToggleFavorite ? (
              <FavoriteStar
                active={!!favorite}
                name={channel.name}
                onToggle={() => onToggleFavorite(channel.id)}
              />
            ) : null}
            {channel.name}
          </div>
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
        <div className="ChannelCard-links">
          <a
            className="Button Button-small ChannelCard-open"
            href={getChannelLiveUrl(channel)}
            target="_blank"
            rel="noopener noreferrer">
            Auf {PLATFORM_LABEL[channel.platform]} öffnen (mit Chat)
          </a>
          {channel.platform === "youtube" ? (
            <span className="ChannelCard-links-hint">
              Chat, Like und Abo gibt es direkt auf YouTube.
            </span>
          ) : null}
        </div>
        {chat ? <StreamChat chat={chat} title={channel.name} /> : null}
      </div>
    );
  }
}
