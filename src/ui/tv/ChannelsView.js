// @flow
import React, { PureComponent as Component } from "react";
import ChannelCard from "./ChannelCard";
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
};

const GROUPS = [
  { key: "player", title: "Spieler" },
  { key: "organization", title: "Verbände und Turniere" },
];

// The "Kanäle" tab: internet channels, kept apart from the tournament
// calendar. Players' channels first, then federations and tournaments; a
// channel inside its fixed air time moves to the top of its group.
export default class ChannelsView extends Component<Props> {
  _renderChannel(channel: TvChannel, now: Date) {
    let onAir = isChannelOnAir(channel, now);
    return (
      <React.Fragment key={channel.id}>
        {this.props.renderChannel ? (
          this.props.renderChannel(channel, onAir)
        ) : (
          <ChannelCard channel={channel} onAir={onAir} />
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
    let groups = groupChannels(channels, now);
    return (
      <div className="ChannelsView">
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
