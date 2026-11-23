// @flow
import React, { PureComponent as Component } from "react";
import BoardContainer from "../board/BoardContainer";
import BoardNav from "../board/BoardNav";
import { Button } from "../common";
import {
  parseSgf,
  SgfParseError,
  getSgfPlayerNames,
  getSgfRootProp,
} from "../../model/sgf";
import { computeGameNodeStates, getGameLine } from "../../model/game/tree";
import {
  getBranchPoint,
  getColorToPlay,
  getContinuations,
  getMainLine,
  getNodeMove,
  playVariationLine,
  playVariationMove,
  removeVariation,
  returnToGame,
  showContinuation,
} from "../../model/ReplayVariation";
import { formatPoint } from "../../model/KataGoEngine";
import {
  addReplayBookmark,
  getSgfTextKey,
  loadReplayProgress,
  removeReplayBookmark,
  saveReplayMove,
} from "../../model/ReplayProgress";
import type { ReplayBookmark } from "../../model/ReplayProgress";
import KataGoPanel from "./KataGoPanel";
import type { KataGoMove } from "../../model/KataGoEngine";
import type { GameTree, Point, PlayerColor } from "../../model";

// OGS writes chat lines it cannot serialise as "name: [object Object]" into
// its SGF export; those lines carry no text and are left out.
const BROKEN_CHAT_LINE_RE = /\[object Object\]\s*$/;

export function getReadableComment(text: mixed): ?string {
  if (typeof text !== "string") {
    return null;
  }
  let lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim() && !BROKEN_CHAT_LINE_RE.test(line));
  return lines.length ? lines.join("\n") : null;
}

type Props = {
  initialUrl?: ?string,
  initialTree?: ?GameTree,
  // Remembers progress and bookmarks of an initialTree game (e.g. a KGS
  // game id); an URL or pasted text names itself.
  replayKey?: ?string,
  compact?: boolean,
};

type State = {
  status: "empty" | "ready" | "error",
  error: ?string,
  tree: ?GameTree,
  currentNode: number,
  input: string,
  // "Nachspielen fortsetzen" (not in compact views).
  progressKey: ?string,
  progressUrl: ?string,
  resumedFrom: ?number,
  bookmarks: Array<ReplayBookmark>,
  // Text of a bookmark being written; null while the field is closed.
  bookmarkDraft: ?string,
  // KataGo's top moves for the shown position, as board labels 1-5.
  kataGoMoves: ?{ nodeId: number, moves: Array<KataGoMove> },
};

// The position with KataGo's candidates as labels 1-5 (a copy - the game
// tree itself keeps its own markup).
function withKataGoLabels(
  tree: GameTree,
  nodeId: number,
  moves: Array<KataGoMove>
): GameTree {
  let state = tree.computedState[nodeId];
  if (!state) {
    return tree;
  }
  let labels = { ...state.markup.labels };
  moves.forEach((move, index) => {
    if (!state.board[move.y] || state.board[move.y][move.x]) {
      return;
    }
    labels[move.y] = { ...(labels[move.y] || {}), [move.x]: String(index + 1) };
  });
  return {
    ...tree,
    computedState: {
      ...tree.computedState,
      [nodeId]: { ...state, markup: { ...state.markup, labels } },
    },
  };
}

const COLOR_LABEL = { black: "Schwarz", white: "Weiß" };

const CORS_ERROR_MESSAGE =
  "SGF konnte nicht geladen werden. Wahrscheinlich blockiert der Server " +
  "direkte Anfragen (CORS). Lade die Datei direkt hoch oder füge den SGF-Text ein.";

export default class SgfReplayView extends Component<Props, State> {
  state = {
    status: "empty",
    error: null,
    tree: null,
    currentNode: 0,
    input: "",
    progressKey: null,
    progressUrl: null,
    resumedFrom: null,
    bookmarks: [],
    bookmarkDraft: null,
    kataGoMoves: null,
  };

  _fileInput: ?HTMLInputElement;

  componentDidMount() {
    if (this.props.initialTree) {
      this._applyTree(this.props.initialTree);
    } else if (this.props.initialUrl) {
      this._loadUrl(this.props.initialUrl);
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.props.initialTree &&
      this.props.initialTree !== prevProps.initialTree
    ) {
      this._applyTree(this.props.initialTree);
    } else if (
      this.props.initialUrl &&
      this.props.initialUrl !== prevProps.initialUrl
    ) {
      this._loadUrl(this.props.initialUrl);
    }
  }

  // A tree that's already in memory (e.g. a game just watched to the end) -
  // no fetch, no SGF (re-)parsing. Always starts the replay at the root,
  // regardless of where the live view's currentNode happened to be.
  _applyTree = (tree: GameTree) => {
    let key = this.props.replayKey ? "game:" + this.props.replayKey : null;
    this._showTree(tree, key, null);
  };

  // Opens a parsed game, at the move where the viewer stopped last time.
  _showTree(tree: GameTree, key: ?string, url: ?string) {
    let progress = key && !this.props.compact ? loadReplayProgress(key) : null;
    let mainLine = getMainLine(tree);
    let resumeMove =
      progress && progress.move > 0 && progress.move < mainLine.length
        ? progress.move
        : null;
    let shown = tree;
    let currentNode = tree.rootNode;
    if (resumeMove) {
      currentNode = mainLine[resumeMove];
      shown = {
        ...tree,
        computedState: computeGameNodeStates(tree, currentNode),
        currentLine: mainLine,
        currentNode,
      };
    }
    this.setState({
      status: "ready",
      error: null,
      tree: shown,
      currentNode,
      progressKey: this.props.compact ? null : key,
      progressUrl: url,
      resumedFrom: resumeMove,
      bookmarks: progress ? progress.bookmarks : [],
      bookmarkDraft: null,
    });
  }

  _loadUrl = (url: string) => {
    this.setState({ status: "empty", error: null });
    fetch(url)
      .then((res) => {
        if (!res.ok) {
          throw new Error("HTTP " + res.status);
        }
        return res.text();
      })
      .then((text) => this._loadSgf(text, url))
      .catch((err) => {
        console.warn("[tv] Failed to load SGF from " + url + ":", err);
        this.setState({
          status: "error",
          error: this.props.compact
            ? "Finalpartie konnte nicht geladen werden. Schließe das Beispiel und öffne es erneut."
            : CORS_ERROR_MESSAGE,
        });
      });
  };

  _loadSgf = (text: string, url?: ?string) => {
    try {
      let tree = parseSgf(text);
      let key = url ? "url:" + url : getSgfTextKey(text);
      this._showTree(tree, key, url);
    } catch (err) {
      if (err instanceof SgfParseError) {
        this.setState({
          status: "error",
          error: "SGF konnte nicht gelesen werden: " + err.message,
          tree: null,
        });
      } else {
        throw err;
      }
    }
  };

  render() {
    let { status, error, tree, currentNode, input } = this.state;
    return (
      <div
        className={
          "SgfReplay" + (this.props.compact ? " SgfReplay-compact" : "")
        }>
        {this.props.compact ? null : (
          <div className="SgfReplay-sources">
            <div className="SgfReplay-source">
              <div className="SgfReplay-source-label">SGF-Datei:</div>
              <input
                ref={this._setFileInput}
                type="file"
                accept=".sgf,.SGF,text/plain,application/x-go-sgf"
                onChange={this._onFileChange}
              />
            </div>
            <div className="SgfReplay-source">
              <div className="SgfReplay-source-label">SGF einfügen:</div>
              <textarea
                className="SgfReplay-input"
                value={input}
                placeholder="(;GM[1]SZ[19]...)"
                onChange={this._onInputChange}
              />
              <Button
                small
                onClick={this._onLoadInput}
                disabled={!input.trim()}>
                Laden
              </Button>
            </div>
          </div>
        )}
        {this.props.compact && status === "empty" ? (
          <div className="TvGamePanel-notice">Finalpartie wird geladen …</div>
        ) : null}
        {status === "error" ? (
          <div className="SgfReplay-error">{error || "Unbekannter Fehler"}</div>
        ) : null}
        {status === "ready" && tree
          ? this._renderReplay(tree, currentNode)
          : null}
      </div>
    );
  }

  _renderReplay(tree: GameTree, currentNode: number) {
    let line = tree.currentLine;
    let moveNum = line.indexOf(currentNode);
    let computed = tree.computedState[currentNode];
    let playerNames = getSgfPlayerNames(tree);
    let result = getSgfRootProp(tree, "RE");
    let rulesProp = tree.nodes[tree.rootNode].props.find(
      (p) => p.name === "RULES"
    );
    // The RULES prop carries board size beyond the SgfProp type
    let boardSize =
      rulesProp && typeof (rulesProp: any).size === "number"
        ? (rulesProp: any).size
        : "?";
    let mainLine = getMainLine(tree);
    let branchPoint = getBranchPoint(tree, currentNode);
    let currentNodeProps = tree.nodes[currentNode].props;
    let commentProp = currentNodeProps.find((p) => p.name === "COMMENT");
    let comment = commentProp ? getReadableComment(commentProp.text) : null;
    // BoardContainer only reads game.tree - the rest of GameChannel is unused
    let kataGoMoves = this.state.kataGoMoves;
    let game: any = {
      type: "review",
      tree:
        kataGoMoves && kataGoMoves.nodeId === currentNode
          ? withKataGoLabels(tree, currentNode, kataGoMoves.moves)
          : tree,
    };

    return (
      <div className="SgfReplay-game">
        <div className="SgfReplay-info">
          {playerNames.black && playerNames.white ? (
            <span className="SgfReplay-players">
              {playerNames.black} (B) vs. {playerNames.white} (W)
            </span>
          ) : null}
          {/* The result only at the game's last move - replaying must not
              be spoiled, and an own variation's end is no game end. */}
          {result && currentNode === mainLine[mainLine.length - 1] ? (
            <span className="SgfReplay-result"> · {result}</span>
          ) : null}
          <span className="SgfReplay-size">
            {" "}
            · {boardSize}×{boardSize}
          </span>
        </div>
        <div className="SgfReplay-board-container">
          <BoardContainer
            game={game}
            embedded={this.props.compact}
            onClickPoint={this._onClickPoint}
          />
        </div>
        <div className="SgfReplay-nav">
          <BoardNav
            nodeId={currentNode}
            currentLine={line}
            onChangeCurrentNode={this._onChangeCurrentNode}
          />
        </div>
        <div className="SgfReplay-captures">
          {computed ? (
            <span>
              Zug {moveNum} · Gefangene: Schwarz {computed.blackCaptures}, Weiß{" "}
              {computed.whiteCaptures}
            </span>
          ) : null}
        </div>
        {/* Right under the board buttons, where it is seen. */}
        {this.props.compact ? null : (
          <KataGoPanel
            tree={tree}
            nodeId={currentNode}
            onMoves={this._onKataGoMoves}
            onLayLine={this._onLayLine}
          />
        )}
        {typeof branchPoint === "number"
          ? this._renderVariationBar(
              mainLine.indexOf(branchPoint),
              getColorToPlay(tree, currentNode)
            )
          : null}
        {this._renderContinuations(tree, currentNode)}
        {this.state.progressKey ? this._renderProgress(moveNum) : null}
        {comment ? (
          <div className="SgfReplay-comment">
            <div className="SgfReplay-comment-title">Kommentar:</div>
            <div className="SgfReplay-comment-text">{comment}</div>
          </div>
        ) : null}
      </div>
    );
  }

  _renderVariationBar(fromMove: number, toPlay: PlayerColor) {
    return (
      <div className="SgfReplay-variation">
        <span>
          Variante ab Zug {fromMove} · {COLOR_LABEL[toPlay]} ist am Zug
        </span>
        <Button small onClick={this._onReturnToGame}>
          Zurück zur Partie
        </Button>
        <button
          type="button"
          className="SgfReplay-link SgfReplay-variation-remove"
          onClick={this._onRemoveVariation}>
          Variante löschen
        </button>
      </div>
    );
  }

  // Where the game and own variations part: switch between them.
  _renderContinuations(tree: GameTree, nodeId: number) {
    let continuations = getContinuations(tree, nodeId);
    if (!continuations.length) {
      return null;
    }
    let size = tree.computedState[nodeId]
      ? tree.computedState[nodeId].board.length
      : 19;
    let shownNext = tree.currentLine[tree.currentLine.indexOf(nodeId) + 1];
    return (
      <div className="SgfReplay-continuations">
        <span className="SgfReplay-continuations-title">Weiter mit:</span>
        {continuations.map((continuation) => {
          let move = getNodeMove(tree, continuation.nodeId);
          let point = move ? formatPoint(move.x, move.y, size) : "Passen";
          let label = continuation.isGame
            ? "Partie " + point
            : (continuation.comment &&
              continuation.comment.indexOf("KataGo") === 0
                ? "KataGo "
                : "Variante ") + point;
          return (
            <button
              type="button"
              key={continuation.nodeId}
              className={
                "SgfReplay-continuation" +
                (continuation.nodeId === shownNext
                  ? " SgfReplay-continuation-shown"
                  : "")
              }
              aria-pressed={continuation.nodeId === shownNext}
              data-node={continuation.nodeId}
              onClick={this._onShowContinuation}>
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  _onShowContinuation = (e: Object) => {
    let { tree } = this.state;
    if (!tree) {
      return;
    }
    let next = showContinuation(tree, Number(e.currentTarget.dataset.node));
    this.setState({ tree: next, currentNode: next.currentNode });
    this._saveProgress(next, next.currentNode);
  };

  // KataGo's expected line as a variation, shown from its first move: the
  // normal move buttons then step through it.
  _onLayLine = (points: Array<{ x: number, y: number }>, comment: string) => {
    let { tree, currentNode } = this.state;
    if (!tree) {
      return;
    }
    let laid = playVariationLine(tree, currentNode, points, comment);
    if (laid) {
      this.setState({ tree: laid.tree, currentNode: laid.firstNodeId });
      this._saveProgress(laid.tree, laid.firstNodeId);
    }
  };

  _onRemoveVariation = () => {
    let { tree, currentNode } = this.state;
    if (!tree) {
      return;
    }
    let next = removeVariation(tree, currentNode);
    if (!next.computedState[next.currentNode]) {
      next.computedState = computeGameNodeStates(next, next.currentNode);
    }
    this.setState({
      tree: next,
      currentNode: next.currentNode,
      kataGoMoves: null,
    });
  };

  _renderProgress(moveNum: number) {
    let { resumedFrom, bookmarks, bookmarkDraft } = this.state;
    return (
      <div className="SgfReplay-progress">
        {resumedFrom ? (
          <div className="SgfReplay-resumed">
            Weiter bei Zug {resumedFrom} – hier hast du zuletzt aufgehört.{" "}
            <button
              type="button"
              className="SgfReplay-link"
              onClick={this._onRestart}>
              Von vorn
            </button>
          </div>
        ) : null}
        {bookmarks.length ? (
          <div className="SgfReplay-bookmarks">
            {bookmarks.map((bookmark) => (
              <span key={bookmark.move} className="SgfReplay-bookmark">
                <button
                  type="button"
                  className="SgfReplay-bookmark-jump"
                  data-move={bookmark.move}
                  onClick={this._onJumpToBookmark}>
                  Zug {bookmark.move}
                  {bookmark.note ? ": " + bookmark.note : ""}
                </button>
                <button
                  type="button"
                  className="SgfReplay-bookmark-remove"
                  aria-label={
                    "Lesezeichen bei Zug " + bookmark.move + " löschen"
                  }
                  data-move={bookmark.move}
                  onClick={this._onRemoveBookmark}>
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        {bookmarkDraft === null ? (
          <button
            type="button"
            className="Button Button-small Button-secondary SgfReplay-bookmark-add"
            disabled={moveNum < 1}
            onClick={this._onOpenBookmark}>
            Lesezeichen bei Zug {moveNum}
          </button>
        ) : (
          <form
            className="SgfReplay-bookmark-form"
            onSubmit={this._onSaveBookmark}>
            <input
              type="text"
              className="SgfReplay-bookmark-input"
              value={bookmarkDraft}
              maxLength={200}
              placeholder="z. B. Hier verstehe ich den Kampf nicht"
              aria-label={"Notiz zu Zug " + moveNum}
              onChange={this._onChangeBookmark}
            />
            <Button small type="submit">
              Speichern
            </Button>
            <button
              type="button"
              className="SgfReplay-link"
              onClick={this._onCancelBookmark}>
              Abbrechen
            </button>
          </form>
        )}
      </div>
    );
  }

  _onKataGoMoves = (nodeId: number, moves: ?Array<KataGoMove>) => {
    this.setState({ kataGoMoves: moves ? { nodeId, moves } : null });
  };

  // A click on an empty point plays an own move (a side branch).
  _onClickPoint = (game: Object, loc: Point, color?: ?PlayerColor) => {
    let { tree, currentNode } = this.state;
    if (!tree || color) {
      return;
    }
    let played = playVariationMove(tree, currentNode, loc);
    if (played) {
      this.setState({ tree: played.tree, currentNode: played.nodeId });
      this._saveProgress(played.tree, played.nodeId);
    }
  };

  _onReturnToGame = () => {
    let { tree, currentNode } = this.state;
    if (!tree) {
      return;
    }
    let back = returnToGame(tree, currentNode);
    if (!back.computedState[back.currentNode]) {
      back.computedState = computeGameNodeStates(back, back.currentNode);
    }
    this.setState({ tree: back, currentNode: back.currentNode });
  };

  // Remembers the move on the game itself (inside a variation: where the
  // variation left the game).
  _saveProgress(tree: GameTree, nodeId: number) {
    let { progressKey, progressUrl } = this.state;
    if (!progressKey) {
      return;
    }
    let mainLine = getMainLine(tree);
    let branch = getBranchPoint(tree, nodeId);
    let move = mainLine.indexOf(typeof branch === "number" ? branch : nodeId);
    let names = getSgfPlayerNames(tree);
    let title =
      names.black && names.white
        ? names.black + " – " + names.white
        : "SGF-Partie";
    saveReplayMove(progressKey, Math.max(0, move), title, progressUrl);
  }

  _getMoveNode(move: number): ?number {
    let { tree } = this.state;
    return tree ? getMainLine(tree)[move] : null;
  }

  _onRestart = () => {
    let { tree } = this.state;
    if (tree) {
      this.setState({ resumedFrom: null });
      this._onChangeCurrentNode(tree.rootNode);
    }
  };

  _onJumpToBookmark = (e: Object) => {
    let nodeId = this._getMoveNode(Number(e.currentTarget.dataset.move));
    if (typeof nodeId === "number") {
      this._onChangeCurrentNode(nodeId);
    }
  };

  _onRemoveBookmark = (e: Object) => {
    let { progressKey } = this.state;
    if (progressKey) {
      this.setState({
        bookmarks: removeReplayBookmark(
          progressKey,
          Number(e.currentTarget.dataset.move)
        ),
      });
    }
  };

  _onOpenBookmark = () => {
    this.setState({ bookmarkDraft: "" });
  };

  _onChangeBookmark = (e: Object) => {
    this.setState({ bookmarkDraft: e.target.value });
  };

  _onCancelBookmark = () => {
    this.setState({ bookmarkDraft: null });
  };

  _onSaveBookmark = (e: Object) => {
    e.preventDefault();
    let { tree, currentNode, progressKey, bookmarkDraft } = this.state;
    if (!tree || !progressKey) {
      return;
    }
    let mainLine = getMainLine(tree);
    let branch = getBranchPoint(tree, currentNode);
    let move = mainLine.indexOf(
      typeof branch === "number" ? branch : currentNode
    );
    this._saveProgress(tree, currentNode);
    this.setState({
      bookmarks: addReplayBookmark(progressKey, move, bookmarkDraft || ""),
      bookmarkDraft: null,
    });
  };

  _onChangeCurrentNode = (nodeId: number) => {
    let { tree } = this.state;
    if (!tree) {
      return;
    }
    let nextTree: GameTree = { ...tree };
    if (!nextTree.computedState[nodeId]) {
      nextTree.computedState = computeGameNodeStates(nextTree, nodeId);
    }
    if (nextTree.currentLine.indexOf(nodeId) === -1) {
      nextTree.currentLine = getGameLine(nextTree, nodeId);
    }
    nextTree.currentNode = nodeId;
    this.setState({ tree: nextTree, currentNode: nodeId });
    this._saveProgress(nextTree, nodeId);
  };

  _setFileInput = (ref: HTMLInputElement | null) => {
    this._fileInput = ref;
  };

  _onFileChange = (e: Object) => {
    let file = e.target.files && e.target.files[0];
    if (!file) {
      return;
    }
    let reader = new FileReader();
    reader.onload = () => {
      let text = typeof reader.result === "string" ? reader.result : "";
      this._loadSgf(text);
    };
    reader.readAsText(file);
    // Reset so selecting the same file again re-triggers onChange
    if (this._fileInput) {
      this._fileInput.value = "";
    }
  };

  _onInputChange = (e: Object) => {
    this.setState({ input: e.target.value });
  };

  _onLoadInput = () => {
    this._loadSgf(this.state.input);
  };
}
