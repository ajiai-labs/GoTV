// @flow
import React, { PureComponent as Component } from "react";
import TvSourceBadge from "./TvSourceBadge";
import type { BoardState, GameChannel } from "../../model";

type Props = {
  games: Array<GameChannel>,
  selectedKey: ?string,
  getKey: (GameChannel) => string,
  onSelect: (gameId: number, game: GameChannel) => any,
};

const STAR_POINTS: { [size: string]: Array<number> } = {
  "19": [3, 9, 15],
  "13": [3, 6, 9],
  "9": [2, 4, 6],
};

// The position the board shows: the latest move (live), else the current.
export function getPreviewBoard(game: GameChannel): ?BoardState {
  let tree = game.tree;
  if (!tree) {
    return null; // KGS list entry before joining: no moves known yet
  }
  let nodeId =
    typeof tree.activeNode === "number" ? tree.activeNode : tree.currentNode;
  let state = tree.computedState && tree.computedState[nodeId];
  return state ? state.board : null;
}

function MiniBoard({ board }: { board: BoardState }) {
  let size = board.length;
  let lines = [];
  for (let i = 0; i < size; i++) {
    lines.push(
      <line key={"h" + i} x1={0.5} y1={i + 0.5} x2={size - 0.5} y2={i + 0.5} />,
      <line key={"v" + i} x1={i + 0.5} y1={0.5} x2={i + 0.5} y2={size - 0.5} />
    );
  }
  let stars = [];
  for (let y of STAR_POINTS[String(size)] || []) {
    for (let x of STAR_POINTS[String(size)] || []) {
      stars.push(
        <circle
          key={"s" + x + "-" + y}
          className="BoardPreview-star"
          cx={x + 0.5}
          cy={y + 0.5}
          r={0.12}
        />
      );
    }
  }
  let stones = [];
  board.forEach((row, y) =>
    row.forEach((color, x) => {
      if (color) {
        stones.push(
          <circle
            key={x + "-" + y}
            className={"BoardPreview-stone BoardPreview-stone-" + color}
            cx={x + 0.5}
            cy={y + 0.5}
            r={0.46}
          />
        );
      }
    })
  );
  return (
    <svg
      className="BoardPreview-board"
      viewBox={"0 0 " + size + " " + size}
      aria-hidden="true">
      <rect width={size} height={size} className="BoardPreview-wood" />
      <g className="BoardPreview-lines">{lines}</g>
      {stars}
      {stones}
    </svg>
  );
}

function formatPlayer(game: GameChannel, role: string): string {
  let player: any = game.players && (game.players: any)[role];
  if (!player) {
    return "?";
  }
  return player.name + (player.rank ? " " + player.rank : "");
}

// Turnierübersicht: one small board per game of a broadcast (team match,
// several boards). The boards are the same (delayed) snapshots as the big
// board, so a preview never runs ahead of the video. A click brings the
// game up next to the stream.
export default class BoardPreviewGrid extends Component<Props> {
  render() {
    let { games, selectedKey, getKey } = this.props;
    return (
      <div className="BoardPreview-grid">
        {games.map((game) => {
          let key = getKey(game);
          let board = getPreviewBoard(game);
          return (
            <button
              type="button"
              key={key}
              className={
                "BoardPreview" +
                (key === selectedKey ? " BoardPreview-selected" : "")
              }
              aria-pressed={key === selectedKey}
              onClick={() => this.props.onSelect(game.id, game)}>
              {board ? (
                <MiniBoard board={board} />
              ) : (
                <div className="BoardPreview-board BoardPreview-empty">
                  Brett nach Klick
                </div>
              )}
              <span className="BoardPreview-players">
                <span className="BoardPreview-player">
                  ● {formatPlayer(game, "black")}
                </span>
                <span className="BoardPreview-player">
                  ○ {formatPlayer(game, "white")}
                </span>
              </span>
              <span className="BoardPreview-meta">
                <TvSourceBadge game={game} />{" "}
                {game.over
                  ? "beendet"
                  : game.moveNum
                  ? "Zug " + game.moveNum
                  : "läuft"}
              </span>
            </button>
          );
        })}
      </div>
    );
  }
}
