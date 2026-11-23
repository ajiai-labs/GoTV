import { escapeSgfText, getSgfFileName, writeSgf } from "./SgfWriter";
import { parseSgf } from "./sgf";
import { getMainLine, playVariationLine } from "./ReplayVariation";

describe("writeSgf", () => {
  it("writes a parsed game back with its root info", () => {
    let text =
      "(;FF[4]GM[1]SZ[9]KM[6.5]PB[Ann]PW[Bob]RE[W+R]AB[cc][gg];W[ee]C[gut];B[])";
    let sgf = writeSgf(parseSgf(text));
    expect(sgf).toBe(
      "(;CA[UTF-8]FF[4]GM[1]SZ[9]KM[6.5]PB[Ann]PW[Bob]RE[W+R]AB[cc][gg];W[ee]C[gut];B[])\n"
    );
  });

  it("keeps variations and their comments, game first", () => {
    let tree = parseSgf("(;SZ[9];B[cc];W[gg];B[cg])");
    let line = getMainLine(tree);
    let laid = playVariationLine(
      tree,
      line[1],
      [
        { x: 4, y: 4 },
        { x: 5, y: 5 },
      ],
      "KataGo-Variante: E5"
    );
    let sgf = writeSgf(laid.tree);
    expect(sgf).toBe(
      "(;FF[4]GM[1]CA[UTF-8]SZ[9];B[cc]" +
        "(;W[gg];B[cg])" +
        "(;W[ee]C[KataGo-Variante: E5];B[ff]))\n"
    );
    // ... and reads back to the same tree shape.
    let reread = parseSgf(sgf);
    expect(getMainLine(reread)).toHaveLength(4);
    expect(reread.nodes[getMainLine(reread)[1]].children).toHaveLength(2);
  });

  it("adds size and komi for games without SGF text props (KGS)", () => {
    let tree = parseSgf("(;SZ[13];B[cc])");
    let root = tree.nodes[tree.rootNode];
    root.props = root.props.filter((prop) => prop.name !== "SZ");
    root.props.push({ name: "PLAYERNAME", color: "white", text: "kgsfan" });
    expect(writeSgf(tree)).toContain("SZ[13]KM[6.5]RU[Japanese]PW[kgsfan]");
  });

  it("adds only the header props the file lacks", () => {
    expect(writeSgf(parseSgf("(;GM[1]SZ[9];B[cc])"))).toBe(
      "(;FF[4]CA[UTF-8]GM[1]SZ[9];B[cc])\n"
    );
  });

  it("escapes brackets and backslashes", () => {
    expect(escapeSgfText("a]b\\c")).toBe("a\\]b\\\\c");
  });

  it("names the file after the players and date", () => {
    let tree = parseSgf(
      "(;SZ[9]PB[Ovsiienko V.]PW[mateusz.surma]DT[2026-11-22])"
    );
    expect(getSgfFileName(tree)).toBe(
      "Ovsiienko_V.-mateusz.surma-2026-11-22.sgf"
    );
    expect(getSgfFileName(parseSgf("(;SZ[9])"))).toBe("partie.sgf");
  });
});
