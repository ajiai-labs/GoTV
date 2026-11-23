import {
  EMPTY_FAVORITES,
  isFavorite,
  loadFavorites,
  parseFavorites,
  saveFavorites,
  toggleFavorite,
} from "./TvFavorites";

describe("TvFavorites", () => {
  beforeEach(() => window.localStorage.clear());

  it("toggles a star without changing the old object", () => {
    let starred = toggleFavorite(EMPTY_FAVORITES, "channels", "jupptube");
    expect(starred.channels).toEqual(["jupptube"]);
    expect(EMPTY_FAVORITES.channels).toEqual([]);
    expect(isFavorite(starred, "channels", "jupptube")).toBe(true);
    expect(isFavorite(starred, "events", "jupptube")).toBe(false);
    let removed = toggleFavorite(starred, "channels", "jupptube");
    expect(removed.channels).toEqual([]);
  });

  it("stores the stars in this browser", () => {
    saveFavorites({ channels: ["egf"], events: ["speed-go"] });
    expect(loadFavorites()).toEqual({
      channels: ["egf"],
      events: ["speed-go"],
    });
  });

  it("ignores a broken or foreign entry", () => {
    expect(parseFavorites("{nope")).toEqual(EMPTY_FAVORITES);
    expect(parseFavorites('{"channels": [1, "egf", null]}')).toEqual({
      channels: ["egf"],
      events: [],
    });
    expect(parseFavorites(null)).toEqual(EMPTY_FAVORITES);
  });
});
