"""script_update.py - "Nach Updates suchen" for the script installation.

GoTV installed with desktop/install.sh runs from a git checkout. The local
server (goTV_local.py) offers the settings page two fixed actions:

  check: git fetch, then how many commits the checkout is behind its
         upstream branch (and whether it has own changes).
  run:   git pull --ff-only and sh desktop/install.sh, in the background;
         the page polls the state and reloads when it is done.

Nothing is taken from the request: no branch, path or argument - only these
fixed commands in the GoTV folder. The server answers only 127.0.0.1 with
the local Host/Origin (goTV_local.py) and the update actions need a POST
with the local Origin and the header X-GoTV-Update (wish of the user,
28.11.2026: an update button like the one of the released app).
"""

import os
import subprocess
import threading
import time

FETCH_TIMEOUT = 90
PULL_TIMEOUT = 180
INSTALL_TIMEOUT = 20 * 60
LOG_LINES = 40
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
    def __init__(self, repo_dir, on_restart=None):
        self.repo_dir = repo_dir
        # Called after an update that changed the server or launcher (the
        # server starts itself again; closing the window does not stop it).
        self.on_restart = on_restart
        self.lock = threading.Lock()
        self.state = "idle"  # idle | running | done | failed
        self.error = None
        self.behind = None
        self.dirty = False
        self.restart = False
        self.log = []
        self.finished_at = None

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

    # -- check -----------------------------------------------------------
    def check(self):
        """Fetches and counts the new commits; returns the status."""
        with self.lock:
            if self.state == "running":
                return self.status_unlocked()
        error, behind, dirty = self._inspect()
        with self.lock:
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
        }

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
            count = self._git("rev-list", "--count", "HEAD..@{upstream}")
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
        with self.lock:
            if self.state == "running":
                return self.status_unlocked()
            self.behind = behind
            self.dirty = dirty
            if error or dirty or not behind:
                self.error = error or ("dirty" if dirty else "upToDate")
                return self.status_unlocked()
            self.state = "running"
            self.error = None
            self.restart = False
            self.log = []
        threading.Thread(target=self._run, daemon=True).start()
        return self.status()

    def _run(self):
        try:
            before = self._git("rev-parse", "HEAD").stdout.strip()
            pull = self._git("pull", "--ff-only", timeout=PULL_TIMEOUT)
            with self.lock:
                self._add_log(pull.stdout + pull.stderr)
            if pull.returncode != 0:
                self._finish("pullFailed")
                return
            after = self._git("rev-parse", "HEAD").stdout.strip()
            changed = self._git("diff", "--name-only", before, after, "--", *RESTART_FILES)
            install = subprocess.run(
                ["sh", os.path.join("desktop", "install.sh")],
                cwd=self.repo_dir,
                capture_output=True,
                text=True,
                timeout=INSTALL_TIMEOUT,
                env={**os.environ, "PATH": _tool_path()},
            )
            with self.lock:
                self._add_log(install.stdout + install.stderr)
                self.restart = bool(changed.stdout.strip())
            self._finish(None if install.returncode == 0 else "installFailed")
        except subprocess.TimeoutExpired:
            self._finish("timeout")
        except OSError:
            self._finish("installFailed")

    def _finish(self, error):
        with self.lock:
            self.state = "failed" if error else "done"
            self.error = error
            if not error:
                self.behind = 0
            self.finished_at = time.time()
            restart = not error and self.restart and self.on_restart
        if restart:
            threading.Timer(RESTART_DELAY, self.on_restart).start()
