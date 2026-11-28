"""kgs_log.py - a protocol of what GoTV and KGS send each other.

Wish of the user (28.11.2026), after KGS ended a session with "Unknown
channel 109735821" and nothing said which request it was: the local server
(goTV_local.py) writes every request to KGS and every answer from it as one
short line to ~/.local/share/gotv/kgs-protocol.log.

Only what tells what happened: the message type, the channel, a few plain
fields (game, list, user name of a profile/archive request, callback key).
Never a password; of chat lines, messages, notes and profile texts only the
length. The file stays on this computer; at 5 MB it moves to .1 (one old
file kept).
"""

import json
import os
import threading
import time

MAX_BYTES = 5 * 1024 * 1024
# Plain fields worth keeping (no free text, no password).
KEEP = ("channelId", "gameId", "list", "name", "callbackKey", "friendType", "originalId")
# Free text: only its length.
TEXTS = ("text", "personalInfo", "personalName", "personalEmail", "description")
# What KGS says when it ends a session or refuses something: kept in full.
SAY_ALL = ("LOGOUT", "LOGIN_FAILED_BAD_PASSWORD", "LOGIN_FAILED_NO_SUCH_USER", "IDLE_WARNING")


def _fields(message):
    parts = []
    for key in KEEP:
        if key in message and isinstance(message[key], (int, str, bool)):
            parts.append("%s=%s" % (key, message[key]))
    for key in TEXTS:
        if isinstance(message.get(key), str):
            parts.append("%s=<%d Zeichen>" % (key, len(message[key])))
    return parts


def summarize_request(body):
    """One line for a request GoTV sends (a JSON object)."""
    try:
        message = json.loads(body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError, AttributeError):
        return "?? kein JSON (%d Bytes)" % len(body or b"")
    if not isinstance(message, dict):
        return "?? kein Objekt"
    return " ".join([str(message.get("type", "?"))] + _fields(message))


def summarize_response(body):
    """The messages of an answer from KGS, one short entry each."""
    try:
        data = json.loads(body.decode("utf-8")) if body else {}
    except (ValueError, UnicodeDecodeError):
        return ["?? keine JSON-Antwort (%d Bytes)" % len(body)]
    messages = data.get("messages") if isinstance(data, dict) else None
    if not isinstance(messages, list):
        return []
    entries = []
    for message in messages:
        if not isinstance(message, dict):
            continue
        kind = str(message.get("type", "?"))
        entry = kind
        if isinstance(message.get("channelId"), int):
            entry += "@%d" % message["channelId"]
        if kind in SAY_ALL and isinstance(message.get("text"), str):
            entry += " [%s]" % message["text"][:300]
        entries.append(entry)
    return entries


class ProtocolLog:
    def __init__(self, path, max_bytes=MAX_BYTES):
        self.path = path
        self.max_bytes = max_bytes
        self.lock = threading.Lock()

    def write(self, line):
        stamp = time.strftime("%Y-%m-%d %H:%M:%S")
        text = "%s %s\n" % (stamp, line)
        with self.lock:
            try:
                os.makedirs(os.path.dirname(self.path), exist_ok=True)
                if os.path.exists(self.path) and os.path.getsize(self.path) > self.max_bytes:
                    os.replace(self.path, self.path + ".1")
                with open(self.path, "a", encoding="utf-8") as handle:
                    handle.write(text)
            except OSError:
                pass  # a full disk must not break the connection

    def request(self, method, body, status, response_body):
        """A POST (GoTV -> KGS) or a GET (the answers KGS had waiting)."""
        if method == "POST":
            self.write("-> %s  [HTTP %s]" % (summarize_request(body), status))
        entries = summarize_response(response_body)
        if entries:
            self.write("<- " + ", ".join(entries))
        elif method == "GET" and status != 200:
            self.write("<- HTTP %s" % status)

    def error(self, method, body, err):
        what = summarize_request(body) if method == "POST" else "Abruf"
        self.write("!! %s: Verbindung zu KGS fehlgeschlagen (%s)" % (what, err))


def default_path():
    base = os.environ.get("XDG_DATA_HOME") or os.path.join(os.path.expanduser("~"), ".local", "share")
    return os.path.join(base, "gotv", "kgs-protocol.log")
