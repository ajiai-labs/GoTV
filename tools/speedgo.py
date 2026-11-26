"""Speed Go Championship importer (--source speedgo of update_events.py).

Reads the public bracket page https://speedgochampionship.com/bracket once a
day (robots.txt checked 23.11.2026: only Cloudflare's content-signal
comments, no rules) and keeps the calendar in step with it:

* An upcoming match with a date ("Sunday · 29. 11. 6pm CET") becomes a
  calendar entry (source "speedgo") on the EGF Twitch channel, where the
  championship is broadcast.
* A played match lists its OGS games ("online-go: G1 G2 G3") but no date
  any more. Those game numbers go to the existing entry of the same two
  players - an imported one or one entered by hand - as ogs_game_ids, if it
  has none yet. Nothing else of a hand entry is touched.
* An upcoming match gets the OGS accounts of its players as ogs_players, so
  the app finds the board itself while the match is played. The page names
  the players, not their OGS accounts: those come from OGS_ACCOUNTS (taken
  from earlier games of the championship) and from the games of played
  matches on the current page (one OGS request per match whose accounts are
  not known yet). A player without a known account is left out, never
  guessed; with no known player the entry stays stream only.

Results ("3 : 0") are deliberately not imported: the calendar must not
spoil games people still want to watch. Standard library only, like
update_events.py.
"""
import datetime
import html
import json
import re
import time
import unicodedata
import urllib.request

SPEEDGO_SOURCE = "speedgo"
SPEEDGO_URL = "https://speedgochampionship.com/bracket"
SPEEDGO_USER_AGENT = (
    "shinkgs-go-tv-speedgo-importer/1.0 (+https://github.com/ajiai-labs/GoTV)"
)
# Played matches leave the page's dates; their entries stay this long for
# the replay lists (REPLAY_KEEP_DAYS in app/src/lib/model/tv.ts is 90).
SPEEDGO_RETENTION_DAYS = 120
OGS_GAME_API = "https://online-go.com/api/v1/games/%d"
# Pause between OGS requests (OGS answers bursts with 429).
OGS_REQUEST_PAUSE_SECONDS = 1.0
STREAM_URL = "https://www.twitch.tv/europeangofederation"
STREAM_CHANNEL = {"platform": "twitch", "id": "europeangofederation"}
DURATION_MINUTES = 180

# Column of the bracket grid -> round, as the page lays it out (verified
# 23.11.2026): matches in grid-column 1/3/5/7, connectors in between.
ROUNDS = {1: "Achtelfinale", 3: "Viertelfinale", 5: "Halbfinale", 7: "Finale"}
SMALL_FINAL = "Spiel um Platz 3"

_COLUMN_RE = re.compile(r'class="tree-col tree-col-matches"\s+style="grid-column:(\d+)"')
_MATCH_RE = re.compile(r'<div class="tree-match-wrap">', re.S)
_NAME_RE = re.compile(r'<span class="tree-slot-name">([^<]*)</span>')
_RANK_RE = re.compile(r'<span class="tree-slot-rank">([^<]*)</span>')
_WHEN_RE = re.compile(r'<p class="tree-match-when">([^<]*)</p>')
_OGS_RE = re.compile(r'href="https://online-go\.com/game/(\d+)"')
_SEASON_RE = re.compile(
    r"(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s*(?:–|-|&#x2013;|&ndash;)\s*"
    r"(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})"
)
# "Sunday · 20. 12. 6pm CET", "Tuesday · 1. 12. 6:30pm CET"
_WHEN_PARTS_RE = re.compile(
    r"(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(CET|CEST)",
    re.I,
)
_TZ = {"CET": "+01:00", "CEST": "+02:00"}

# OGS account of each player, read from the OGS games linked on the bracket
# pages (speedgochampionship.com/bracket and /past/2025, checked 26.11.2026):
# in every match the two accounts of its games, one of them already known
# from another match. Players switch accounts between seasons (Jabarin:
# AliJabarin -> Avtikh, Kachanovskyi: kachanovskyi.artem -> artem92), so a
# game of the running season overrides this list (learn_ogs_accounts).
OGS_ACCOUNTS = {
    "Ali Jabarin": "Avtikh",
    "Andrii Kravets": "AndriiKravets",
    "Artem Kachanovskyi": "artem92",
    "Benjamin Dréan-Guénaïzia": "ben0",
    "Lukáš Podpěra": "Lukan",
    "Mateusz Surma": "mateusz.surma1995",
    "Rémi Campagnie": "RemiC",
    "Stanisław Frejlak": "Siasio",
    "Tanguy Le Calvé": "Welvang",
    "Valerii Krushelnytskyi": "Valerii K",
    "Vsevolod Ovsiienko": "OvsiienkoVsevolod",
}


def _season(html_text):
    """(start_date, end_date) of the season named in the page header, e.g.
    "1. 11. 2026 – 21. 2. 2027"; None if the page has no such line."""
    m = _SEASON_RE.search(html.unescape(html_text))
    if not m:
        return None
    d1, m1, y1, d2, m2, y2 = (int(v) for v in m.groups())
    return datetime.date(y1, m1, d1), datetime.date(y2, m2, d2)


def parse_when(text, season):
    """'Sunday · 29. 11. 6pm CET' -> '2026-11-29T18:00:00+01:00'. The year
    comes from the season, which runs across New Year. None when the text
    does not have this shape (never guessed)."""
    m = _WHEN_PARTS_RE.search(html.unescape(text))
    if not m or not season:
        return None
    day, month, hour, minute, ampm, tz = m.groups()
    day, month, hour = int(day), int(month), int(hour)
    hour = hour % 12 + (12 if ampm.lower() == "pm" else 0)
    start, end = season
    # A season across New Year: months before its first month are next year.
    year = end.year if start.year != end.year and month < start.month else start.year
    try:
        datetime.date(year, month, day)
    except ValueError:
        return None
    return "%04d-%02d-%02dT%02d:%02d:00%s" % (
        year,
        month,
        day,
        hour,
        int(minute or 0),
        _TZ[tz.upper()],
    )


def parse_bracket_html(html_text):
    """All matches with two known players: {"round", "players": [(name,
    rank), (name, rank)], "start": iso or None, "ogs_game_ids": [...]}.
    Placeholders ("TBD") are skipped."""
    season = _season(html_text)
    small_final_at = html_text.find(">Small Final<")
    columns = [(m.start(), int(m.group(1))) for m in _COLUMN_RE.finditer(html_text)]
    starts = [m.start() for m in _MATCH_RE.finditer(html_text)]
    matches = []
    for index, start in enumerate(starts):
        end = starts[index + 1] if index + 1 < len(starts) else len(html_text)
        block = html_text[start:end]
        names = [html.unescape(n).strip() for n in _NAME_RE.findall(block)]
        ranks = [html.unescape(r).strip() for r in _RANK_RE.findall(block)]
        if len(names) < 2 or "TBD" in names[:2] or not all(names[:2]):
            continue
        if small_final_at != -1 and start > small_final_at:
            round_name = SMALL_FINAL
        else:
            column = None
            for col_start, col in columns:
                if col_start < start:
                    column = col
            round_name = ROUNDS.get(column, "")
        when = _WHEN_RE.search(block)
        ogs_ids = []
        for game_id in _OGS_RE.findall(block):
            if int(game_id) not in ogs_ids:
                ogs_ids.append(int(game_id))
        matches.append(
            {
                "round": round_name,
                "players": [
                    (names[0], ranks[0] if len(ranks) > 0 else ""),
                    (names[1], ranks[1] if len(ranks) > 1 else ""),
                ],
                "start": parse_when(when.group(1), season) if when else None,
                "ogs_game_ids": ogs_ids,
            }
        )
    return matches


def _fold(text):
    """Lower case without accents: "Le Calvé" -> "le calve"."""
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(c for c in normalized if not unicodedata.combining(c)).lower()


def _surname(name):
    return _fold(name.split()[-1]) if name.split() else ""


def _slug(text):
    return re.sub(r"[^a-z0-9]+", "-", _fold(text)).strip("-")


def _account_key(name):
    return " ".join(_fold(name).split())


def learn_ogs_accounts(matches, fetch_game_players, known=None):
    """OGS accounts by player (folded name -> username): `known` (default
    OGS_ACCOUNTS) plus what the played matches of the current page show.
    fetch_game_players(game_id) -> [black, white] usernames; called once per
    played match that is not fully known yet. A match teaches an account
    only when one of its two accounts belongs to a known player of it - the
    other player then has the other one. None as fetcher: no requests."""
    accounts = {
        _account_key(name): user for name, user in (OGS_ACCOUNTS if known is None else known).items()
    }
    if fetch_game_players is None:
        return accounts
    # One request per played match, then resolve until nothing new is learned:
    # the order of the matches on the page must not decide what is learned.
    pairs = []
    for match in matches:
        if not match["ogs_game_ids"]:
            continue
        keys = [_account_key(name) for name, _rank in match["players"]]
        try:
            users = [u for u in fetch_game_players(match["ogs_game_ids"][0]) if u]
        except (OSError, ValueError, KeyError, TypeError):
            continue
        if len(set(users)) == 2:
            pairs.append((keys, users))
    learned = set()
    changed = True
    while changed:
        changed = False
        for keys, users in pairs:
            if all(key in learned for key in keys):
                continue
            a, b = keys
            if accounts.get(a) in users:
                first, second = a, b
            elif accounts.get(b) in users:
                first, second = b, a
            else:
                continue  # neither account known (yet): maybe after another pass
            accounts[second] = next(u for u in users if u != accounts[first])
            learned.update((first, second))
            changed = True
    return accounts


def ogs_players_for(match, accounts):
    """The known OGS accounts of a match's players, in page order."""
    users = [accounts.get(_account_key(name)) for name, _rank in match["players"]]
    return [user for user in users if user]


def match_to_tv_event(match, accounts=None):
    """A dated match as a calendar entry (source "speedgo")."""
    (name_a, rank_a), (name_b, rank_b) = match["players"]
    date = match["start"][:10]
    tv_event = {
        "id": "speedgo-%s-%s-%s" % (date, _slug(_surname(name_a)), _slug(_surname(name_b))),
        "name": "Speed Go Championship: %s %s – %s %s"
        % (name_a, rank_a, name_b, rank_b),
        "date_start": date,
        "start": match["start"],
        "duration_minutes": DURATION_MINUTES,
        "platform": "twitch",
        "stream_url": STREAM_URL,
        "channel": dict(STREAM_CHANNEL),
        "region": "intl",
        "notes": (match["round"] + ", " if match["round"] else "")
        + "Best of five. Die Partien laufen auf online-go.com (OGS).",
        "source": SPEEDGO_SOURCE,
    }
    if match["ogs_game_ids"]:
        tv_event["ogs_game_ids"] = list(match["ogs_game_ids"])
    players = ogs_players_for(match, accounts or {})
    if players:
        tv_event["ogs_players"] = players
    return tv_event


def _is_same_pairing(event, match):
    """An entry of the championship between the same two players (by
    surname, accents ignored) - hand entries name them like the page."""
    name = _fold(event.get("name", ""))
    if "speed go" not in name:
        return False
    return all(_surname(player) in name for player, _rank in match["players"])


def _source_rank(event):
    """Same order as getSourceRank in app/src/lib/model/tv.ts: the entry the app
    shows for a broadcast is the one that should carry the games."""
    if not event.get("source"):
        return 0
    return 1 if event.get("source") == SPEEDGO_SOURCE else 2


def _entry_for(events, match, same_day=False):
    """Index of the entry that should carry a match's boards, or None.
    same_day: only an entry on the match's date (an upcoming match must not
    give its accounts to an older entry of the same pairing)."""
    day = (match.get("start") or "")[:10]
    candidates = sorted(
        (
            index
            for index, event in enumerate(events)
            if _is_same_pairing(event, match)
            and (not same_day or event.get("date_start") == day)
        ),
        key=lambda index: _source_rank(events[index]),
    )
    return candidates[0] if candidates else None


def enrich_with_players(events, matches, accounts):
    """Adds ogs_players to the entry of each upcoming (dated) match that has
    no OGS link yet, so the app finds the board while the match is played.
    Returns (events, enriched_entries); entries are copied."""
    result = list(events)
    enriched = []
    for match in matches:
        if not match["start"] or match["ogs_game_ids"]:
            continue
        players = ogs_players_for(match, accounts)
        index = _entry_for(result, match, same_day=True)
        if not players or index is None:
            continue
        event = result[index]
        if event.get("ogs_players") or event.get("ogs_game_ids") or event.get("ogs_game_id"):
            continue
        updated = dict(event, ogs_players=players)
        result[index] = updated
        enriched.append(updated)
    return result, enriched


def enrich_with_games(events, matches):
    """Adds the OGS game numbers of played matches to the entry of the same
    pairing - a hand entry first, then a Speed Go import, then any other
    import - if that entry has none yet. Returns (events, enriched_entries);
    entries are copied, never changed in place."""
    result = list(events)
    enriched = []
    for match in matches:
        if not match["ogs_game_ids"]:
            continue
        index = _entry_for(result, match)
        if index is None:
            continue
        event = result[index]
        if event.get("ogs_game_ids") or event.get("ogs_game_id"):
            continue  # already linked (by hand or an earlier run)
        updated = dict(event, ogs_game_ids=list(match["ogs_game_ids"]))
        result[index] = updated
        enriched.append(updated)
    return result, enriched


def fresh_events(matches, existing_events, accounts=None):
    """Calendar entries for dated matches, minus pairings someone already
    entered by hand on that day (the hand entry wins, as in
    dropImportedDuplicates). Other imports do not count: against the Twitch
    schedule the app itself prefers this entry (getSourceRank)."""
    hand = [e for e in existing_events if not e.get("source")]
    fresh = []
    for match in matches:
        if not match["start"]:
            continue
        tv_event = match_to_tv_event(match, accounts)
        if any(
            e.get("date_start") == tv_event["date_start"] and _is_same_pairing(e, match)
            for e in hand
        ):
            continue
        fresh.append(tv_event)
    return fresh


def fetch_bracket_html(timeout=20):
    request = urllib.request.Request(
        SPEEDGO_URL, headers={"User-Agent": SPEEDGO_USER_AGENT}
    )
    with urllib.request.urlopen(request, timeout=timeout) as res:
        return res.read().decode("utf-8")


def fetch_ogs_game_players(game_id, timeout=20):
    """[black, white] usernames of an OGS game (public REST API), with a
    pause before each request."""
    time.sleep(OGS_REQUEST_PAUSE_SECONDS)
    request = urllib.request.Request(
        OGS_GAME_API % game_id, headers={"User-Agent": SPEEDGO_USER_AGENT}
    )
    with urllib.request.urlopen(request, timeout=timeout) as res:
        game = json.loads(res.read().decode("utf-8"))
    players = game.get("players") or {}
    return [(players.get(color) or {}).get("username") for color in ("black", "white")]
