// @flow
// The official chat embeds of Twitch and YouTube, next to a stream.
// Twitch embeds a channel's chat by its login (with parent=<hostname>, as
// for the player). YouTube's live chat embed needs the id of the running
// video (with embed_domain=<hostname>); a channel alone is not enough, so
// for a YouTube channel GoTV links to YouTube instead.
import type { TvChannel, TvEvent } from "./tv";

export type StreamChatInfo = {
  platform: "youtube" | "twitch",
  embedUrl: string,
};

function twitchChat(login: string, host: string): StreamChatInfo {
  return {
    platform: "twitch",
    embedUrl:
      "https://www.twitch.tv/embed/" +
      encodeURIComponent(login) +
      "/chat?parent=" +
      encodeURIComponent(host),
  };
}

export function getChannelChat(
  channel: TvChannel,
  hostname: string
): ?StreamChatInfo {
  return channel.platform === "twitch"
    ? twitchChat(channel.channel_id, hostname || "localhost")
    : null;
}

export function getEventChat(
  event: TvEvent,
  hostname: string
): ?StreamChatInfo {
  let host = hostname || "localhost";
  if (event.platform === "youtube" && event.video_id) {
    return {
      platform: "youtube",
      embedUrl:
        "https://www.youtube.com/live_chat?v=" +
        encodeURIComponent(event.video_id) +
        "&embed_domain=" +
        encodeURIComponent(host),
    };
  }
  if (event.channel && event.channel.platform === "twitch") {
    return twitchChat(event.channel.id, host);
  }
  return null;
}
