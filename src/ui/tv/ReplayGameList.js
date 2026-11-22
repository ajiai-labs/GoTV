// @flow
import React, { PureComponent as Component } from "react";
import { ogsTvSource } from "../../model/OgsTvSource";
import type { TvEvent } from "../../model/tv";
import type { ReplayGame } from "../../model/OgsReplay";

type Props = {
  event: TvEvent,
  onOpenReplay: (string) => any,
  // Open from the start (Nachspielen tab) instead of behind a button.
  defaultOpen?: boolean,
  // Injected in tests; defaults to the shared OGS source.
  fetchGames?: (TvEvent) => Promise<Array<ReplayGame>>,
};

type State = {
  open: boolean,
  status: "idle" | "loading" | "ready" | "error",
  games: Array<ReplayGame>,
  error: ?string,
};

function formatStart(time: number): string {
  return time
    ? new Date(time).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
}

// The finished OGS games of a tournament as G1, G2, ... - players and start
// time only, no result, so nothing is spoiled before replaying.
export default class ReplayGameList extends Component<Props, State> {
  _mounted: boolean = false;
  state = {
    open: !!this.props.defaultOpen,
    status: "idle",
    games: [],
    error: null,
  };

  componentDidMount() {
    this._mounted = true;
    if (this.state.open) {
      this._load();
    }
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  _load = () => {
    let fetchGames =
      this.props.fetchGames || ((event) => ogsTvSource.fetchEventGames(event));
    this.setState({ status: "loading", error: null });
    fetchGames(this.props.event).then(
      (games) => {
        if (this._mounted) {
          this.setState({ status: "ready", games });
        }
      },
      (err) => {
        if (this._mounted) {
          this.setState({
            status: "error",
            error: err && err.message ? err.message : "OGS nicht erreichbar",
          });
        }
      }
    );
  };

  _onToggle = () => {
    let open = !this.state.open;
    this.setState({ open });
    if (open && this.state.status !== "ready") {
      this._load();
    }
  };

  _onPick = (e: Object) => {
    let url = e.currentTarget.getAttribute("data-sgf");
    if (url) {
      this.props.onOpenReplay(url);
    }
  };

  _renderBody() {
    let { status, games, error } = this.state;
    if (status === "loading" || status === "idle") {
      return (
        <div className="ReplayGameList-note">
          Partien werden bei OGS gesucht …
        </div>
      );
    }
    if (status === "error") {
      return (
        <div className="ReplayGameList-note ReplayGameList-error">
          Partien konnten nicht geladen werden ({error}).{" "}
          <button
            type="button"
            className="ReplayGameList-retry"
            onClick={this._load}>
            Erneut versuchen
          </button>
        </div>
      );
    }
    if (!games.length) {
      return (
        <div className="ReplayGameList-note">
          Noch keine beendete Partie gefunden.
        </div>
      );
    }
    return (
      <ol className="ReplayGameList-games">
        {games.map((game, index) => (
          <li key={game.id}>
            <button
              type="button"
              className="ReplayGameList-game"
              data-sgf={game.sgfUrl}
              onClick={this._onPick}>
              <span className="ReplayGameList-number">G{index + 1}</span>
              <span className="ReplayGameList-players">
                ● {game.black} – ○ {game.white}
              </span>
              <span className="ReplayGameList-time">
                {formatStart(game.started)}
              </span>
            </button>
          </li>
        ))}
      </ol>
    );
  }

  render() {
    let { open, status, games } = this.state;
    return (
      <div className="ReplayGameList">
        <button
          type="button"
          className="Button Button-secondary Button-small ReplayGameList-toggle"
          onClick={this._onToggle}>
          {open
            ? "Partien ausblenden"
            : status === "ready"
            ? games.length + " Partien nachspielen"
            : "Partien nachspielen"}
        </button>
        {open ? this._renderBody() : null}
      </div>
    );
  }
}
