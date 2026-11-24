import { getChannelChat, getEventChat } from "./StreamChat";
import { getChannelLiveUrl, getWeekPlan } from "./tvChannels";
import { validateTvChannel } from "./tv";

const TWITCH = validateTvChannel({
  id: "egf-twitch",
  name: "EGF",
  platform: "twitch",
  url: "https://www.twitch.tv/europeangofederation",
  channel_id: "europeangofederation",
  schedule: [{ weekday: 7, time: "18:00" }],
});
const YOUTUBE = validateTvChannel({
  id: "jupptube",
  name: "JuppTube",
  platform: "youtube",
  url: "https://www.youtube.com/@JuppTube",
  channel_id: "UCtIzNu7cS3h9DqOckBXU5wg",
  schedule: [{ weekday: 7, time: "10:30" }],
});

describe("stream chat embeds", () => {
  it("embeds a Twitch channel's chat with the page as parent", () => {
    expect(getChannelChat(TWITCH, "ajiai-labs.github.io")).toEqual({
      platform: "twitch",
      embedUrl:
        "https://www.twitch.tv/embed/europeangofederation/chat?parent=ajiai-labs.github.io",
    });
  });

  it("has no embedded chat for a YouTube channel without a video", () => {
    expect(getChannelChat(YOUTUBE, "localhost")).toBe(null);
  });

  it("embeds the YouTube live chat of a known video", () => {
    expect(
      getEventChat(
        {
          id: "x",
          name: "x",
          date_start: "2026-11-29",
          platform: "youtube",
          stream_url: "https://www.youtube.com/watch?v=abc123",
          video_id: "abc123",
        },
        "127.0.0.1"
      )
    ).toEqual({
      platform: "youtube",
      embedUrl:
        "https://www.youtube.com/live_chat?v=abc123&embed_domain=127.0.0.1",
    });
  });

  it("embeds the Twitch chat of an event on a Twitch channel", () => {
    let chat = getEventChat(
      {
        id: "x",
        name: "x",
        date_start: "2026-11-29",
        platform: "twitch",
        stream_url: "https://www.twitch.tv/europeangofederation",
        channel: { platform: "twitch", id: "europeangofederation" },
      },
      "localhost"
    );
    expect(chat.embedUrl).toBe(
      "https://www.twitch.tv/embed/europeangofederation/chat?parent=localhost"
    );
  });
});

describe("channel links and week plan", () => {
  it("links to the running broadcast", () => {
    expect(getChannelLiveUrl(YOUTUBE)).toBe(
      "https://www.youtube.com/channel/UCtIzNu7cS3h9DqOckBXU5wg/live"
    );
    expect(getChannelLiveUrl(TWITCH)).toBe(
      "https://www.twitch.tv/europeangofederation"
    );
  });

  it("lays the air times out as a week, Monday first", () => {
    let week = getWeekPlan([TWITCH, YOUTUBE]);
    expect(week.map((day) => day.label)).toEqual([
      "Mo",
      "Di",
      "Mi",
      "Do",
      "Fr",
      "Sa",
      "So",
    ]);
    expect(
      week[6].entries.map((entry) => entry.time + " " + entry.channel.name)
    ).toEqual(["10:30 JuppTube", "18:00 EGF"]);
    expect(week[0].entries).toEqual([]);
  });
});
