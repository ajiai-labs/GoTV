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
        self.assertEqual([m["type"] for m in self.drain()], ["HELLO", "LOGIN_SUCCESS"])
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
