import React from "react";
import ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";
import ChannelsView from "./ChannelsView";
import { validateTvChannel } from "../../model/tv";

// Sunday 22.11.2026, 11:00 German time.
const SUNDAY_MORNING = new Date("2026-11-22T10:00:00Z").getTime();

function channel(id, extra = {}) {
  return validateTvChannel({
    id,
    name: id,
    platform: "youtube",
    url: "https://www.youtube.com/@" + id,
    channel_id: "UC" + id,
    ...extra,
  });
}

const CHANNELS = [
  channel("EGF"),
  channel("Dojang", { kind: "player" }),
  channel("JuppTube", {
    kind: "player",
    schedule: [{ weekday: 7, time: "10:30", duration_minutes: 150 }],
  }),
];

describe("ChannelsView", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
  });

  function render(props) {
    act(() => {
      ReactDOM.render(
        <ChannelsView status="ready" channels={CHANNELS} {...props} />,
        container
      );
    });
  }

  function texts(selector) {
    return Array.from(container.querySelectorAll(selector)).map(
      (node) => node.textContent
    );
  }

  it("lists players apart from federations, the one on air first", () => {
    render({ now: SUNDAY_MORNING });
    expect(texts(".ChannelsView-group-title")).toEqual([
      "Spieler",
      "Verbände und Turniere",
    ]);
    expect(texts(".ChannelCard-name")).toEqual(["JuppTube", "Dojang", "EGF"]);
    expect(texts(".ChannelCard-live")).toEqual(["läuft gerade (geplant)"]);
    expect(texts(".ChannelCard-schedule")[0]).toContain(
      "Feste Sendezeit: sonntags 10:30 Uhr (deutsche Zeit)"
    );
  });

  it("shows the air time without the live mark outside of it", () => {
    render({ now: new Date("2026-11-23T10:00:00Z").getTime() });
    expect(texts(".ChannelCard-live")).toEqual([]);
    expect(texts(".ChannelCard-name")).toEqual(["Dojang", "JuppTube", "EGF"]);
  });

  it("puts starred channels on top and toggles the star", () => {
    let onToggleFavorite = jest.fn();
    render({
      now: new Date("2026-11-23T10:00:00Z").getTime(),
      favoriteIds: ["EGF"],
      onToggleFavorite,
    });
    expect(texts(".ChannelsView-group-title")).toEqual([
      "★ Favoriten",
      "Spieler",
    ]);
    expect(texts(".ChannelCard-name")[0]).toContain("EGF");
    let star = container.querySelector(".FavoriteStar-active");
    expect(star.getAttribute("aria-pressed")).toBe("true");
    act(() => star.click());
    expect(onToggleFavorite).toHaveBeenCalledWith("EGF");
  });

  it("shows the week plan, links to the platform and offers the Twitch chat", () => {
    render({
      now: SUNDAY_MORNING,
      channels: [
        ...CHANNELS,
        channel("egftwitch", {
          platform: "twitch",
          url: "https://www.twitch.tv/europeangofederation",
          channel_id: "europeangofederation",
        }),
      ],
    });
    expect(texts(".ChannelWeek-day-label")).toHaveLength(7);
    expect(texts(".ChannelWeek-entry-now")).toEqual(["10:30 JuppTube"]);
    let links = Array.from(container.querySelectorAll(".ChannelCard-open"));
    expect(links[0].getAttribute("href")).toBe(
      "https://www.youtube.com/channel/UCJuppTube/live"
    );
    expect(links[0].textContent).toBe("Auf YouTube öffnen (mit Chat)");
    expect(links[0].getAttribute("rel")).toBe("noopener noreferrer");
    // Only the Twitch channel gets an embedded chat, and only after a click.
    let toggles = container.querySelectorAll(".StreamChat-toggle");
    expect(toggles).toHaveLength(1);
    expect(container.querySelector(".StreamChat-frame")).toBe(null);
    act(() => toggles[0].click());
    expect(
      container.querySelector(".StreamChat-frame").getAttribute("src")
    ).toBe(
      "https://www.twitch.tv/embed/europeangofederation/chat?parent=localhost"
    );
  });

  it("says so when the roster cannot be loaded", () => {
    let onRetry = jest.fn();
    render({ status: "error", channels: [], now: SUNDAY_MORNING, onRetry });
    expect(container.textContent).toContain(
      "Kanäle konnten nicht geladen werden"
    );
    act(() => {
      container.querySelector("button").click();
    });
    expect(onRetry).toHaveBeenCalled();
  });

  it("names an empty roster", () => {
    render({ channels: [], now: SUNDAY_MORNING });
    expect(container.textContent).toContain("Keine Kanäle eingetragen.");
  });
});
