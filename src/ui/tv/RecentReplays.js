// @flow
import React, { PureComponent as Component } from "react";
import ReplayGameList from "./ReplayGameList";
import { formatEventDateRange } from "./CalendarEventCard";
import {
  getLiveWindow,
  hasOgsReplay,
  REPLAY_KEEP_DAYS,
  REPLAY_KEEP_MS,
} from "../../model/tv";
import type { TvEvent } from "../../model/tv";

type Props = {
  events: Array<TvEvent>,
  now: number,
  onOpenReplay: (string) => any,
};

// Tournaments of the last REPLAY_KEEP_DAYS days whose games can be replayed
// (OGS games or a recorded SGF), newest first.
export function getRecentReplayEvents(
  events: Array<TvEvent>,
  now: number
): Array<TvEvent> {
  return events
    .filter((event) => {
      let window = getLiveWindow(event);
      return (
        (hasOgsReplay(event) || !!event.sgf_url) &&
        window.start.getTime() <= now &&
        now - window.end.getTime() < REPLAY_KEEP_MS
      );
    })
    .sort(
      (a, b) =>
        getLiveWindow(b).start.getTime() - getLiveWindow(a).start.getTime()
    );
}

export default class RecentReplays extends Component<Props> {
  render() {
    let { events, now, onOpenReplay } = this.props;
    let recent = getRecentReplayEvents(events, now);
    return (
      <div className="RecentReplays">
        <div className="RecentReplays-title">
          Turnierpartien der letzten {Math.round(REPLAY_KEEP_DAYS / 30)} Monate
        </div>
        {recent.length ? (
          recent.map((event) => (
            <div className="RecentReplays-event" key={event.id}>
              <div className="RecentReplays-event-name">{event.name}</div>
              <div className="RecentReplays-event-date">
                {formatEventDateRange(event)}
              </div>
              {hasOgsReplay(event) ? (
                <ReplayGameList event={event} onOpenReplay={onOpenReplay} />
              ) : (
                <button
                  type="button"
                  className="Button Button-secondary Button-small"
                  onClick={() => {
                    if (event.sgf_url) {
                      onOpenReplay(event.sgf_url);
                    }
                  }}>
                  SGF nachspielen
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="RecentReplays-empty">
            Keine Turnierpartien aus den letzten Monaten.
          </div>
        )}
      </div>
    );
  }
}
