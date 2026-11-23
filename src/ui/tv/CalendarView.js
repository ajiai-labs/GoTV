// @flow
import React, { PureComponent as Component } from "react";
import CalendarEventCard from "./CalendarEventCard";
import CalendarMonth from "./CalendarMonth";
import { Spinner } from "../common";
import {
  validateTvEvent,
  groupEventsByTime,
  groupEventsByRegion,
  fetchTvEvents,
} from "../../model/tv";
import type { TvEvent } from "../../model/tv";
import type { Node } from "react";

type Props = {
  // When provided, these are used instead of fetching events.json (dev
  // harness / tests), each validated the same way as a fetched entry.
  // The channel roster lives in the Kanäle tab (ChannelsView).
  events?: ?Array<TvEvent>,
  onOpenReplay?: (string) => any,
  renderEvent?: (TvEvent, options?: { openGames: boolean }) => Node,
  favoriteEventIds?: Array<string>,
};

type CalendarViewMode = "month" | "list";

type State = {
  status: "loading" | "ready" | "error",
  events: Array<TvEvent>,
  now: number,
  // "month": calendar sheet; "list": region groups and Archiv.
  view: CalendarViewMode,
};

const VIEW_KEY = "gotv.calendarView";

function loadView(): CalendarViewMode {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "list" ? "list" : "month";
  } catch (err) {
    return "month"; // storage disabled
  }
}

// The Kalender zone (today+upcoming+past, i.e. everything groupEventsByTime
// has not archived yet) and the Archiv zone are each grouped by region
// instead of by time bucket - see groupEventsByRegion.
const REGION_ORDER = ["de", "intl"];
const REGION_LABELS = {
  de: "Deutschland",
  intl: "International",
};

export default class CalendarView extends Component<Props, State> {
  _refreshTimer: ?IntervalID;
  _mounted: boolean = false;
  state = {
    status: "loading",
    events: [],
    now: Date.now(),
    view: loadView(),
  };

  _onSelectView = (e: Object) => {
    let view =
      e.currentTarget.getAttribute("data-view") === "list" ? "list" : "month";
    this.setState({ view });
    try {
      window.localStorage.setItem(VIEW_KEY, view);
    } catch (err) {
      // Not remembered without storage.
    }
  };

  _renderViewSwitch() {
    let { view } = this.state;
    return (
      <div className="CalendarView-switch">
        {[
          ["month", "Monat"],
          ["list", "Liste"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            data-view={id}
            onClick={this._onSelectView}
            className={
              "CalendarView-switch-item" +
              (view === id ? " CalendarView-switch-item-active" : "")
            }>
            {label}
          </button>
        ))}
      </div>
    );
  }

  componentDidMount() {
    this._mounted = true;
    if (this.props.events) {
      this._applyProvided();
    } else {
      this._loadEvents();
    }
    this._refreshTimer = setInterval(() => {
      this.setState({ now: Date.now() });
      if (this.props.events) {
        this._applyProvided();
      } else {
        this._loadEvents();
      }
    }, 60000);
  }

  componentWillUnmount() {
    this._mounted = false;
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
    }
  }

  _applyProvided = () => {
    let events: Array<TvEvent> = [];
    for (let raw of this.props.events || []) {
      let event = validateTvEvent(raw);
      if (event) {
        events.push(event);
      } else {
        console.log("[tv] Skipping invalid calendar entry:", raw);
      }
    }
    this.setState({ status: "ready", events });
  };

  _loadEvents = () => {
    fetchTvEvents()
      .then((events) => {
        if (this._mounted) {
          this.setState({ status: "ready", events });
        }
      })
      .catch((err) => {
        console.warn("[tv] Failed to load calendar events:", err);
        if (this._mounted && this.state.status !== "ready") {
          this.setState({ status: "error" });
        }
      });
  };

  _renderRegionGroup(
    regionKey: "de" | "intl",
    group: Array<TvEvent>,
    keyPrefix: string
  ) {
    if (!group.length) {
      return null;
    }
    return (
      <div className="CalendarView-group" key={keyPrefix + "-" + regionKey}>
        <div className="CalendarView-group-title">
          {REGION_LABELS[regionKey]}
        </div>
        {group.map((event) =>
          this.props.renderEvent ? (
            <React.Fragment key={event.id}>
              {this.props.renderEvent(event)}
            </React.Fragment>
          ) : (
            <CalendarEventCard
              key={event.id}
              event={event}
              onOpenReplay={this.props.onOpenReplay}
              now={this.state.now}
            />
          )
        )}
      </div>
    );
  }

  render() {
    let { status, events } = this.state;

    if (status === "loading") {
      return (
        <div className="CalendarView CalendarView-loading">
          <Spinner />
        </div>
      );
    }

    if (status === "error") {
      return (
        <div className="CalendarView">
          <div className="CalendarView-error">
            Kalender konnte nicht geladen werden (events.json nicht erreichbar).
            <div>
              <button
                className="Button"
                type="button"
                onClick={this._loadEvents}>
                Erneut versuchen
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (this.state.view === "month") {
      return (
        <div className="CalendarView">
          {this._renderViewSwitch()}
          <CalendarMonth
            events={events}
            now={this.state.now}
            onOpenReplay={this.props.onOpenReplay}
            renderEvent={this.props.renderEvent}
            favoriteEventIds={this.props.favoriteEventIds}
          />
        </div>
      );
    }

    let timeGroups = groupEventsByTime(events, new Date(this.state.now));
    let calendarEvents = [
      ...timeGroups.today,
      ...timeGroups.upcoming,
      ...timeGroups.past,
    ];
    let calendarByRegion = groupEventsByRegion(calendarEvents);
    let archiveByRegion = groupEventsByRegion(timeGroups.archive);

    return (
      <div className="CalendarView">
        {this._renderViewSwitch()}
        {REGION_ORDER.map((regionKey) =>
          this._renderRegionGroup(
            (regionKey: any),
            calendarByRegion[(regionKey: any)],
            "calendar"
          )
        )}
        {REGION_ORDER.map((regionKey) =>
          this._renderRegionGroup(
            (regionKey: any),
            archiveByRegion[(regionKey: any)],
            "archive"
          )
        )}
        {!events.length ? (
          <div className="CalendarView-empty">Keine Events im Kalender.</div>
        ) : null}
      </div>
    );
  }
}
