// @flow
import React, { PureComponent as Component } from "react";
import {
  formatPoint,
  getPvPoints,
  compareGameMove,
  getGameNextMove,
  getKataGoEngine,
  DEFAULT_VISITS,
} from "../../model/KataGoEngine";
import type {
  GameMistake,
  KataGoAnalysis,
  KataGoMove,
  PositionEval,
} from "../../model/KataGoEngine";
import { findMistakes, VERIFY_CANDIDATES } from "../../model/KataGoEngine";

import { getBranchPoint, getMainLine } from "../../model/ReplayVariation";
import GameGraph from "./GameGraph";
import type { GameTree } from "../../model";

type Props = {
  tree: GameTree,
  nodeId: number,
  // Top moves for the board labels (null: none to show).
  onMoves: (nodeId: number, moves: ?Array<KataGoMove>) => any,
  // Shows a position of the game (curve and mistake list).
  onJump?: (nodeId: number) => any,
  // "Variante legen": KataGo's expected line into the game tree.
  onLayLine?: (points: Array<{ x: number, y: number }>, comment: string) => any,
};

// How many moves of the expected line the list spells out.
const PV_SHOWN = 6;

type State = {
  enabled: boolean,
  status: "idle" | "running" | "ready" | "error",
  analysis: ?KataGoAnalysis,
  analysedNode: ?number,
  error: ?string,
  visits: number,
  modelName: ?string,
  // "Ganze Partie auswerten"
  game: {
    status: "idle" | "running" | "ready" | "error",
    // running: "curve" (network) or "check" (search on the candidates)
    step: "curve" | "check",
    done: number,
    total: number,
    evals: Array<PositionEval>,
    mistakes: Array<GameMistake>,
    error: ?string,
  },
};

const NO_GAME = {
  status: "idle",
  step: "curve",
  done: 0,
  total: 0,
  evals: [],
  mistakes: [],
  error: null,
};

const ENABLED_KEY = "gotv.katago";
// The mistake list: losses from this size, at most this many.
const MIN_MISTAKE_POINTS = 2;
const SHOWN_MISTAKES = 5;
const VISIT_OPTIONS = [50, 100, 400, 1000];
// Wait for the viewer to stop clicking through moves before analysing.
const DEBOUNCE_MS = 250;

export { formatPoint };

function formatPercent(value: number): string {
  return Math.round(value * 100) + " %";
}

function formatPoints(value: number): string {
  return Math.abs(value).toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatLead(lead: number): string {
  if (Math.abs(lead) < 0.05) {
    return "ausgeglichen";
  }
  return (
    (lead > 0 ? "Schwarz" : "Weiß") +
    " führt mit " +
    formatPoints(lead) +
    " Punkten"
  );
}

function loadEnabled(): boolean {
  try {
    return window.localStorage.getItem(ENABLED_KEY) === "1";
  } catch (err) {
    return false;
  }
}

function getBoardSize(tree: GameTree, nodeId: number): number {
  let state = tree.computedState[nodeId];
  return state ? state.board.length : 19;
}

// KataGo on request while replaying: off by default, so no evaluation
// shows unless the viewer asks ("ohne ständig eingeblendete Bewertung").
export default class KataGoPanel extends Component<Props, State> {
  _timer: ?TimeoutID = null;
  _mounted: boolean = false;
  _fileUrl: ?string = null;

  state = {
    enabled: loadEnabled(),
    status: "idle",
    analysis: null,
    analysedNode: null,
    error: null,
    visits: DEFAULT_VISITS,
    modelName: null,
    game: NO_GAME,
  };

  _stopGame: boolean = false;

  componentDidMount() {
    this._mounted = true;
    if (this.state.enabled) {
      this._schedule();
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.state.enabled &&
      (prevProps.nodeId !== this.props.nodeId ||
        prevProps.tree.rootNode !== this.props.tree.rootNode)
    ) {
      this._schedule();
    }
  }

  componentWillUnmount() {
    this._mounted = false;
    this._stopGame = true;
    if (this._timer) {
      clearTimeout(this._timer);
    }
    getKataGoEngine().cancel();
  }

  _schedule() {
    if (this._timer) {
      clearTimeout(this._timer);
    }
    this.props.onMoves(this.props.nodeId, null);
    this._timer = setTimeout(this._analyze, DEBOUNCE_MS);
  }

  _analyze = () => {
    let { tree, nodeId } = this.props;
    this.setState({ status: "running", error: null });
    getKataGoEngine()
      .analyze(tree, nodeId, this.state.visits)
      .then((analysis) => {
        if (!this._mounted || nodeId !== this.props.nodeId) {
          return;
        }
        this.setState({
          status: "ready",
          analysis,
          analysedNode: nodeId,
        });
        this.props.onMoves(nodeId, analysis.moves);
      })
      .catch((err) => {
        if (!this._mounted || err.message === "canceled") {
          return;
        }
        this.setState({ status: "error", error: err.message });
      });
  };

  _onToggle = () => {
    let enabled = !this.state.enabled;
    try {
      window.localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
    } catch (err) {
      // not remembered
    }
    this.setState({ enabled, analysis: null, status: "idle" });
    if (enabled) {
      this._schedule();
    } else {
      getKataGoEngine().cancel();
      this.props.onMoves(this.props.nodeId, null);
    }
  };

  _onChangeVisits = (e: Object) => {
    this.setState({ visits: Number(e.target.value) || DEFAULT_VISITS }, () => {
      if (this.state.enabled) {
        this._schedule();
      }
    });
  };

  // A stronger KataGo net from disk (e.g. the b18 net of KaTrain). It stays
  // in this browser tab; nothing is uploaded anywhere.
  _onChooseModel = (e: Object) => {
    let file = e.target.files && e.target.files[0];
    if (!file) {
      return;
    }
    if (this._fileUrl) {
      URL.revokeObjectURL(this._fileUrl);
    }
    let fileUrl = URL.createObjectURL(file);
    this._fileUrl = fileUrl;
    getKataGoEngine().setModelUrl(fileUrl);
    this.setState({ modelName: file.name }, () => {
      if (this.state.enabled) {
        this._schedule();
      }
    });
  };

  _onLayLine = (e: Object) => {
    let { analysis } = this.state;
    let { tree, nodeId, onLayLine } = this.props;
    let move =
      analysis && analysis.moves[Number(e.currentTarget.dataset.index)];
    if (!move || !onLayLine) {
      return;
    }
    let size = getBoardSize(tree, nodeId);
    onLayLine(
      getPvPoints(move, size),
      "KataGo-Variante: " +
        formatPoint(move.x, move.y, size) +
        " · Schwarz " +
        formatPercent(move.winRate) +
        " · " +
        formatLead(move.scoreLead)
    );
  };

  render() {
    let { enabled } = this.state;
    return (
      <div className="KataGoPanel">
        <div className="KataGoPanel-header">
          <label className="KataGoPanel-switch">
            <input
              type="checkbox"
              checked={enabled}
              onChange={this._onToggle}
            />{" "}
            <strong>KataGo-Analyse</strong>
          </label>
          {enabled ? (
            <span className="KataGoPanel-options">
              <label>
                Visits{" "}
                <select
                  value={this.state.visits}
                  onChange={this._onChangeVisits}>
                  {VISIT_OPTIONS.map((visits) => (
                    <option key={visits} value={visits}>
                      {visits}
                    </option>
                  ))}
                </select>
              </label>
              <span className="KataGoPanel-model">
                Netz: {this.state.modelName || "klein (b6, mitgeliefert)"}{" "}
                <label className="Button Button-small Button-secondary KataGoPanel-model-button">
                  Stärkeres Netz laden …
                  <input
                    type="file"
                    accept=".gz,.bin"
                    className="KataGoPanel-model-input"
                    onChange={this._onChooseModel}
                  />
                </label>
              </span>
            </span>
          ) : (
            <span className="KataGoPanel-hint">
              rechnet im Browser, nichts wird verschickt; zeigt Bewertung und
              bessere Züge erst nach dem Einschalten
            </span>
          )}
        </div>
        {enabled ? this._renderBody() : null}
      </div>
    );
  }

  // 1. every position from the network alone (seconds), 2. the most
  // suspicious moves again with a real search, because the network alone
  // swings in ko fights - only losses that hold up are listed.
  _onEvaluateGame = async () => {
    let { tree } = this.props;
    let engine = getKataGoEngine();
    let stop = () => this._stopGame || !this._mounted;
    let progress = (step) => (done, total) => {
      if (this._mounted) {
        this.setState((state) => ({
          game: { ...state.game, step, done, total },
        }));
      }
    };
    this._stopGame = false;
    this.setState({ game: { ...NO_GAME, status: "running", step: "curve" } });
    try {
      let evals = await engine.evaluateGame(tree, progress("curve"), stop);
      if (!evals) {
        this.setState({ game: NO_GAME });
        return;
      }
      this.setState((state) => ({
        game: { ...state.game, evals, step: "check", done: 0 },
      }));
      let candidates = findMistakes(evals, tree, VERIFY_CANDIDATES);
      let verified = await engine.verifyMistakes(
        tree,
        candidates,
        progress("check"),
        stop
      );
      if (!verified || !this._mounted) {
        if (this._mounted) {
          this.setState({ game: NO_GAME });
        }
        return;
      }
      let mistakes = verified
        .filter((mistake) => mistake.pointsLost >= MIN_MISTAKE_POINTS)
        .slice(0, SHOWN_MISTAKES); // keeps the win-chance order
      this.setState({
        game: { ...NO_GAME, status: "ready", evals, mistakes },
      });
    } catch (err) {
      if (this._mounted) {
        this.setState({
          game: { ...NO_GAME, status: "error", error: err.message },
        });
      }
    }
  };

  _onStopGame = () => {
    this._stopGame = true;
  };

  _renderGame() {
    let { game } = this.state;
    let { tree, nodeId, onJump } = this.props;
    if (game.status === "running") {
      return (
        <div className="KataGoPanel-game">
          {game.step === "curve"
            ? "Partie wird ausgewertet … Zug " +
              game.done +
              " von " +
              (game.total || "?")
            : "Auffällige Züge werden mit KataGo-Suche geprüft … " +
              game.done +
              " von " +
              (game.total || "?")}{" "}
          <button
            type="button"
            className="SgfReplay-link"
            onClick={this._onStopGame}>
            Abbrechen
          </button>
        </div>
      );
    }
    if (game.status === "ready" && onJump) {
      let mainLine = getMainLine(tree);
      let branch = getBranchPoint(tree, nodeId);
      let currentMove = mainLine.indexOf(
        typeof branch === "number" ? branch : nodeId
      );
      return (
        <GameGraph
          tree={tree}
          evals={game.evals}
          mistakes={game.mistakes}
          currentMove={Math.max(0, currentMove)}
          onJump={onJump}
        />
      );
    }
    return (
      <div className="KataGoPanel-game">
        <button
          type="button"
          className="Button Button-small Button-secondary KataGoPanel-game-start"
          onClick={this._onEvaluateGame}>
          Ganze Partie auswerten
        </button>{" "}
        <span className="KataGoPanel-hint">
          {game.status === "error"
            ? "Auswertung fehlgeschlagen: " + (game.error || "")
            : "Gewinnkurve und die größten Fehler; zeigt den Partieverlauf"}
        </span>
      </div>
    );
  }

  _renderBody() {
    return (
      <div>
        {this._renderGame()}
        {this._renderPosition()}
      </div>
    );
  }

  _renderPosition() {
    let { status, analysis, analysedNode, error } = this.state;
    let { tree, nodeId } = this.props;
    if (status === "error") {
      return (
        <div className="KataGoPanel-error">
          KataGo konnte nicht rechnen: {error || "unbekannter Fehler"}
        </div>
      );
    }
    if (!analysis || analysedNode !== nodeId) {
      return (
        <div className="KataGoPanel-running">
          KataGo rechnet … (beim ersten Mal wird das Netz geladen)
        </div>
      );
    }
    let size = getBoardSize(tree, nodeId);
    let gameMove = getGameNextMove(tree, nodeId);
    let comparison = compareGameMove(analysis, gameMove);
    let played = comparison ? comparison.played : null;
    return (
      <div className="KataGoPanel-body">
        <div className="KataGoPanel-summary">
          Gewinnchance Schwarz {formatPercent(analysis.winRate)} ·{" "}
          {formatLead(analysis.scoreLead)}
          <span className="KataGoPanel-meta">
            {" "}
            ({analysis.visits} Visits
            {analysis.backend ? ", " + analysis.backend.toUpperCase() : ""})
          </span>
        </div>
        <ol className="KataGoPanel-moves">
          {analysis.moves.map((move) => (
            <li key={move.x + "-" + move.y}>
              <strong>{formatPoint(move.x, move.y, size)}</strong> · Schwarz{" "}
              {formatPercent(move.winRate)} · {move.scoreLead >= 0 ? "+" : "−"}
              {formatPoints(move.scoreLead)} · {move.visits} Visits
              {move.pv.length > 1 ? (
                <span className="KataGoPanel-pv">
                  {" "}
                  · erwartet {move.pv.slice(0, PV_SHOWN).join(" ")}
                  {move.pv.length > PV_SHOWN ? " …" : ""}
                </span>
              ) : null}
              {this.props.onLayLine ? (
                <button
                  type="button"
                  className="KataGoPanel-lay"
                  data-index={analysis.moves.indexOf(move)}
                  onClick={this._onLayLine}>
                  Variante legen
                </button>
              ) : null}
            </li>
          ))}
        </ol>
        {gameMove ? (
          <div className="KataGoPanel-compare">
            {!comparison
              ? "Die Partie spielte " +
                formatPoint(gameMove.x, gameMove.y, size) +
                " – auch KataGos erste Wahl."
              : played
              ? "Die Partie spielte " +
                formatPoint(gameMove.x, gameMove.y, size) +
                ": laut KataGo " +
                formatPoints(played.pointsLost) +
                " Punkte schlechter als " +
                formatPoint(comparison.best.x, comparison.best.y, size) +
                "."
              : "Die Partie spielte " +
                formatPoint(gameMove.x, gameMove.y, size) +
                " – nicht unter KataGos " +
                analysis.moves.length +
                " besten Zügen; KataGo bevorzugt " +
                formatPoint(comparison.best.x, comparison.best.y, size) +
                "."}
          </div>
        ) : null}
      </div>
    );
  }
}
