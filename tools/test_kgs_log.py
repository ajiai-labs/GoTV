"""Tests for the KGS protocol log of the local server (desktop/kgs_log.py)."""

import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "desktop"))

from kgs_log import ProtocolLog, summarize_request, summarize_response  # noqa: E402


def body(data):
    return json.dumps(data).encode("utf-8")


class SummaryTest(unittest.TestCase):
    def test_never_a_password_nor_a_chat_line(self):
        login = summarize_request(body({"type": "LOGIN", "name": "andy1975", "password": "geheim"}))
        self.assertNotIn("geheim", login)
        self.assertEqual(login, "LOGIN name=andy1975")
        chat = summarize_request(body({"type": "CHAT", "channelId": 7, "text": "Hallo Anna"}))
        self.assertEqual(chat, "CHAT channelId=7 text=<10 Zeichen>")
        profile = summarize_request(body({"type": "DETAILS_CHANGE", "channelId": 9,
                                          "personalInfo": "über mich", "personalEmail": "a@b.de"}))
        self.assertNotIn("a@b.de", profile)
        self.assertNotIn("über", profile)

    def test_answers_with_type_channel_and_the_logout_reason(self):
        answer = body({"messages": [
            {"type": "GAME_UPDATE", "channelId": 5, "sgfEvents": [1, 2]},
            {"type": "CHAT", "channelId": 6, "text": "privat"},
            {"type": "LOGOUT", "text": "Internal error: Unknown channel 109735821"},
        ]})
        entries = summarize_response(answer)
        self.assertEqual(entries[:2], ["GAME_UPDATE@5", "CHAT@6"])
        self.assertIn("Unknown channel 109735821", entries[2])
        self.assertNotIn("privat", " ".join(entries))

    def test_odd_input_does_not_break_it(self):
        self.assertIn("kein JSON", summarize_request(b"<html>"))
        self.assertEqual(summarize_response(b""), [])
        self.assertIn("keine JSON", summarize_response(b"<html>")[0])


class FileTest(unittest.TestCase):
    def test_writes_lines_and_keeps_one_old_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "gotv", "kgs-protocol.log")
            log = ProtocolLog(path, max_bytes=200)
            log.request("POST", body({"type": "UNJOIN_REQUEST", "channelId": 3}), 200, b"")
            log.request("GET", None, 200, body({"messages": [{"type": "UNJOIN", "channelId": 3}]}))
            with open(path, encoding="utf-8") as fh:
                text = fh.read()
            self.assertIn("-> UNJOIN_REQUEST channelId=3  [HTTP 200]", text)
            self.assertIn("<- UNJOIN@3", text)
            for _ in range(10):
                log.write("x" * 50)
            self.assertTrue(os.path.exists(path + ".1"))
            self.assertLess(os.path.getsize(path), 400)


if __name__ == "__main__":
    unittest.main()
