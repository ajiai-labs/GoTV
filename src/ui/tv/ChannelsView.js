// @flow
import React, { PureComponent as Component } from "react";
import ChannelCard from "./ChannelCard";
import ChannelWeek from "./ChannelWeek";
import { Spinner } from "../common";
import { groupChannels, isChannelOnAir } from "../../model/tvChannels";
import type { TvChannel } from "../../model/tv";
import type { Node } from "react";

type Props = {
  status: "loading" | "ready" | "error",
  channels: Array<TvChannel>,
  now: number,
  onRetry?: () => any,
  // Lets TvScreen show a channel as a full broadcast (with board) while a
  // calendar event uses it; otherwise a plain ChannelCard.
  renderChannel?: (TvChannel, onAir: boolean) => Node,
  // Starred channel ids ("Mein GoTV"), in the order they were starred.
  favoriteIds?: Array<string>,
  onToggleFavorite?: (channelId: string) => any,
};

const GROUPS = [
  { key: "player", title: "Spieler" },
  { key: "organization", title: "Verbände und Turniere" },
];

// The "Kanäle" tab: internet channels, kept apart from the tournament
// calendar. Starred channels ("Favoriten") on top, then players' channels,
// then federations and tournaments; a channel inside its fixed air time
// moves to the top of its group.
export default class ChannelsView extends Component<Props> {
  _renderChannel(channel: TvChannel, now: Date) {
    let onAir = isChannelOnAir(channel, now);
    return (
      <React.Fragment key={channel.id}>
        {this.props.renderChannel ? (
          this.props.renderChannel(channel, onAir)
        ) : (
          <ChannelCard
            channel={channel}
            onAir={onAir}
            favorite={(this.props.favoriteIds || []).includes(channel.id)}
            onToggleFavorite={this.props.onToggleFavorite}
          />
        )}
      </React.Fragment>
    );
  }

  render() {
    let { status, channels, onRetry } = this.props;
    if (status === "loading") {
      return (
        <div className="ChannelsView ChannelsView-loading">
          <Spinner />
        </div>
      );
    }
    if (status === "error") {
      return (
        <div className="ChannelsView">
          <div className="ChannelsView-empty">
            Kanäle konnten nicht geladen werden (events.json nicht erreichbar).
            {onRetry ? (
              <div>
                <button className="Button" type="button" onClick={onRetry}>
                  Erneut versuchen
                </button>
              </div>
            ) : null}
          </div>
        </div>
      );
    }
    let now = new Date(this.props.now);
    let favoriteIds = this.props.favoriteIds || [];
    let groups = groupChannels(
      channels.filter((channel) => !favoriteIds.includes(channel.id)),
      now
    );
    let starred = channels
      .filter((channel) => favoriteIds.includes(channel.id))
      .sort(
        (a, b) =>
          Number(isChannelOnAir(b, now)) - Number(isChannelOnAir(a, now)) ||
          favoriteIds.indexOf(a.id) - favoriteIds.indexOf(b.id)
      );
    return (
      <div className="ChannelsView">
        <ChannelWeek
          channels={channels}
          now={this.props.now}
          favoriteIds={favoriteIds}
        />
        {starred.length ? (
          <div className="ChannelsView-group ChannelsView-favorites">
            <div className="ChannelsView-group-title">★ Favoriten</div>
            {starred.map((channel) => this._renderChannel(channel, now))}
          </div>
        ) : null}
        {GROUPS.map(({ key, title }) =>
          groups[key].length ? (
            <div className="ChannelsView-group" key={key}>
              <div className="ChannelsView-group-title">{title}</div>
              {groups[key].map((channel) => this._renderChannel(channel, now))}
            </div>
          ) : null
        )}
        {!channels.length ? (
          <div className="ChannelsView-empty">Keine Kanäle eingetragen.</div>
        ) : null}
      </div>
    );
  }
}
