"""Tests of the practice KGS (tools/fake_kgs.py) - a developer tool."""
import unittest

from tools import fake_kgs


class RulesTest(unittest.TestCase):
    def test_capture_and_suicide(self):
        board = fake_kgs.empty_board()
        for x, y in ((1, 0), (0, 1)):
            board = fake_kgs.play(board, "black", x, y)
        self.assertIsNone(fake_kgs.play(board, "white", 0, 0))  # suicide
        board = fake_kgs.play(board, "white", 1, 1)
        board[0][0] = "white"
        board = fake_kgs.play(board, "black", 2, 0)  # no capture yet
        self.assertEqual(board[0][0], "white")
        self.assertIsNone(fake_kgs.play(board, "black", 2, 0))  # occupied

    def test_reads_the_moves_of_a_record(self):
        moves = fake_kgs.sgf_moves("(;GM[1]RO[8 (Final)];B[dp];W[pd]C[hi];B[aa])")
        self.assertEqual(moves, [("black", 3, 15), ("white", 15, 3), ("black", 0, 0)])


class ServerTest(unittest.TestCase):
    def setUp(self):
        self.fake = fake_kgs.FakeKgs(seed=1)
        self.fake.handle("s1", {"type": "LOGIN", "name": "andreas", "password": "x"})
        self.session = self.fake.sessions["s1"]

    def drain(self):
        messages, self.session["queue"] = self.session["queue"], []
        return messages

    def test_login_lists_three_watched_games_and_the_own_game(self):
        self.assertEqual([m["type"] for m in self.drain()], ["HELLO", "LOGIN_SUCCESS", "ROOM_JOIN"])
        self.fake.handle("s1", {"type": "GLOBAL_LIST_JOIN_REQUEST", "list": "ACTIVES"})
        games = self.drain()[0]["games"]
        self.assertEqual(len(games), 4)
        self.assertIn("andreas", [g["players"]["black"]["name"] for g in games])

    def test_own_move_and_users_once(self):
        self.drain()
        self.fake.handle("s1", {"type": "JOIN_REQUEST", "channelId": fake_kgs.OWN_GAME_ID})
        join = self.drain()[0]
        names = [u["name"] for u in join["users"]]
        self.assertEqual(len(names), len(set(names)))
        self.fake.handle("s1", {"type": "GAME_MOVE", "channelId": fake_kgs.OWN_GAME_ID, "loc": {"x": 3, "y": 3}})
        self.assertEqual(self.fake.own.moves, [("black", 3, 3)])
        self.fake._opponent_moves()
        self.assertEqual(len(self.fake.own.moves), 2)

    def test_loads_an_own_game_as_review_and_echoes_changes(self):
        self.drain()
        self.fake.handle("s1", {"type": "JOIN_ARCHIVE_REQUEST", "name": "andreas"})
        games = self.drain()[0]["games"]
        self.assertEqual(len(games), 2)
        self.fake.handle("s1", {"type": "ROOM_LOAD_GAME", "channelId": fake_kgs.ROOM_ID,
                                "timestamp": games[0]["timestamp"], "private": True})
        join, state = self.drain()
        self.assertEqual(join["gameType"], "review")
        self.assertEqual(state["actions"], [{"action": "EDIT", "user": {"name": "andreas"}}])
        review = self.fake.reviews[join["channelId"]]
        last = review.active
        change = [{"type": "CHILD_ADDED", "nodeId": last, "childNodeId": last + 1},
                  {"type": "ACTIVATED", "nodeId": last + 1, "prevNodeId": last},
                  {"type": "PROP_ADDED", "nodeId": last + 1,
                   "prop": {"name": "MOVE", "color": "white", "loc": {"x": 0, "y": 0}}}]
        self.fake.handle("s1", {"type": "KGS_SGF_CHANGE", "channelId": review.id, "sgfEvents": change})
        self.assertEqual(self.drain(), [{"type": "GAME_UPDATE", "channelId": review.id, "sgfEvents": change}])
        # The same node id again: the real KGS would refuse it.
        self.fake.strict = True
        self.fake.handle("s1", {"type": "KGS_SGF_CHANGE", "channelId": review.id, "sgfEvents": change})
        self.assertEqual([m["type"] for m in self.drain()], ["LOGOUT"])

    def test_review_with_the_opponent_after_the_game(self):
        self.drain()
        own = self.fake.own
        self.fake.handle("s1", {"type": "JOIN_REQUEST", "channelId": own.id})
        self.fake.handle("s1", {"type": "GAME_MOVE", "channelId": own.id, "loc": {"x": 3, "y": 3}})
        self.fake.handle("s1", {"type": "GAME_RESIGN", "channelId": own.id})
        self.drain()
        self.fake.handle("s1", {"type": "GAME_START_REVIEW", "channelId": own.id})
        review, state, close = self.drain()
        self.assertEqual((review["type"], review["originalId"]), ("GAME_REVIEW", own.id))
        self.assertEqual(state["actions"][0]["action"], "EDIT")
        self.assertEqual(close, {"type": "CLOSE", "channelId": own.id})
        self.assertNotEqual(self.fake.own.id, own.id)  # a new game to practise on

    def test_warns_where_the_real_kgs_would_log_out(self):
        self.fake.strict = True
        self.drain()
        self.fake.handle("s1", {"type": "UNJOIN_REQUEST", "channelId": 4242})
        self.fake.handle("s1", {"type": "JOIN_REQUEST", "channelId": 4243})
        logouts = [m for m in self.drain() if m["type"] == "LOGOUT"]
        self.assertEqual(len(logouts), 2)
        self.assertIn("Unknown channel 4242", logouts[0]["text"])


if __name__ == "__main__":
    unittest.main()
