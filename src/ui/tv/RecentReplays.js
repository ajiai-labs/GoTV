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
  // "Gerade zu Ende" under Live: only events that ended this recently,
  // their games listed right away, nothing rendered when there are none.
  justEnded?: boolean,
};

// How long a finished tournament is offered under Live.
export const JUST_ENDED_MS = 24 * 60 * 60 * 1000;

// Tournaments that ended less than maxAgeMs ago (or are running) whose
// games can be replayed (OGS games or a recorded SGF), newest first.
export function getRecentReplayEvents(
  events: Array<TvEvent>,
  now: number,
  maxAgeMs?: number = REPLAY_KEEP_MS
): Array<TvEvent> {
  return events
    .filter((event) => {
      let window = getLiveWindow(event);
      return (
        (hasOgsReplay(event) || !!event.sgf_url) &&
        window.start.getTime() <= now &&
        now - window.end.getTime() < maxAgeMs
      );
    })
    .sort(
      (a, b) =>
        getLiveWindow(b).start.getTime() - getLiveWindow(a).start.getTime()
    );
}

export default class RecentReplays extends Component<Props> {
  render() {
    let { events, now, onOpenReplay, justEnded } = this.props;
    let recent = justEnded
      ? getRecentReplayEvents(events, now, JUST_ENDED_MS).filter(
          (event) => getLiveWindow(event).end.getTime() < now
        )
      : getRecentReplayEvents(events, now);
    if (justEnded && !recent.length) {
      return null;
    }
    return (
      <div
        className={
          "RecentReplays" + (justEnded ? " RecentReplays-just-ended" : "")
        }>
        <div className="RecentReplays-title">
          {justEnded
            ? "Gerade zu Ende – Partien nachspielen"
            : "Turnierpartien der letzten " +
              Math.round(REPLAY_KEEP_DAYS / 30) +
              " Monate"}
        </div>
        {recent.length ? (
          recent.map((event) => (
            <div className="RecentReplays-event" key={event.id}>
              <div className="RecentReplays-event-name">{event.name}</div>
              <div className="RecentReplays-event-date">
                {formatEventDateRange(event)}
              </div>
              {hasOgsReplay(event) ? (
                <ReplayGameList
                  event={event}
                  onOpenReplay={onOpenReplay}
                  defaultOpen={justEnded}
                />
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
