import React from "react";
import ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";
import ReplayGameList from "./ReplayGameList";
import RecentReplays, { getRecentReplayEvents } from "./RecentReplays";
import CalendarEventCard from "./CalendarEventCard";

const EVENT = {
  id: "speed",
  name: "Speed Go",
  date_start: "2026-11-22",
  start: "2026-11-22T18:00:00+01:00",
  platform: "twitch",
  stream_url: "https://www.twitch.tv/egf",
  ogs_players: ["Surma", "Ovsi"],
};

const GAMES = [
  {
    id: 11,
    black: "Ovsi",
    white: "Surma",
    started: Date.parse("2026-11-22T16:50:00Z"),
    sgfUrl: "https://online-go.com/api/v1/games/11/sgf",
  },
  {
    id: 12,
    black: "Surma",
    white: "Ovsi",
    started: Date.parse("2026-11-22T17:38:00Z"),
    sgfUrl: "https://online-go.com/api/v1/games/12/sgf",
  },
];

async function flush() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe("replaying finished tournament games", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
  });

  it("loads the games on demand and opens the chosen one", async () => {
    let fetchGames = jest.fn(() => Promise.resolve(GAMES));
    let onOpenReplay = jest.fn();
    act(() => {
      ReactDOM.render(
        <ReplayGameList
          event={EVENT}
          onOpenReplay={onOpenReplay}
          fetchGames={fetchGames}
        />,
        container
      );
    });
    expect(fetchGames).not.toHaveBeenCalled();
    act(() => container.querySelector(".ReplayGameList-toggle").click());
    expect(container.textContent).toContain("Partien werden bei OGS gesucht");
    await act(flush);
    let rows = container.querySelectorAll(".ReplayGameList-game");
    expect(Array.from(rows).map((row) => row.textContent)).toEqual([
      expect.stringContaining("G1● Ovsi – ○ Surma"),
      expect.stringContaining("G2● Surma – ○ Ovsi"),
    ]);
    // No result anywhere: replaying must not be spoiled.
    expect(container.textContent).not.toMatch(/[BW]\+|Aufgabe|gewinnt/);
    act(() => rows[1].click());
    expect(onOpenReplay).toHaveBeenCalledWith(
      "https://online-go.com/api/v1/games/12/sgf"
    );
    act(() => container.querySelector(".ReplayGameList-toggle").click());
    expect(container.querySelector(".ReplayGameList-toggle").textContent).toBe(
      "2 Partien nachspielen"
    );
    act(() => container.querySelector(".ReplayGameList-toggle").click());
    expect(fetchGames).toHaveBeenCalledTimes(1);
  });

  it("says when OGS fails and lets you try again", async () => {
    let fetchGames = jest
      .fn()
      .mockReturnValueOnce(Promise.reject(new Error("OGS HTTP 502")))
      .mockReturnValueOnce(Promise.resolve([]));
    act(() => {
      ReactDOM.render(
        <ReplayGameList
          event={EVENT}
          onOpenReplay={jest.fn()}
          fetchGames={fetchGames}
          defaultOpen
        />,
        container
      );
    });
    await act(flush);
    expect(container.textContent).toContain(
      "Partien konnten nicht geladen werden (OGS HTTP 502)"
    );
    act(() => container.querySelector(".ReplayGameList-retry").click());
    await act(flush);
    expect(container.textContent).toContain(
      "Noch keine beendete Partie gefunden."
    );
  });

  it("lists the tournaments of the last three months, newest first", () => {
    let now = Date.parse("2026-11-23T12:00:00Z");
    let events = [
      { ...EVENT, id: "nov-01", date_start: "2026-11-01", start: undefined },
      EVENT,
      { ...EVENT, id: "upcoming", date_start: "2026-11-29", start: undefined },
      { ...EVENT, id: "old", date_start: "2026-08-01", start: undefined },
      {
        ...EVENT,
        id: "plain",
        date_start: "2026-11-15",
        start: undefined,
        ogs_players: undefined,
      },
      {
        ...EVENT,
        id: "sgf",
        date_start: "2026-11-10",
        start: undefined,
        ogs_players: undefined,
        sgf_url: "https://example.org/g.sgf",
      },
    ];
    expect(getRecentReplayEvents(events, now).map((e) => e.id)).toEqual([
      "speed",
      "sgf",
      "nov-01",
    ]);
    let onOpenReplay = jest.fn();
    act(() => {
      ReactDOM.render(
        <RecentReplays events={events} now={now} onOpenReplay={onOpenReplay} />,
        container
      );
    });
    expect(container.textContent).toContain(
      "Turnierpartien der letzten 3 Monate"
    );
    expect(container.querySelectorAll(".RecentReplays-event")).toHaveLength(3);
    act(() =>
      container
        .querySelectorAll(".RecentReplays-event")[1]
        .querySelector("button")
        .click()
    );
    expect(onOpenReplay).toHaveBeenCalledWith("https://example.org/g.sgf");
  });

  it("offers the games on the card once the event has begun", () => {
    let render = (now) =>
      act(() => {
        ReactDOM.render(
          <CalendarEventCard
            event={EVENT}
            onOpenReplay={jest.fn()}
            now={now}
          />,
          container
        );
      });
    render(Date.parse("2026-11-22T10:00:00Z"));
    expect(container.querySelector(".ReplayGameList")).toBe(null);
    render(Date.parse("2026-11-23T10:00:00Z"));
    expect(container.querySelector(".ReplayGameList")).not.toBe(null);
    expect(container.textContent).toContain(
      "Termin vorbei · Partien zum Nachspielen"
    );
  });
});
