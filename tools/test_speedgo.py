import contextlib
import datetime
import io
import json
import tempfile
import unittest
from pathlib import Path

from tools import speedgo, update_events

SAMPLE = Path(__file__).resolve().parent / "testdata" / "speedgo-bracket-sample.html"
TODAY = datetime.date(2026, 11, 23)


def entry(id_, name, date, source=None, **extra):
    event = {
        "id": id_,
        "name": name,
        "date_start": date,
        "start": date + "T18:00:00+01:00",
        "platform": "twitch",
        "stream_url": speedgo.STREAM_URL,
        "channel": dict(speedgo.STREAM_CHANNEL),
    }
    if source:
        event["source"] = source
    event.update(extra)
    return event


class ParseBracketTest(unittest.TestCase):
    def setUp(self):
        self.matches = speedgo.parse_bracket_html(SAMPLE.read_text(encoding="utf-8"))

    def test_reads_players_rounds_dates_and_games(self):
        self.assertEqual(
            [(m["round"], m["players"][0][0], m["start"], m["ogs_game_ids"]) for m in self.matches],
            [
                ("Achtelfinale", "Anna Alpha", None, [1001, 1002, 1003]),
                ("Achtelfinale", "Carla Gamma", "2026-11-29T18:00:00+01:00", []),
                # January belongs to the second year of the season.
                ("Achtelfinale", "Emil Epsilon", "2027-01-09T18:30:00+01:00", []),
                (speedgo.SMALL_FINAL, "Gina Eta", "2027-02-21T18:00:00+01:00", []),
            ],
        )
        self.assertEqual(self.matches[0]["players"][1], ("Bruno Le Bêta", "2p"))

    def test_skips_placeholders(self):
        self.assertNotIn("TBD", [p for m in self.matches for p, _r in m["players"]])

    def test_never_guesses_a_date(self):
        season = (datetime.date(2026, 11, 1), datetime.date(2027, 2, 21))
        self.assertIsNone(speedgo.parse_when("soon", season))
        self.assertIsNone(speedgo.parse_when("Sunday · 31. 11. 6pm CET", season))
        self.assertIsNone(speedgo.parse_when("Sunday · 29. 11. 6pm CET", None))
        self.assertEqual(
            speedgo.parse_when("Sunday · 5. 7. 11am CEST", season)[11:],
            "11:00:00+02:00",
        )


class EventsTest(unittest.TestCase):
    def setUp(self):
        self.matches = speedgo.parse_bracket_html(SAMPLE.read_text(encoding="utf-8"))

    def test_dated_matches_become_entries_without_results(self):
        fresh = speedgo.fresh_events(self.matches, [])
        self.assertEqual(
            [e["id"] for e in fresh],
            [
                "speedgo-2026-11-29-gamma-delta",
                "speedgo-2027-01-09-epsilon-zeta",
                "speedgo-2027-02-21-eta-theta",
            ],
        )
        first = fresh[0]
        self.assertEqual(first["name"], "Speed Go Championship: Carla Gamma 7d – Dario Delta 6d")
        self.assertEqual(first["channel"], {"platform": "twitch", "id": "europeangofederation"})
        self.assertEqual(first["source"], "speedgo")
        self.assertTrue(first["notes"].startswith("Achtelfinale, Best of five."))
        self.assertNotIn("3", first["notes"].split("Best of")[0])

    def test_a_hand_entry_for_the_pairing_wins(self):
        hand = entry("hand", "Speed Go Championship: Carla Gamma – Dario Delta", "2026-11-29")
        fresh = speedgo.fresh_events(self.matches, [hand])
        self.assertNotIn("speedgo-2026-11-29-gamma-delta", [e["id"] for e in fresh])

    def test_the_twitch_schedule_does_not_block_an_entry(self):
        twitch = entry(
            "tw", "Speed Go Championship | Carla Gamma 7d vs Dario Delta 6d",
            "2026-11-29", "twitch-egf",
        )
        fresh = speedgo.fresh_events(self.matches, [twitch])
        self.assertIn("speedgo-2026-11-29-gamma-delta", [e["id"] for e in fresh])

    def test_games_go_to_the_hand_entry_first(self):
        twitch = entry("tw", "Speed Go Championship | Anna Alpha 3p vs Bruno Le Beta 2p", "2026-11-08", "twitch-egf")
        hand = entry("hand", "Speed Go Championship: Anna Alpha 3p – Bruno Le Bêta 2p", "2026-11-08")
        events, enriched = speedgo.enrich_with_games([twitch, hand], self.matches)
        self.assertEqual([e["id"] for e in enriched], ["hand"])
        self.assertEqual(events[1]["ogs_game_ids"], [1001, 1002, 1003])
        self.assertNotIn("ogs_game_ids", events[0])
        self.assertNotIn("ogs_game_ids", hand)  # copied, not changed in place

    def test_existing_games_are_kept(self):
        hand = entry("hand", "Speed Go Championship: Anna Alpha – Bruno Le Bêta", "2026-11-08", ogs_game_ids=[7])
        events, enriched = speedgo.enrich_with_games([hand], self.matches)
        self.assertEqual(enriched, [])
        self.assertEqual(events[0]["ogs_game_ids"], [7])

    def test_merge_keeps_a_played_match_and_adds_its_games(self):
        played = entry(
            "speedgo-2026-11-08-alpha-le-beta",
            "Speed Go Championship: Anna Alpha 3p – Bruno Le Bêta 2p",
            "2026-11-08",
            "speedgo",
        )
        merged, added, updated, removed = update_events.merge_speedgo_events(
            [played], self.matches, TODAY
        )
        self.assertEqual(removed, [])
        self.assertEqual([e["id"] for e in updated], ["speedgo-2026-11-08-alpha-le-beta"])
        self.assertEqual(updated[0]["ogs_game_ids"], [1001, 1002, 1003])
        self.assertEqual(len(added), 3)
        self.assertIn(played["id"], [e["id"] for e in merged])


class OgsAccountsTest(unittest.TestCase):
    def setUp(self):
        self.matches = speedgo.parse_bracket_html(SAMPLE.read_text(encoding="utf-8"))
        self.calls = []

    def fetch(self, game_id):
        self.calls.append(game_id)
        return {1001: ["bruno-new", "anna-ogs"]}[game_id]

    def test_a_played_match_teaches_the_other_players_account(self):
        accounts = speedgo.learn_ogs_accounts(
            self.matches, self.fetch, {"Anna Alpha": "anna-ogs", "Bruno Le Bêta": "bruno-old"}
        )
        self.assertEqual(self.calls, [1001])  # one request per played match
        self.assertEqual(accounts["bruno le beta"], "bruno-new")
        self.assertEqual(accounts["anna alpha"], "anna-ogs")

    def test_no_account_is_guessed(self):
        accounts = speedgo.learn_ogs_accounts(self.matches, self.fetch, {"Carla Gamma": "carla"})
        self.assertNotIn("anna alpha", accounts)
        self.assertNotIn("bruno le beta", accounts)
        self.assertEqual(speedgo.learn_ogs_accounts(self.matches, None, {}), {})

    def test_a_failing_request_only_skips_that_match(self):
        def broken(_game_id):
            raise OSError("429")

        accounts = speedgo.learn_ogs_accounts(self.matches, broken, {"Anna Alpha": "anna-ogs"})
        self.assertEqual(accounts, {"anna alpha": "anna-ogs"})

    def test_upcoming_matches_get_the_known_accounts(self):
        accounts = speedgo.learn_ogs_accounts(self.matches, None, {"Carla Gamma": "carla", "Dario Delta": "dario"})
        fresh = speedgo.fresh_events(self.matches, [], accounts)
        self.assertEqual(fresh[0]["ogs_players"], ["carla", "dario"])
        self.assertNotIn("ogs_players", fresh[1])  # nobody known: stream only

    def test_one_known_player_is_enough(self):
        accounts = speedgo.learn_ogs_accounts(self.matches, None, {"Dario Delta": "dario"})
        self.assertEqual(speedgo.fresh_events(self.matches, [], accounts)[0]["ogs_players"], ["dario"])

    def test_existing_entries_get_players_but_keep_their_links(self):
        accounts = speedgo.learn_ogs_accounts(self.matches, None, {"Carla Gamma": "carla"})
        plain = entry("speedgo-2026-11-29-gamma-delta", "Speed Go Championship: Carla Gamma 7d – Dario Delta 6d", "2026-11-29", "speedgo")
        linked = entry("hand", "Speed Go Championship: Emil Epsilon – Fiona Zeta", "2027-01-09", ogs_players=["emil"])
        events, enriched = speedgo.enrich_with_players([plain, linked], self.matches, accounts)
        self.assertEqual([e["id"] for e in enriched], [plain["id"]])
        self.assertEqual(events[0]["ogs_players"], ["carla"])
        self.assertNotIn("ogs_players", plain)  # copied, not changed in place
        self.assertEqual(events[1]["ogs_players"], ["emil"])

    def test_merge_reports_entries_that_got_players(self):
        plain = entry("speedgo-2026-11-29-gamma-delta", "Speed Go Championship: Carla Gamma 7d – Dario Delta 6d", "2026-11-29", "speedgo")
        accounts = speedgo.learn_ogs_accounts(self.matches, None, {"Carla Gamma": "carla"})
        _merged, _added, updated, _removed = update_events.merge_speedgo_events(
            [plain], self.matches, TODAY, accounts
        )
        self.assertEqual({e["id"]: e.get("ogs_players") for e in updated}[plain["id"]], ["carla"])


class ReviewFindingsTest(unittest.TestCase):
    """Review 26.11.2026: learning must not depend on the page order, and an
    upcoming match must not give its accounts to an older entry."""

    def test_learning_does_not_depend_on_the_order_of_matches(self):
        def match(a, b, game):
            return {"round": "", "players": [(a, ""), (b, "")], "start": None, "ogs_game_ids": [game]}

        games = {1: ["x-ogs", "y-ogs"], 2: ["y-ogs", "z-ogs"]}
        matches = [match("Xa X", "Ya Y", 1), match("Ya Y", "Za Z", 2)]
        accounts = speedgo.learn_ogs_accounts(matches, games.__getitem__, {"Za Z": "z-ogs"})
        self.assertEqual(accounts["ya y"], "y-ogs")
        self.assertEqual(accounts["xa x"], "x-ogs")

    def test_an_older_entry_of_the_pairing_gets_no_accounts(self):
        matches = speedgo.parse_bracket_html(SAMPLE.read_text(encoding="utf-8"))
        accounts = speedgo.learn_ogs_accounts(matches, None, {"Carla Gamma": "carla"})
        old = entry("old", "Speed Go Championship: Carla Gamma – Dario Delta", "2025-11-30")
        events, enriched = speedgo.enrich_with_players([old], matches, accounts)
        self.assertEqual(enriched, [])
        self.assertNotIn("ogs_players", events[0])


class MainTest(unittest.TestCase):
    def run_main(self, html_path, events):
        with tempfile.TemporaryDirectory() as temp:
            events_path = Path(temp) / "events.json"
            events_path.write_text(json.dumps({"events": events, "channels": []}), encoding="utf-8")
            out, err = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                code = update_events.main(
                    ["--source", "speedgo", "--speedgo-html-file", str(html_path), "--events-file", str(events_path)]
                )
            return code, json.loads(events_path.read_text(encoding="utf-8")), err.getvalue()

    def test_imports_from_a_local_page(self):
        code, data, _err = self.run_main(SAMPLE, [])
        self.assertEqual(code, 0)
        self.assertEqual(len([e for e in data["events"] if e.get("source") == "speedgo"]), 3)

    def test_refuses_a_page_without_matches(self):
        with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as page:
            page.write("<html>maintenance</html>")
        try:
            code, data, err = self.run_main(page.name, [entry("x", "Other", "2026-12-01")])
        finally:
            Path(page.name).unlink()
        self.assertEqual(code, 1)
        self.assertIn("no matches", err)
        self.assertEqual([e["id"] for e in data["events"]], ["x"])


if __name__ == "__main__":
    unittest.main()
