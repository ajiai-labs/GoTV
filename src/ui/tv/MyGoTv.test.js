import React from "react";
import ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";
import MyGoTv from "./MyGoTv";
import { validateTvChannel, validateTvEvent } from "../../model/tv";

const JUPP = validateTvChannel({
  id: "jupptube",
  name: "JuppTube",
  platform: "youtube",
  url: "https://www.youtube.com/@JuppTube",
  channel_id: "UCtIzNu7cS3h9DqOckBXU5wg",
  kind: "player",
  schedule: [{ weekday: 7, time: "10:30", duration_minutes: 150 }],
});
const SPEED_GO = validateTvEvent({
  id: "speed-go",
  name: "Speed Go",
  date_start: "2026-11-29",
  start: "2026-11-29T18:00:00+01:00",
  platform: "twitch",
  stream_url: "https://www.twitch.tv/europeangofederation",
});

describe("MyGoTv", () => {
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
    let handlers = {
      onToggleReminders: jest.fn(),
      onShowChannels: jest.fn(),
      onShowCalendar: jest.fn(),
    };
    act(() => {
      ReactDOM.render(
        <MyGoTv
          channels={[JUPP]}
          events={[SPEED_GO]}
          now={new Date("2026-11-29T10:00:00Z").getTime()}
          remindersEnabled={false}
          notificationPermission="default"
          {...handlers}
          {...props}
        />,
        container
      );
    });
    return handlers;
  }

  it("lists starred channels and tournaments, the running one first", () => {
    let handlers = render({
      favorites: { channels: ["jupptube"], events: ["speed-go"] },
    });
    let rows = Array.from(container.querySelectorAll(".MyGoTv-item")).map(
      (row) => row.textContent
    );
    expect(rows[0]).toContain("JuppTube");
    expect(rows[0]).toContain("läuft gerade (geplant)");
    expect(rows[1]).toContain("Speed Go");
    expect(rows[1]).toContain("Turnier");
    act(() => container.querySelectorAll(".MyGoTv-item")[1].click());
    expect(handlers.onShowCalendar).toHaveBeenCalled();
    act(() => container.querySelector(".MyGoTv-reminder input").click());
    expect(handlers.onToggleReminders).toHaveBeenCalled();
  });

  it("explains the stars while nothing is starred", () => {
    let handlers = render({ favorites: { channels: [], events: [] } });
    expect(container.textContent).toContain("Markiere Kanäle und Turniere");
    act(() => container.querySelector("button").click());
    expect(handlers.onShowChannels).toHaveBeenCalled();
  });

  it("says when the browser blocks reminders", () => {
    render({
      favorites: { channels: ["jupptube"], events: [] },
      notificationPermission: "denied",
    });
    expect(container.textContent).toContain(
      "Erinnerungen sind im Browser blockiert"
    );
  });
});
