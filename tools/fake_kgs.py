#!/usr/bin/env python3
"""fake_kgs.py - a practice KGS for trying GoTV without the real server.

Wish of the user (27.11.2026): see what an own game with three games
running beside it looks like - game windows, Brettübersicht, chat sound -
without a real KGS session. NOT part of any app build: a developer tool
only, standard library only, like the other tools.

What it does:
- serves the desktop build (build-desktop/, as desktop/goTV_local.py does)
  and answers /json/access itself, so the app talks to it as to KGS;
- any name logs in (no password check); "Beobachten" lists three running
  games that replay real tournament games, a move every few seconds, and
  your own game against a practice opponent ("Uebungsgegner") who answers
  your moves with random legal ones and now and then writes in the chat;
- watches what GoTV sends: a JOIN_REQUEST or UNJOIN_REQUEST that the real
  KGS would answer with a logout ("Unknown channel N") is printed as a
  warning - with --strict it logs out like KGS does.

Usage (from the repository root, after `sh desktop/install.sh` or a desktop
build in build-desktop/):
    python3 tools/fake_kgs.py [--port 8799] [--build build-desktop] [--strict]
Then open http://127.0.0.1:8799 in a separate browser profile, e.g.
    flatpak run org.chromium.Chromium --app=http://127.0.0.1:8799 \\
        --user-data-dir=$HOME/.local/share/gotv/uebung-profile
"""

import argparse
import itertools
import json
import os
import random
import re
import sys
import threading
import time
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "desktop"))

import goTV_local  # noqa: E402 - the static file server of the desktop app

SIZE = 19
ROOM_ID = 10
ACTIVES_ID = 900
CHALLENGES_ID = 901
OWN_GAME_ID = 2001
WATCH_GAME_IDS = (2101, 2102, 2103)
OPPONENT = {"name": "Uebungsgegner", "rank": "3k", "flags": {"connected": True}}
WATCHED_PLAYERS = (
    ({"name": "Kranich", "rank": "5d"}, {"name": "Tiger", "rank": "5d"}),
    ({"name": "Schiefer", "rank": "3d"}, {"name": "Muschel", "rank": "3d"}),
    ({"name": "Hoshi", "rank": "2d"}, {"name": "Komi", "rank": "2d"}),
)
OPPONENT_LINES = (
    "Bist du noch da?",
    "Schöner Zug!",
    "Hmm, das muss ich mir überlegen.",
    "Viel Glück!",
)
MAIN_TIME = 1200  # seconds per player
MOVE_EVERY = (3.0, 6.0)  # seconds between moves of the watched games
CHAT_EVERY = 60.0  # seconds between lines of the practice opponent
POLL_WAIT = 20.0  # long poll: answer at the latest after this

LOGOUT_TEXT = "Internal error (check webapp logs for stack trace): java.lang.RuntimeException: Unknown channel %d"


# --- Go rules, enough for a practice opponent -----------------------------

def neighbours(x, y):
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < SIZE and 0 <= ny < SIZE:
            yield nx, ny


def group_and_liberties(board, x, y):
    color = board[y][x]
    group, liberties, todo = {(x, y)}, set(), [(x, y)]
    while todo:
        cx, cy = todo.pop()
        for nx, ny in neighbours(cx, cy):
            if board[ny][nx] is None:
                liberties.add((nx, ny))
            elif board[ny][nx] == color and (nx, ny) not in group:
                group.add((nx, ny))
                todo.append((nx, ny))
    return group, liberties


def play(board, color, x, y):
    """The board after `color` plays at (x, y), or None if illegal
    (occupied or suicide). Simple ko is not checked: the practice opponent
    picks random points, the app itself checks the user's moves."""
    if board[y][x] is not None:
        return None
    after = [row[:] for row in board]
    after[y][x] = color
    other = "white" if color == "black" else "black"
    for nx, ny in neighbours(x, y):
        if after[ny][nx] == other:
            group, liberties = group_and_liberties(after, nx, ny)
            if not liberties:
                for gx, gy in group:
                    after[gy][gx] = None
    _, liberties = group_and_liberties(after, x, y)
    if not liberties:
        return None
    return after


def empty_board():
    return [[None] * SIZE for _ in range(SIZE)]


def random_move(board, color, rng):
    points = [(x, y) for y in range(SIZE) for x in range(SIZE) if board[y][x] is None]
    rng.shuffle(points)
    for x, y in points:
        # Not into its own eye: keeps the practice games looking like Go.
        if all(board[ny][nx] == color for nx, ny in neighbours(x, y)):
            continue
        if play(board, color, x, y) is not None:
            return x, y
    return None


# --- SGF of the watched games ----------------------------------------------

MOVE_RE = re.compile(r";\s*([BW])\[([a-s]{2})\]")


def sgf_moves(text):
    """The moves of an SGF game record as [(color, x, y)] - the bundled
    records have no variations, so all B/W moves in order."""
    return [
        ("black" if color == "B" else "white", ord(point[0]) - 97, ord(point[1]) - 97)
        for color, point in MOVE_RE.findall(text)
    ]


# --- The games ---------------------------------------------------------------

class Game:
    def __init__(self, channel_id, white, black, script=None):
        self.id = channel_id
        self.white = dict(white, flags={"connected": True})
        self.black = dict(black, flags={"connected": True})
        self.script = script or []  # moves to replay (watched games)
        self.moves = []  # [(color, x, y)]
        self.comments = {}  # node id -> comment text
        self.board = empty_board()
        self.over = False
        self.score = None
        self.clocks = {"black": MAIN_TIME, "white": MAIN_TIME}
        self.clock_since = time.time()

    @property
    def to_move(self):
        return "black" if len(self.moves) % 2 == 0 else "white"

    def node(self):
        return len(self.moves)

    def players(self):
        return {"white": self.white, "black": self.black}

    def list_entry(self):
        return {
            "channelId": self.id,
            "gameType": "ranked",
            "roomId": ROOM_ID,
            "players": self.players(),
            "moveNum": len(self.moves),
            "size": SIZE,
            "komi": 6.5,
        }

    def tick_clock(self):
        now = time.time()
        self.clocks[self.to_move] = max(0, self.clocks[self.to_move] - (now - self.clock_since))
        self.clock_since = now

    def clocks_message(self):
        return {
            color: {"time": round(left, 1), "running": not self.over and color == self.to_move}
            for color, left in self.clocks.items()
        }

    def add_move(self, color, x, y):
        after = play(self.board, color, x, y)
        if after is None or color != self.to_move or self.over:
            return None
        self.tick_clock()
        self.board = after
        self.moves.append((color, x, y))
        node = self.node()
        return [
            {"type": "CHILD_ADDED", "nodeId": node - 1, "childNodeId": node},
            {"type": "PROP_GROUP_ADDED", "nodeId": node, "props": [{"name": "MOVE", "color": color, "loc": {"x": x, "y": y}}]},
            {"type": "ACTIVATED", "nodeId": node},
        ]

    def add_chat(self, user, text):
        node = self.node()
        line = "%s [%s]: %s\n" % (user["name"], user.get("rank", "?"), text)
        before = self.comments.get(node)
        self.comments[node] = (before or "") + line
        kind = "PROP_CHANGED" if before else "PROP_ADDED"
        return [{"type": kind, "nodeId": node, "prop": {"name": "COMMENT", "text": self.comments[node]}}]

    def all_events(self):
        events = [{
            "type": "PROP_GROUP_ADDED",
            "nodeId": 0,
            "props": [{"name": "RULES", "size": SIZE, "komi": 6.5, "rules": "japanese",
                       "timeSystem": "absolute", "mainTime": MAIN_TIME}],
        }]
        for node, (color, x, y) in enumerate(self.moves, start=1):
            events += [
                {"type": "CHILD_ADDED", "nodeId": node - 1, "childNodeId": node},
                {"type": "PROP_GROUP_ADDED", "nodeId": node, "props": [{"name": "MOVE", "color": color, "loc": {"x": x, "y": y}}]},
            ]
        for node, text in self.comments.items():
            events.append({"type": "PROP_ADDED", "nodeId": node, "prop": {"name": "COMMENT", "text": text}})
        events.append({"type": "ACTIVATED", "nodeId": self.node()})
        return events


class FakeKgs:
    """One practice server: games, sessions and the long-poll queues."""

    def __init__(self, strict=False, seed=None):
        self.strict = strict
        self.rng = random.Random(seed)
        self.lock = threading.Condition()
        self.sessions = {}  # session id -> {"name", "queue", "joined"}
        self.channel_ids = itertools.count(5000)
        self.me = None
        self.own = None
        self.watched = []
        self._load_scripts()

    def _load_scripts(self):
        texts = []
        for name in ("em-finale-2026.sgf", "demo.sgf"):
            path = os.path.join(ROOT, "public", "tv", name)
            try:
                with open(path, encoding="utf-8") as handle:
                    texts.append(sgf_moves(handle.read()))
            except OSError:
                texts.append([])
        main = texts[0] or []
        for index, (white, black) in enumerate(WATCHED_PLAYERS):
            game = Game(WATCH_GAME_IDS[index], white, black, script=list(main))
            # Start the three games at different points of the game.
            for color, x, y in main[: 30 + 40 * index]:
                game.add_move(color, x, y)
            self.watched.append(game)

    def games(self):
        return [game for game in [self.own, *self.watched] if game]

    def game(self, channel_id):
        return next((game for game in self.games() if game.id == channel_id), None)

    # -- sending ------------------------------------------------------------

    def push(self, session, *messages):
        with self.lock:
            session["queue"].extend(messages)
            self.lock.notify_all()

    def broadcast_game(self, game, messages):
        with self.lock:
            for session in self.sessions.values():
                if game.id in session["joined"]:
                    session["queue"].extend(messages)
            self.lock.notify_all()

    def game_state(self, game):
        state = {"type": "GAME_STATE", "channelId": game.id, "clocks": game.clocks_message(),
                 "over": game.over}
        if game.score is not None:
            state["score"] = game.score
        if game is self.own and not game.over:
            mover = game.black if game.to_move == "black" else game.white
            state["actions"] = [{"action": "MOVE", "user": {"name": mover["name"]}}]
        return state

    def game_join(self, game):
        users = [game.white, game.black]
        if self.me and all(user["name"] != self.me["name"] for user in users):
            users.append(self.me)
        join = {"type": "GAME_JOIN", "channelId": game.id, "gameType": "ranked", "roomId": ROOM_ID,
                "players": game.players(), "users": users, "sgfEvents": game.all_events()}
        return [join, self.game_state(game)]

    # -- requests from GoTV ---------------------------------------------------

    def warn(self, session, text, channel_id):
        print("WARNUNG: %s (Kanal %s) - der echte KGS würde hier abmelden." % (text, channel_id), flush=True)
        if self.strict:
            self.push(session, {"type": "LOGOUT", "text": LOGOUT_TEXT % channel_id})

    def handle(self, session_id, message):
        with self.lock:  # one request at a time against the games
            return self._handle(session_id, message)

    def _handle(self, session_id, message):
        kind = message.get("type")
        session = self.sessions.get(session_id)
        if kind == "LOGIN":
            return self.login(session_id, message)
        if session is None:
            return False
        channel_id = message.get("channelId")
        if kind == "LOGOUT":
            self.push(session, {"type": "LOGOUT"})
        elif kind == "GLOBAL_LIST_JOIN_REQUEST":
            if message.get("list") == "ACTIVES":
                session["joined"].add(ACTIVES_ID)
                self.push(session, {"type": "GLOBAL_GAMES_JOIN", "channelId": ACTIVES_ID,
                                    "containerType": "ACTIVES",
                                    "games": [game.list_entry() for game in self.games()]})
            else:
                session["joined"].add(CHALLENGES_ID)
                self.push(session, {"type": "GLOBAL_GAMES_JOIN", "channelId": CHALLENGES_ID,
                                    "containerType": "CHALLENGES", "games": []})
        elif kind == "JOIN_REQUEST":
            game = self.game(channel_id)
            if channel_id == ROOM_ID:
                session["joined"].add(ROOM_ID)
                self.push(session, {"type": "ROOM_JOIN", "channelId": ROOM_ID, "users": [self.me],
                                    "games": [game.list_entry() for game in self.games()]})
            elif game is None:
                self.warn(session, "JOIN_REQUEST für einen unbekannten Kanal", channel_id)
            elif channel_id in session["joined"]:
                self.warn(session, "JOIN_REQUEST für einen schon beigetretenen Kanal", channel_id)
            else:
                session["joined"].add(channel_id)
                self.push(session, *self.game_join(game))
        elif kind == "UNJOIN_REQUEST":
            if channel_id not in session["joined"]:
                self.warn(session, "UNJOIN_REQUEST für einen Kanal, in dem GoTV nicht ist", channel_id)
            else:
                session["joined"].discard(channel_id)
                self.push(session, {"type": "UNJOIN", "channelId": channel_id})
        elif kind == "GAME_MOVE" and self.own and channel_id == self.own.id:
            loc = message.get("loc")
            if isinstance(loc, dict):
                events = self.own.add_move("black", loc["x"], loc["y"])
                if events:
                    self.broadcast_game(self.own, [{"type": "GAME_UPDATE", "channelId": self.own.id,
                                                    "sgfEvents": events}, self.game_state(self.own)])
                    threading.Timer(self.rng.uniform(1.5, 4.0), self.opponent_moves).start()
        elif kind == "CHAT" and self.game(channel_id):
            game = self.game(channel_id)
            self.broadcast_game(game, [{"type": "GAME_UPDATE", "channelId": game.id,
                                        "sgfEvents": game.add_chat(self.me, message.get("text", ""))}])
        elif kind == "DETAILS_JOIN_REQUEST":
            name = message.get("name", "")
            user = next((p for g in self.games() for p in (g.white, g.black) if p["name"].lower() == name.lower()),
                        {"name": name, "rank": "?", "flags": {"connected": True}})
            details_id = next(self.channel_ids)
            session["joined"].add(details_id)
            self.push(session, {"type": "DETAILS_JOIN", "channelId": details_id, "user": user,
                                "personalName": "", "personalInfo": "Spieler auf dem Übungs-Server.",
                                "regStartDate": "2020-01-01T00:00:00.000Z",
                                "lastOn": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
                                "locale": "de_DE"})
        elif kind == "JOIN_ARCHIVE_REQUEST":
            archive_id = next(self.channel_ids)
            session["joined"].add(archive_id)
            self.push(session, {"type": "ARCHIVE_JOIN", "channelId": archive_id,
                                "user": {"name": message.get("name", ""), "rank": "?", "flags": {}},
                                "games": []})
        return True

    def login(self, session_id, message):
        name = (message.get("name") or "gast").strip()[:10] or "gast"
        self.me = {"name": name, "rank": "1k", "flags": {"connected": True}}
        if self.own is None:
            self.own = Game(OWN_GAME_ID, OPPONENT, {"name": name, "rank": "1k"})
            self.own.white = dict(OPPONENT)
        session = {"name": name, "queue": [], "joined": set()}
        self.sessions[session_id] = session
        self.push(session, {"type": "HELLO"}, {
            "type": "LOGIN_SUCCESS", "you": self.me,
            "rooms": [{"channelId": ROOM_ID, "name": "Übungsraum", "category": "MAIN"}],
            "friends": [],
        })
        print("Angemeldet: %s" % name, flush=True)
        return True

    # -- the practice opponent and the watched games ----------------------------

    def opponent_moves(self):
        with self.lock:
            self._opponent_moves()

    def _opponent_moves(self):
        game = self.own
        if game is None or game.over or game.to_move != "white":
            return
        point = random_move(game.board, "white", self.rng)
        if point is None:
            return
        events = game.add_move("white", *point)
        if events:
            self.broadcast_game(game, [{"type": "GAME_UPDATE", "channelId": game.id, "sgfEvents": events},
                                       self.game_state(game)])

    def run_watched(self, stop):
        next_move = {game.id: time.time() + self.rng.uniform(*MOVE_EVERY) for game in self.watched}
        next_chat = time.time() + CHAT_EVERY
        while not stop.is_set():
            with self.lock:
                self._step_watched(next_move)
                if self.own and time.time() >= next_chat:
                    next_chat = time.time() + CHAT_EVERY
                    events = self.own.add_chat(OPPONENT, self.rng.choice(OPPONENT_LINES))
                    self.broadcast_game(self.own, [{"type": "GAME_UPDATE", "channelId": self.own.id,
                                                    "sgfEvents": events}])
            stop.wait(0.5)

    def _step_watched(self, next_move):
        now = time.time()
        for game in self.watched:
            if game.over or now < next_move[game.id]:
                continue
            next_move[game.id] = now + self.rng.uniform(*MOVE_EVERY)
            move = game.script[len(game.moves)] if len(game.moves) < len(game.script) else None
            events = game.add_move(*move) if move else None
            if not events:  # the game is over (or the record ran out)
                game.over = True
                game.score = "W+RESIGN"
                self.broadcast_game(game, [self.game_state(game)])
                continue
            self.broadcast_game(game, [{"type": "GAME_UPDATE", "channelId": game.id,
                                        "sgfEvents": events}, self.game_state(game)])

    def poll(self, session_id):
        deadline = time.time() + POLL_WAIT
        with self.lock:
            session = self.sessions.get(session_id)
            if session is None:
                return None
            while not session["queue"] and time.time() < deadline:
                self.lock.wait(max(0.1, deadline - time.time()))
            messages, session["queue"] = session["queue"], []
            return messages


class FakeKgsHandler(goTV_local.GoTvHandler):
    server_version = "GoTvUebung/1.0"
    fake = None  # FakeKgs, set in main()

    def _session_id(self):
        match = re.search(r"JSESSIONID=([A-Za-z0-9-]+)", self.headers.get("Cookie") or "")
        return match.group(1) if match else None

    def _json(self, status, payload, cookie=None):
        body = json.dumps(payload).encode("utf-8") if payload is not None else b""
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        if cookie:
            self.send_header("Set-Cookie", "JSESSIONID=%s; Path=/json; HttpOnly" % cookie)
        self.end_headers()
        self.wfile.write(body)

    def _proxy_request(self, method):  # the KGS API, answered here
        session_id = self._session_id()
        if method == "POST":
            length = int(self.headers.get("Content-Length") or 0)
            try:
                message = json.loads(self.rfile.read(length) or b"{}")
            except ValueError:
                self._json(400, None)
                return
            new_cookie = None
            if message.get("type") == "LOGIN":
                session_id = new_cookie = str(uuid.uuid4())
            if not self.fake.handle(session_id, message):
                self._json(401, None)  # not logged in: like KGS (no client)
                return
            self._json(200, None, cookie=new_cookie)
        elif method == "GET":
            messages = self.fake.poll(session_id)
            if messages is None:
                self._json(401, None)
                return
            self._json(200, {"messages": messages})
        else:
            self._json(200, None)

    def log_message(self, format, *args):  # noqa: A002 - only the warnings matter
        pass


def main(argv=None):
    parser = argparse.ArgumentParser(description="Practice KGS for trying GoTV (developer tool).")
    parser.add_argument("--port", type=int, default=8799)
    parser.add_argument("--build", default=os.path.join(ROOT, "build-desktop"))
    parser.add_argument("--strict", action="store_true",
                        help="log out like the real KGS on a request for an unknown channel")
    args = parser.parse_args(argv)
    if not os.path.isfile(os.path.join(args.build, "index.html")):
        print("Kein Build in %s - erst `sh desktop/install.sh` ausführen." % args.build, file=sys.stderr)
        return 1
    fake = FakeKgs(strict=args.strict)
    FakeKgsHandler.fake = fake
    FakeKgsHandler.build_dir = os.path.abspath(args.build)
    stop = threading.Event()
    threading.Thread(target=fake.run_watched, args=(stop,), daemon=True).start()
    server = goTV_local.ThreadingServer(("127.0.0.1", args.port), FakeKgsHandler)
    print("Übungs-KGS läuft auf http://127.0.0.1:%d (Strg+C beendet)" % args.port, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
