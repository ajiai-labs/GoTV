// @flow
// Writes a GameTree back to SGF text - with all variations and comments -
// so a replayed game with own and KataGo variations can be saved as a
// file ("Als SGF speichern") and opened in any Go program.
import type { GameTree, SgfProp } from "./types";

const SGF_LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MARKS = {
  TRIANGLE: "TR",
  SQUARE: "SQ",
  CIRCLE: "CR",
  CROSS: "MA",
};
// Root text props only a game read from an SGF file has.
const FILE_PROPS = ["FF", "GM", "CA", "AP", "SZ", "KM", "RU", "HA"];
const RULESETS = {
  japanese: "Japanese",
  chinese: "Chinese",
  aga: "AGA",
  new_zealand: "NZ",
};

export function escapeSgfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/]/g, "\\]");
}

function writePoint(loc: mixed): string {
  if (!loc || loc === "PASS" || typeof loc !== "object") {
    return "";
  }
  let { x, y } = (loc: any);
  return (SGF_LETTERS[x] || "") + (SGF_LETTERS[y] || "");
}

function colorKey(color: mixed, black: string, white: string): ?string {
  return color === "black" ? black : color === "white" ? white : null;
}

// One SgfProp as [SGF name, value]; null for props SGF has no use for.
// fromFile: the game was read from SGF text, whose root keeps its own
// SZ/KM/... - RULES there only holds the parser's defaults.
function toSgfProp(prop: SgfProp, fromFile: boolean): Array<[string, string]> {
  let p: any = prop;
  switch (p.name) {
    case "MOVE": {
      let key = colorKey(p.color, "B", "W");
      return key ? [[key, writePoint(p.loc)]] : [];
    }
    case "ADDSTONE": {
      let key = p.color === "empty" ? "AE" : colorKey(p.color, "AB", "AW");
      return key ? [[key, writePoint(p.loc)]] : [];
    }
    case "COMMENT":
      return typeof p.text === "string" ? [["C", p.text]] : [];
    case "LABEL":
      return typeof p.text === "string"
        ? [["LB", writePoint(p.loc) + ":" + p.text]]
        : [];
    case "RULES": {
      // KGS games only have RULES; an SGF file brings its own SZ/KM/...
      if (fromFile) {
        return [];
      }
      let out = [];
      if (typeof p.size === "number") {
        out.push(["SZ", String(p.size)]);
      }
      if (typeof p.komi === "number") {
        out.push(["KM", String(p.komi)]);
      }
      if (typeof p.handicap === "number") {
        out.push(["HA", String(p.handicap)]);
      }
      if (RULESETS[p.rules]) {
        out.push(["RU", RULESETS[p.rules]]);
      }
      return out;
    }
    case "PLAYERNAME": {
      let key = colorKey(p.color, "PB", "PW");
      return key && typeof p.text === "string" ? [[key, p.text]] : [];
    }
    case "PLAYERRANK": {
      let key = colorKey(p.color, "BR", "WR");
      let rank = typeof p.text === "string" ? p.text : p.int;
      return key && rank !== undefined ? [[key, String(rank)]] : [];
    }
    default: {
      if (MARKS[p.name]) {
        return [[MARKS[p.name], writePoint(p.loc)]];
      }
      // Text props kept from an SGF file (PB, DT, RE, ...).
      if (/^[A-Z]{1,2}$/.test(p.name) && typeof p.text === "string") {
        return [[p.name, p.text]];
      }
      return []; // KGS-only data (clocks, ...) has no SGF form here
    }
  }
}

// ";B[pd]C[...]" - repeated props share one name (AB[aa][bb]).
function writeNode(props: Array<SgfProp>, fromFile: boolean) {
  let order = [];
  let values: { [string]: Array<string> } = {};
  for (let prop of props) {
    for (let [name, value] of toSgfProp(prop, fromFile)) {
      if (!values[name]) {
        values[name] = [];
        order.push(name);
      }
      values[name].push(value);
    }
  }
  return (
    ";" +
    order
      .map(
        (name) =>
          name +
          values[name].map((value) => "[" + escapeSgfText(value) + "]").join("")
      )
      .join("")
  );
}

export function writeSgf(tree: GameTree): string {
  let root = tree.nodes[tree.rootNode];
  let fromFile = root.props.some(
    (prop: any) =>
      FILE_PROPS.includes(prop.name) && typeof prop.text === "string"
  );
  // File format, game type and encoding, where the root lacks them.
  let header = [
    ["FF", "4"],
    ["GM", "1"],
    ["CA", "UTF-8"],
  ]
    .filter(([name]) => !root.props.some((prop) => prop.name === name))
    .map(([name, value]) => name + "[" + value + "]")
    .join("");

  // Iterative, so a long game cannot overflow the call stack.
  let out = "(";
  let stack: Array<string | number> = [tree.rootNode];
  let first = true;
  while (stack.length) {
    let item = stack.pop();
    if (typeof item === "string") {
      out += item;
      continue;
    }
    let node = tree.nodes[item];
    let text = writeNode(node.props, fromFile);
    if (first) {
      text = ";" + header + text.slice(1);
      first = false;
    }
    out += text;
    let children = node.children;
    if (children.length === 1) {
      stack.push(children[0]);
    } else if (children.length > 1) {
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push(")", children[i], "(");
      }
    }
  }
  return out + ")\n";
}

// "Ovsiienko-Surma-2026-11-22.sgf"
export function getSgfFileName(tree: GameTree): string {
  let root = tree.nodes[tree.rootNode];
  let text = (name: string) => {
    let prop: any = root.props.find((p) => p.name === name);
    return prop && typeof prop.text === "string" ? prop.text : "";
  };
  let parts = [text("PB"), text("PW"), text("DT").slice(0, 10)]
    .map((part) =>
      part.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "")
    )
    .filter(Boolean);
  return (parts.length ? parts.join("-") : "partie") + ".sgf";
}
