// @flow
import React, { PureComponent as Component } from "react";
import CalendarView from "./tv/CalendarView";
import BroadcastCard from "./tv/BroadcastCard";
import CinemaExample from "./tv/CinemaExample";
import CalendarEventCard, {
  formatEventDateRange,
} from "./tv/CalendarEventCard";
import ChannelCard from "./tv/ChannelCard";
import ChannelsView from "./tv/ChannelsView";
import StreamEmbed from "./tv/StreamEmbed";
import SgfReplayView from "./tv/SgfReplayView";
import RecentReplays from "./tv/RecentReplays";
import { A, TabNav } from "./common";
import {
  getNextUpcomingEvent,
  fetchTvEvents,
  fetchTvChannels,
  validateTvEvent,
  validateTvChannel,
  getBroadcastForStream,
} from "../model/tv";
import { getChannelsOnAir } from "../model/tvChannels";
import { kgsTvSource } from "../model/TvSource";
import type { TvEvent, TvBroadcast, TvChannel } from "../model/tv";
import { applyOgsLinks, loadOgsLinks, saveOgsLinks } from "../model/OgsLinks";
import type { OgsLinks } from "../model/OgsLinks";
import type {
  GameChannel,
  Room,
  User,
  KgsClientState,
  Index,
  AppActions,
} from "../model";

type Props = {
  activeGames: Array<GameChannel>,
  gamesById: Index<GameChannel>,
  roomsById: Index<Room>,
  actions: AppActions,
  currentUser?: ?User,
  usersByName?: Index<User>,
  clientState?: KgsClientState,
  tvStreamUrl: ?string,
  tvReplayGameId: ?number,
  // Optional injected calendar (dev harness/tests) - raw events.json
  // entries, validated here; skips the fetch (same as CalendarView).
  events?: Array<Object>,
  // Same for the channel roster (events.json's "channels").
  channels?: Array<Object>,
};

type State = {
  activeTabId: string,
  replayUrl: ?string,
  tvEventsStatus: "loading" | "ready" | "error",
  tvEvents: Array<TvEvent>,
  tvChannelsStatus: "loading" | "ready" | "error",
  tvChannels: Array<TvChannel>,
  // OGS boards the viewer assigned to events by hand (this browser only).
  ogsLinks: OgsLinks,
  now: number,
};

export default class TvScreen extends Component<Props, State> {
  _refreshTimer: ?IntervalID;
  _replayRef: ?HTMLElement;
  _mounted: boolean = false;
  state = {
    activeTabId: this.props.tvReplayGameId ? "replay" : "live",
    replayUrl: null,
    tvEventsStatus: "loading",
    tvEvents: [],
    tvChannelsStatus: "loading",
    tvChannels: [],
    ogsLinks: loadOgsLinks(),
    now: Date.now(),
  };

  componentDidMount() {
    this._mounted = true;
    window.scrollTo(0, 0);
    this._loadEvents();
    this._refreshTimer = setInterval(() => {
      this.setState({ now: Date.now() });
      this._loadEvents();
    }, 60000);
  }

  componentWillUnmount() {
    this._mounted = false;
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.props.tvReplayGameId &&
      this.props.tvReplayGameId !== prevProps.tvReplayGameId
    ) {
      this.setState({ activeTabId: "replay" });
    }
  }

  _loadEvents = () => {
    this._loadChannels();
    if (this.props.events) {
      // Raw entries, validated like events.json (as in CalendarView).
      let tvEvents = [];
      for (let raw of this.props.events) {
        let event = validateTvEvent(raw);
        if (event) {
          tvEvents.push(event);
        }
      }
      this.setState({ tvEventsStatus: "ready", tvEvents });
      return;
    }
    fetchTvEvents()
      .then((tvEvents) => {
        if (this._mounted) {
          this.setState({ tvEventsStatus: "ready", tvEvents });
        }
      })
      .catch((err) => {
        console.warn("[tv] Failed to load live calendar events:", err);
        if (this._mounted && !this.state.tvEvents.length) {
          this.setState({ tvEventsStatus: "error" });
        }
      });
  };

  _loadChannels = () => {
    if (this.props.channels || this.props.events) {
      // Injected data (dev harness/tests): no network fetch.
      let tvChannels = [];
      for (let raw of this.props.channels || []) {
        let channel = validateTvChannel(raw);
        if (channel) {
          tvChannels.push(channel);
        }
      }
      this.setState({ tvChannelsStatus: "ready", tvChannels });
      return;
    }
    fetchTvChannels()
      .then((tvChannels) => {
        if (this._mounted) {
          this.setState({ tvChannelsStatus: "ready", tvChannels });
        }
      })
      .catch((err) => {
        console.warn("[tv] Failed to load channels:", err);
        if (this._mounted && !this.state.tvChannels.length) {
          this.setState({ tvChannelsStatus: "error" });
        }
      });
  };

  _onAssignOgsLink = (eventId: string, gameId: ?number) => {
    let ogsLinks = { ...this.state.ogsLinks };
    if (gameId) {
      ogsLinks[eventId] = gameId;
    } else {
      delete ogsLinks[eventId];
    }
    saveOgsLinks(ogsLinks);
    this.setState({ ogsLinks });
  };

  _renderBroadcast = (broadcast: TvBroadcast) => {
    let {
      roomsById,
      actions,
      currentUser,
      usersByName,
      clientState,
    } = this.props;
    return (
      <BroadcastCard
        key={broadcast.event.id}
        broadcast={broadcast}
        roomsById={roomsById}
        onJoinGame={actions.onJoinGame}
        onOpenReplay={this._onOpenReplay}
        currentUser={currentUser}
        usersByName={usersByName}
        actions={actions}
        now={this.state.now}
        onAssignOgsLink={this._onAssignOgsLink}
        hasManualOgsLink={!!this.state.ogsLinks[broadcast.event.id]}
        connectionKey={
          clientState ? clientState.status + "/" + clientState.network : ""
        }
      />
    );
  };

  // Channels inside a fixed air time, as a pointer to the Kanäle tab: they
  // are no tournament broadcast, so Live itself stays for those.
  _renderOnAirChannels(onAirChannels: Array<TvChannel>) {
    if (!onAirChannels.length) {
      return null;
    }
    return (
      <div className="TvScreen-on-air">
        <span className="TvScreen-on-air-text">
          Jetzt auf den Kanälen (geplant):{" "}
          <strong>{onAirChannels.map((c) => c.name).join(", ")}</strong>
        </span>
        <A button onClick={this._onShowChannelsTab}>
          Zu den Kanälen
        </A>
      </div>
    );
  }

  render() {
    let {
      activeGames,
      gamesById,
      roomsById,
      actions,
      tvStreamUrl,
      tvReplayGameId,
    } = this.props;
    let { activeTabId, replayUrl } = this.state;
    let tvEvents = applyOgsLinks(this.state.tvEvents, this.state.ogsLinks);

    let now = new Date(this.state.now);
    let broadcasts = kgsTvSource.getLiveBroadcasts(
      activeGames,
      tvEvents,
      roomsById,
      now
    );
    let hasLive = broadcasts.length > 0;
    let onAirChannels = getChannelsOnAir(this.state.tvChannels, now);
    let nextEvent = getNextUpcomingEvent(tvEvents, now);
    let replayGame = tvReplayGameId ? gamesById[tvReplayGameId] : null;
    let replayTree = replayGame ? replayGame.tree : null;
    let openedBroadcast = tvStreamUrl
      ? getBroadcastForStream(broadcasts, tvStreamUrl)
      : null;

    let tabs = [
      {
        id: "live",
        label: "Live",
        content: (
          <div className="TvScreen-live">
            {hasLive ? (
              <div className="TvScreen-live-content">
                {broadcasts.map(this._renderBroadcast)}
                {this._renderOnAirChannels(onAirChannels)}
                <RecentReplays
                  events={tvEvents}
                  now={this.state.now}
                  onOpenReplay={this._onOpenReplay}
                  justEnded
                />
              </div>
            ) : (
              <div className="TvScreen-live-empty">
                <div className="TvScreen-live-empty-title">
                  Gerade keine Übertragung.
                </div>
                {this._renderOnAirChannels(onAirChannels)}
                <RecentReplays
                  events={tvEvents}
                  now={this.state.now}
                  onOpenReplay={this._onOpenReplay}
                  justEnded
                />
                {nextEvent ? (
                  <div className="TvScreen-live-empty-next">
                    <div className="TvScreen-live-empty-next-text">
                      Nächstes Event: <strong>{nextEvent.name}</strong> (
                      {formatEventDateRange(nextEvent)})
                    </div>
                  </div>
                ) : null}
                <div className="TvScreen-live-empty-calendar">
                  <A button onClick={this._onShowCalendarTab}>
                    Zum Kalender
                  </A>
                </div>
                <CinemaExample />
              </div>
            )}
          </div>
        ),
      },
      {
        id: "calendar",
        label: "Kalender",
        content: (
          <CalendarView
            events={this.props.events ? tvEvents : undefined}
            onOpenReplay={this._onOpenReplay}
            renderEvent={(event, options) => {
              let broadcast = kgsTvSource.getLiveBroadcasts(
                activeGames,
                [event],
                roomsById,
                now
              )[0];
              return broadcast ? (
                this._renderBroadcast(broadcast)
              ) : (
                <CalendarEventCard
                  event={event}
                  onOpenReplay={this._onOpenReplay}
                  now={this.state.now}
                  openGames={!!options && options.openGames}
                />
              );
            }}
          />
        ),
      },
      {
        id: "channels",
        label: "Kanäle",
        content: (
          <ChannelsView
            status={this.state.tvChannelsStatus}
            channels={this.state.tvChannels}
            now={this.state.now}
            onRetry={this._loadChannels}
            renderChannel={(channel, onAir) => {
              // A calendar event running on this channel right now: show
              // it with its board instead of the bare channel.
              let broadcast = broadcasts.find(
                ({ event }) =>
                  event.stream_url === channel.url ||
                  (event.channel &&
                    event.channel.platform === channel.platform &&
                    event.channel.id === channel.channel_id)
              );
              return broadcast ? (
                this._renderBroadcast(broadcast)
              ) : (
                <ChannelCard channel={channel} onAir={onAir} />
              );
            }}
          />
        ),
      },
      {
        id: "replay",
        label: "Nachspielen",
        content: (
          <div className="TvScreen-replay">
            <div ref={this._setReplayRef}>
              <SgfReplayView
                key={
                  replayTree
                    ? "game-" + String(tvReplayGameId)
                    : replayUrl || "manual"
                }
                initialUrl={replayTree ? null : replayUrl}
                initialTree={replayTree}
              />
            </div>
            <RecentReplays
              events={tvEvents}
              now={this.state.now}
              onOpenReplay={this._onOpenReplay}
            />
          </div>
        ),
      },
    ];

    return (
      <div className="TvScreen">
        <div className="TvScreen-header">
          <div className="TvScreen-title">Go TV</div>
        </div>
        {tvStreamUrl ? (
          <div className="TvScreen-stream">
            <div className="TvScreen-stream-header">
              <div className="TvScreen-stream-title">Stream</div>
              <A
                button
                className="TvScreen-stream-close"
                onClick={actions.onCloseTvStream}>
                ×
              </A>
            </div>
            {openedBroadcast ? (
              this._renderBroadcast(openedBroadcast)
            ) : (
              <div>
                <StreamEmbed key={tvStreamUrl} url={tvStreamUrl} />
                <div className="TvGamePanel-notice">
                  Diesem Stream ist kein KGS-Brett zugeordnet.
                </div>
              </div>
            )}
          </div>
        ) : null}
        <TabNav
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={this._onSelectTab}
        />
      </div>
    );
  }

  _onSelectTab = (id: string) => {
    this.setState({ activeTabId: id });
  };

  _onShowCalendarTab = () => {
    this.setState({ activeTabId: "calendar" });
  };

  _onShowChannelsTab = () => {
    this.setState({ activeTabId: "channels" });
  };

  _setReplayRef = (ref: HTMLElement | null) => {
    this._replayRef = ref;
  };

  _onOpenReplay = (url: string) => {
    this.setState({ activeTabId: "replay", replayUrl: url }, () => {
      // The board sits above the game lists: bring it into view.
      let ref: any = this._replayRef;
      if (ref && typeof ref.scrollIntoView === "function") {
        ref.scrollIntoView({ block: "start" });
      }
    });
  };
}
