// @flow
import React, { PureComponent as Component } from "react";
import { formatPoint } from "../../model/KataGoEngine";
import type { GameMistake, PositionEval } from "../../model/KataGoEngine";
import type { GameTree } from "../../model";

type Props = {
  tree: GameTree,
  evals: Array<PositionEval>,
  mistakes: Array<GameMistake>,
  currentMove: number,
  onJump: (nodeId: number) => any,
};

const WIDTH = 600;
const HEIGHT = 90;
const COLOR_LABEL = { black: "Schwarz", white: "Weiß" };

function formatPoints(value: number): string {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

// The whole game at a glance: black's chance to win after every move
// (top = black wins), the current move marked, mistakes as red dots.
// A click on the curve jumps to that move.
export default class GameGraph extends Component<Props> {
  _svg: ?Element = null;

  _x(move: number): number {
    let last = Math.max(1, this.props.evals.length - 1);
    return (move / last) * WIDTH;
  }

  _y(winRate: number): number {
    return (1 - Math.max(0, Math.min(1, winRate))) * HEIGHT;
  }

  _onClickGraph = (e: Object) => {
    let svg = this._svg;
    let { evals } = this.props;
    if (!svg || !evals.length) {
      return;
    }
    let box = svg.getBoundingClientRect();
    let share = box.width ? (e.clientX - box.left) / box.width : 0;
    let move = Math.round(share * (evals.length - 1));
    let target = evals[Math.max(0, Math.min(evals.length - 1, move))];
    this.props.onJump(target.nodeId);
  };

  _setSvg = (ref: ?Element) => {
    this._svg = ref;
  };

  _onJumpToMistake = (e: Object) => {
    this.props.onJump(Number(e.currentTarget.dataset.node));
  };

  render() {
    let { evals, mistakes, currentMove, tree } = this.props;
    let points = evals
      .filter((value) => isFinite(value.winRate))
      .map((value) => this._x(value.move) + "," + this._y(value.winRate))
      .join(" ");
    let size = tree.computedState[tree.rootNode]
      ? tree.computedState[tree.rootNode].board.length
      : 19;
    return (
      <div className="GameGraph">
        <svg
          ref={this._setSvg}
          className="GameGraph-svg"
          viewBox={"0 0 " + WIDTH + " " + HEIGHT}
          preserveAspectRatio="none"
          role="img"
          aria-label="Gewinnchance Schwarz über die ganze Partie"
          onClick={this._onClickGraph}>
          <rect width={WIDTH} height={HEIGHT / 2} className="GameGraph-black" />
          <rect
            y={HEIGHT / 2}
            width={WIDTH}
            height={HEIGHT / 2}
            className="GameGraph-white"
          />
          <line
            x1={0}
            x2={WIDTH}
            y1={HEIGHT / 2}
            y2={HEIGHT / 2}
            className="GameGraph-middle"
          />
          <polyline points={points} className="GameGraph-line" />
          {mistakes.map((mistake) => {
            let value = evals[mistake.move];
            return value ? (
              <line
                key={mistake.move}
                x1={this._x(mistake.move)}
                x2={this._x(mistake.move)}
                y1={Math.max(0, this._y(value.winRate) - 10)}
                y2={Math.min(HEIGHT, this._y(value.winRate) + 10)}
                className="GameGraph-mistake"
              />
            ) : null;
          })}
          <line
            x1={this._x(currentMove)}
            x2={this._x(currentMove)}
            y1={0}
            y2={HEIGHT}
            className="GameGraph-current"
          />
        </svg>
        <div className="GameGraph-legend">
          oben Schwarz vorn, unten Weiß · Klick auf die Kurve springt zum Zug ·
          Fehler nach verlorener Gewinnchance, Punkte mit KataGo-Suche geprüft;
          das mitgelieferte kleine Netz ist in Ko-Kämpfen ungenau
        </div>
        {mistakes.length ? (
          <div className="GameGraph-mistakes">
            <span className="GameGraph-mistakes-title">
              Partieentscheidende Fehler:
            </span>
            {mistakes.map((mistake) => {
              let move: any = tree.nodes[mistake.nodeId].props.find(
                (prop) => prop.name === "MOVE"
              );
              let point =
                move && move.loc && move.loc !== "PASS"
                  ? formatPoint(move.loc.x, move.loc.y, size)
                  : "Passen";
              return (
                <button
                  type="button"
                  key={mistake.move}
                  className="GameGraph-mistake-button"
                  data-node={mistake.beforeNodeId}
                  title="Stellung vor dem Zug zeigen - KataGo zeigt dort den besseren Zug"
                  onClick={this._onJumpToMistake}>
                  Zug {mistake.move} · {COLOR_LABEL[mistake.color]} {point}: −
                  {Math.round(mistake.winRateLost * 100)} % · −
                  {formatPoints(mistake.pointsLost)} Punkte
                </button>
              );
            })}
          </div>
        ) : (
          <div className="GameGraph-mistakes">
            Keine Züge, die 2 Punkte oder mehr verloren haben.
          </div>
        )}
      </div>
    );
  }
}
