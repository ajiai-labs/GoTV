"""script_update.py - "Nach Updates suchen" for the script installation.

GoTV installed with desktop/install.sh runs from a git checkout. The local
server (goTV_local.py) offers the settings page two fixed actions:

  check: git fetch, then how many commits the INSTALLED build is behind
         the upstream branch (and whether the checkout has own changes).
         The installed build is the commit install.sh wrote to
         build-desktop/gotv-commit.txt - the GoTV folder itself may be newer
         (it is also where GoTV is developed and pushed from); without that
         file the checkout's HEAD counts.
  run:   git pull --ff-only and sh desktop/install.sh, in the background;
         the page polls the state and reloads when it is done.
  restart: after an update that changed the server or launcher, the
         server starts itself again - only when the page asks, because a
         restart cuts the KGS connection: the page waits until no own game
         runs (user, 28.11.2026: he plays while GoTV updates).

The state names the installed version (HEAD) and the one on GitHub
(upstream), as "git describe" against the release tags desktop-v*, with
commit and date, and while updating the step: pull (download), build
(install.sh 1/4) and install (2/4-4/4) - the page shows them as a bar
(user, 28.11.2026: which version is downloaded, how far it is).

Nothing is taken from the request: no branch, path or argument - only these
fixed commands in the GoTV folder. The server answers only 127.0.0.1 with
the local Host/Origin (goTV_local.py) and the update actions need a POST
with the local Origin and the header X-GoTV-Update (wish of the user,
28.11.2026: an update button like the one of the released app).
"""

import os
import re
import subprocess
import threading
import time

FETCH_TIMEOUT = 90
PULL_TIMEOUT = 180
INSTALL_TIMEOUT = 20 * 60
LOG_LINES = 40
INSTALLED_FILE = "gotv-commit.txt"
CHANGE_LINES = 30
# Files of the running server and launcher: changed -> GoTV must restart.
RESTART_FILES = ("desktop/goTV_local.py", "desktop/script_update.py", "desktop/launch-gotv")


def _tool_path():
    """PATH for git/npm: a desktop launcher often lacks the Nix profile."""
    home = os.path.expanduser("~")
    extra = [
        os.path.join(home, ".nix-profile", "bin"),
        "/nix/var/nix/profiles/default/bin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
    ]
    parts = (os.environ.get("PATH") or "").split(os.pathsep)
    for item in extra:
        if item not in parts:
            parts.append(item)
    return os.pathsep.join(p for p in parts if p)


# After an update that changed the server: how long the page has to read
# "done" before the server starts itself again.
RESTART_DELAY = 2.0


class ScriptUpdater:
    def __init__(self, repo_dir, on_restart=None, build_dir=None):
        self.repo_dir = repo_dir
        self.build_dir = build_dir
        # Called on request after an update that changed the server or
        # launcher (the server starts itself again; closing the window does
        # not stop it).
        self.on_restart = on_restart
        self.restarting = False
        self.lock = threading.Lock()
        self.state = "idle"  # idle | running | done | failed
        self.error = None
        self.behind = None
        self.dirty = False
        self.restart = False
        self.log = []
        self.finished_at = None
        self.current = None  # installed version (HEAD)
        self.target = None  # version on GitHub (upstream)
        self.phase = None  # pull | build | install while running
        self.changes = []  # subjects of the new commits, newest first

    # -- helpers ---------------------------------------------------------
    def _git(self, *args, timeout=30):
        return subprocess.run(
            ["git", *args],
            cwd=self.repo_dir,
            capture_output=True,
            text=True,
            timeout=timeout,
            env={**os.environ, "PATH": _tool_path(), "GIT_TERMINAL_PROMPT": "0"},
        )

    def _add_log(self, text):
        for line in (text or "").splitlines():
            if line.strip():
                self.log.append(line.rstrip())
        del self.log[:-LOG_LINES]

    def status(self):
        with self.lock:
            return self.status_unlocked()

    def _installed(self):
        """The commit of the installed build, or HEAD if unknown."""
        if not self.build_dir:
            return "HEAD"
        try:
            with open(os.path.join(self.build_dir, INSTALLED_FILE), encoding="ascii") as fh:
                commit = fh.read().strip()
        except (OSError, UnicodeDecodeError):
            return "HEAD"
        if not re.fullmatch(r"[0-9a-f]{40}", commit):
            return "HEAD"
        known = self._git("cat-file", "-e", commit + "^{commit}")
        return commit if known.returncode == 0 else "HEAD"

    # -- check -----------------------------------------------------------
    def check(self):
        """Fetches and counts the new commits; returns the status."""
        with self.lock:
            if self.state == "running":
                return self.status_unlocked()
        error, behind, dirty = self._inspect()
        versions = self._versions() if not error else (None, None)
        changes = self._changes() if not error else []
        with self.lock:
            self.current, self.target = versions
            if self.state != "running":
                self.changes = changes
            self.error = error
            self.behind = behind
            self.dirty = dirty
            if self.state != "running":
                self.state = "idle" if not error else "failed"
                self.restart = False
                self.log = []
            return self.status_unlocked()

    def status_unlocked(self):
        return {
            "state": self.state,
            "error": self.error,
            "behind": self.behind,
            "dirty": self.dirty,
            "restart": self.restart,
            "log": list(self.log),
            "current": self.current,
            "target": self.target,
            "phase": self.phase,
            "restarting": self.restarting,
            "changes": list(self.changes),
        }

    def restart_now(self):
        """Starts the server again after an update that needs it (asked by
        the page when no own game runs); returns the state."""
        with self.lock:
            ready = (
                self.state == "done" and self.restart and self.on_restart and not self.restarting
            )
            if ready:
                self.restarting = True
            status = self.status_unlocked()
        if ready:
            threading.Timer(RESTART_DELAY, self.on_restart).start()
        return status

    def _version(self, ref):
        """{describe, commit, date} of a commit, or None."""
        try:
            info = self._git("log", "-1", "--format=%h %cI", ref)
            if info.returncode != 0 or not info.stdout.strip():
                return None
            commit, date = info.stdout.split()[:2]
            describe = self._git("describe", "--tags", "--match", "desktop-v*", "--long", ref)
            return {
                "describe": describe.stdout.strip() if describe.returncode == 0 else None,
                "commit": commit,
                "date": date,
            }
        except (OSError, ValueError, subprocess.TimeoutExpired):
            return None

    def _versions(self):
        return (self._version(self._installed()), self._version("@{upstream}"))

    def _changes(self):
        """Subjects of the commits on GitHub that are not here yet."""
        try:
            log = self._git(
                "log", "--format=%s", "-n", str(CHANGE_LINES), self._installed() + "..@{upstream}"
            )
            if log.returncode != 0:
                return []
            return [line.strip() for line in log.stdout.splitlines() if line.strip()]
        except (OSError, subprocess.TimeoutExpired):
            return []

    def _inspect(self):
        """(error, behind, dirty) of the checkout against its upstream."""
        try:
            if self._git("rev-parse", "--is-inside-work-tree").returncode != 0:
                return ("noGit", None, False)
            if self._git("rev-parse", "--abbrev-ref", "@{upstream}").returncode != 0:
                return ("noUpstream", None, False)
            fetch = self._git("fetch", "--quiet", timeout=FETCH_TIMEOUT)
            if fetch.returncode != 0:
                return ("fetchFailed", None, False)
            count = self._git("rev-list", "--count", self._installed() + "..@{upstream}")
            behind = int(count.stdout.strip() or 0) if count.returncode == 0 else None
            changes = self._git("status", "--porcelain", "--untracked-files=no")
            dirty = bool(changes.stdout.strip())
            return (None, behind, dirty)
        except FileNotFoundError:
            return ("noGit", None, False)
        except subprocess.TimeoutExpired:
            return ("fetchFailed", None, False)

    # -- run -------------------------------------------------------------
    def start(self):
        """Starts pull + install in the background; returns the status."""
        error, behind, dirty = self._inspect()
        versions = self._versions() if not error else (None, None)
        with self.lock:
            if self.state == "running":
                return self.status_unlocked()
            self.current, self.target = versions
            self.behind = behind
            self.dirty = dirty
            if error or dirty or not behind:
                self.error = error or ("dirty" if dirty else "upToDate")
                return self.status_unlocked()
            self.state = "running"
            self.phase = "pull"
            self.error = None
            self.restart = False
            self.log = []
        threading.Thread(target=self._run, daemon=True).start()
        return self.status()

    def _run(self):
        try:
            # Server files changed since what is installed (and running)?
            before = self._git("rev-parse", self._installed()).stdout.strip()
            pull = self._git("pull", "--ff-only", timeout=PULL_TIMEOUT)
            with self.lock:
                self._add_log(pull.stdout + pull.stderr)
            if pull.returncode != 0:
                self._finish("pullFailed")
                return
            after = self._git("rev-parse", "HEAD").stdout.strip()
            changed = self._git("diff", "--name-only", before, after, "--", *RESTART_FILES)
            with self.lock:
                self.phase = "build"
                self.restart = bool(changed.stdout.strip())
            code, timed_out = self._install()
            if timed_out:
                self._finish("timeout")
            else:
                self._finish(None if code == 0 else "installFailed")
        except subprocess.TimeoutExpired:
            self._finish("timeout")
        except OSError:
            self._finish("installFailed")

    def _install(self):
        """Runs install.sh, reading its lines as they come (log and step)."""
        proc = subprocess.Popen(
            ["sh", os.path.join("desktop", "install.sh")],
            cwd=self.repo_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            env={**os.environ, "PATH": _tool_path()},
        )
        timed_out = threading.Event()

        def kill():
            timed_out.set()
            proc.kill()

        killer = threading.Timer(INSTALL_TIMEOUT, kill)
        killer.start()
        try:
            for line in proc.stdout:
                with self.lock:
                    self._add_log(line)
                    # install.sh: "1/4 Production-Build ...", then 2/4 to 4/4.
                    if line.startswith(("2/4", "3/4", "4/4")):
                        self.phase = "install"
            code = proc.wait()
        finally:
            killer.cancel()
        return code, timed_out.is_set()

    def _finish(self, error):
        with self.lock:
            self.state = "failed" if error else "done"
            self.error = error
            self.phase = None
            if not error:
                self.behind = 0
                self.current = self.target
                self.changes = []
            self.finished_at = time.time()
