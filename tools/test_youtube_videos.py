"""Tests for the YouTube channel feeds (tools/youtube_videos.py,
update_events.py --source youtube-rss)."""

import datetime
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import update_events  # noqa: E402
import youtube_videos  # noqa: E402

FEED = (Path(__file__).resolve().parent / "testdata" / "youtube-feed-sample.xml").read_text(
    encoding="utf-8"
)
NOW = datetime.datetime(2026, 11, 28, tzinfo=datetime.timezone.utc)
CHANNELS = [
    {"id": "sample-youtube", "platform": "youtube", "channel_id": "UC00000000000000000000aa"},
    {"id": "other-youtube", "platform": "youtube", "channel_id": "UC00000000000000000000bb"},
    {"id": "some-twitch", "platform": "twitch", "channel_id": "sometwitch"},
]


class FeedTest(unittest.TestCase):
    def test_reads_recent_videos_newest_first(self):
        videos = youtube_videos.channel_videos(CHANNELS[0], FEED, NOW)
        self.assertEqual(
            videos,
            [
                {
                    "channel": "sample-youtube",
                    "video_id": "AAAAAAAAAA1",
                    "title": "Sample Championship Round 2",
                    "published": "2026-11-20T18:00:00Z",
                },
                {
                    "channel": "sample-youtube",
                    "video_id": "AAAAAAAAAA0",
                    "title": "Sample Championship Round 1 & review",
                    "published": "2026-11-19T18:00:00Z",
                },
            ],
        )

    def test_only_youtube_channels_with_a_channel_id(self):
        ids = [c["id"] for c in youtube_videos.youtube_channels({"channels": CHANNELS})]
        self.assertEqual(ids, ["sample-youtube", "other-youtube"])

    def test_a_failing_feed_keeps_that_channels_videos(self):
        old = {"channel": "other-youtube", "video_id": "BBBBBBBBBB1", "title": "x", "published": "2026-11-01T00:00:00Z"}

        def fetch(channel_id):
            if channel_id.endswith("bb"):
                raise OSError("down")
            return FEED

        videos, failed = youtube_videos.collect_videos({"channels": CHANNELS, "videos": [old]}, fetch, NOW)
        self.assertEqual(failed, ["other-youtube"])
        self.assertIn(old, videos)
        self.assertEqual(len(videos), 3)


class ImportTest(unittest.TestCase):
    def run_import(self, data, fetch):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "events.json"
            path.write_text(json.dumps(data), encoding="utf-8")
            code = update_events.import_youtube_videos(json.loads(path.read_text()), path, False, fetch, NOW)
            return code, json.loads(path.read_text(encoding="utf-8"))

    def test_writes_only_the_videos_array(self):
        data = {"events": [{"id": "hand"}], "channels": CHANNELS}
        code, written = self.run_import(data, lambda channel_id: FEED)
        self.assertEqual(code, 0)
        self.assertEqual(written["events"], [{"id": "hand"}])
        self.assertEqual(written["channels"], CHANNELS)
        self.assertEqual(len(written["videos"]), 4)

    def test_refuses_when_no_feed_can_be_read(self):
        data = {"events": [], "channels": CHANNELS, "videos": [{"video_id": "keep"}]}

        def down(channel_id):
            raise OSError("offline")

        code, written = self.run_import(data, down)
        self.assertEqual(code, 1)
        self.assertEqual(written["videos"], [{"video_id": "keep"}])


if __name__ == "__main__":
    unittest.main()
