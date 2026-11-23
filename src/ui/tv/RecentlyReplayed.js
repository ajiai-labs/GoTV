// @flow
import React, { PureComponent as Component } from "react";
import { getRecentReplays } from "../../model/ReplayProgress";

type Props = {
  onOpenReplay: (url: string) => any,
  // Changes whenever a game was opened, so the list re-reads storage.
  refreshKey?: mixed,
};

const MAX_SHOWN = 5;

// "Zuletzt nachgespielt": reopen a game where it was left (this browser).
export default class RecentlyReplayed extends Component<Props> {
  render() {
    let recent = getRecentReplays(MAX_SHOWN);
    if (!recent.length) {
      return null;
    }
    return (
      <div className="RecentlyReplayed">
        <div className="RecentlyReplayed-title">Zuletzt nachgespielt</div>
        {recent.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className="RecentlyReplayed-item"
            onClick={() => entry.url && this.props.onOpenReplay(entry.url)}>
            <span className="RecentlyReplayed-name">{entry.title}</span>
            <span className="RecentlyReplayed-move">
              weiter bei Zug {entry.move}
              {entry.bookmarks.length
                ? " · " + entry.bookmarks.length + " Lesezeichen"
                : ""}
            </span>
          </button>
        ))}
      </div>
    );
  }
}
