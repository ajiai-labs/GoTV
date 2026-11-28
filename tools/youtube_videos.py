"""youtube_videos.py - the newest videos of the YouTube channels in
events.json, from YouTube's official channel feed (no API key):

    https://www.youtube.com/feeds/videos.xml?channel_id=UC...

The feed lists a channel's last 15 uploads with title and date; announced
live streams appear there too, but without their start time (checked
28.11.2026: Nihon Ki-in's Nongshim Cup broadcast of 29.11. stood in the
feed on 27.11. with 0 views). GoTV shows them as "Neue Videos" on the
Kanäle tab. Written to the top-level "videos" array of events.json; only
that array is touched. Standard library only (AGENTS.md).
"""

import datetime
import urllib.request
import xml.etree.ElementTree as ET

YOUTUBE_SOURCE = "youtube-rss"
FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
USER_AGENT = "GoTV-events-importer/1.0 (+https://github.com/ajiai-labs/GoTV)"
MAX_PER_CHANNEL = 6
MAX_AGE_DAYS = 60

NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "yt": "http://www.youtube.com/xml/schemas/2015",
}


def fetch_feed(channel_id, timeout=20):
    request = urllib.request.Request(
        FEED_URL.format(channel_id=channel_id), headers={"User-Agent": USER_AGENT}
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8")


def _parse_time(value):
    return datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))


def parse_feed(xml_text):
    """[(video_id, title, published datetime)] of one channel feed."""
    root = ET.fromstring(xml_text)
    videos = []
    for entry in root.findall("atom:entry", NS):
        video_id = entry.findtext("yt:videoId", default="", namespaces=NS).strip()
        title = entry.findtext("atom:title", default="", namespaces=NS).strip()
        published = entry.findtext("atom:published", default="", namespaces=NS).strip()
        if not video_id or not published:
            continue
        try:
            when = _parse_time(published)
        except ValueError:
            continue
        videos.append((video_id, title, when))
    return videos


def youtube_channels(data):
    """The YouTube channels of events.json with a UC… channel id."""
    return [
        c
        for c in data.get("channels", [])
        if isinstance(c, dict)
        and c.get("platform") == "youtube"
        and str(c.get("channel_id", "")).startswith("UC")
    ]


def channel_videos(channel, xml_text, now):
    oldest = now - datetime.timedelta(days=MAX_AGE_DAYS)
    fresh = [v for v in parse_feed(xml_text) if v[2] >= oldest]
    fresh.sort(key=lambda v: v[2], reverse=True)
    return [
        {
            "channel": channel["id"],
            "video_id": video_id,
            "title": title,
            "published": when.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        for video_id, title, when in fresh[:MAX_PER_CHANNEL]
    ]


def collect_videos(data, fetch, now):
    """(videos, failed channel ids). A channel whose feed fails keeps its
    videos from the last run."""
    previous = [v for v in data.get("videos", []) if isinstance(v, dict)]
    videos, failed = [], []
    for channel in youtube_channels(data):
        try:
            videos.extend(channel_videos(channel, fetch(channel["channel_id"]), now))
        except Exception:  # network, HTTP or XML errors of this one feed
            failed.append(channel["id"])
            videos.extend(v for v in previous if v.get("channel") == channel["id"])
    videos.sort(key=lambda v: (v["published"], v["video_id"]), reverse=True)
    return videos, failed
