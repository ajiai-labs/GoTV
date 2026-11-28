"""Tests for the update button of the script installation
(desktop/script_update.py, desktop/goTV_local.py)."""

import http.client
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest

DESKTOP = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "desktop")
sys.path.insert(0, DESKTOP)

import goTV_local  # noqa: E402
from script_update import ScriptUpdater  # noqa: E402

INSTALL = "echo installiert > installed.txt\n"


def git(cwd, *args):
    subprocess.run(
        ["git", "-c", "user.name=t", "-c", "user.email=t@example.org", *args],
        cwd=cwd,
        check=True,
        capture_output=True,
    )


class Repos:
    """A bare origin, the installed checkout and a second clone to push from."""

    def __init__(self, install=INSTALL):
        self.tmp = tempfile.TemporaryDirectory()
        base = self.tmp.name
        self.origin = os.path.join(base, "origin.git")
        self.work = os.path.join(base, "work")
        self.other = os.path.join(base, "other")
        git(base, "init", "--bare", "-b", "master", self.origin)
        git(base, "clone", self.origin, self.other)
        os.makedirs(os.path.join(self.other, "desktop"))
        self.write(self.other, "desktop/install.sh", install)
        self.write(self.other, "README", "eins\n")
        git(self.other, "add", ".")
        git(self.other, "commit", "-m", "eins")
        git(self.other, "push", "origin", "HEAD:master")
        git(base, "clone", self.origin, self.work)

    def write(self, repo, name, text):
        with open(os.path.join(repo, name), "w") as fh:
            fh.write(text)

    def push_new(self, name="README", text="zwei\n"):
        self.write(self.other, name, text)
        git(self.other, "commit", "-am", "zwei")
        git(self.other, "push", "origin", "HEAD:master")

    def cleanup(self):
        self.tmp.cleanup()


def wait_done(updater, seconds=20):
    end = time.time() + seconds
    while time.time() < end:
        if updater.status()["state"] != "running":
            return updater.status()
        time.sleep(0.05)
    raise AssertionError("update did not finish")


class UpdaterTest(unittest.TestCase):
    def setUp(self):
        self.repos = Repos()
        self.addCleanup(self.repos.cleanup)
        self.updater = ScriptUpdater(self.repos.work)

    def test_up_to_date(self):
        status = self.updater.check()
        self.assertIsNone(status["error"])
        self.assertEqual(status["behind"], 0)
        self.assertEqual(self.updater.start()["error"], "upToDate")

    def test_pulls_and_installs_new_commits(self):
        self.repos.push_new()
        self.assertEqual(self.updater.check()["behind"], 1)
        self.assertEqual(self.updater.start()["state"], "running")
        status = wait_done(self.updater)
        self.assertEqual(status["state"], "done")
        self.assertFalse(status["restart"])
        self.assertIsNone(self.updater.on_restart)
        with open(os.path.join(self.repos.work, "README")) as fh:
            self.assertEqual(fh.read(), "zwei\n")
        self.assertTrue(os.path.isfile(os.path.join(self.repos.work, "installed.txt")))

    def test_names_the_installed_and_the_new_version(self):
        git(self.repos.other, "tag", "desktop-v0.4.1")
        git(self.repos.other, "push", "origin", "desktop-v0.4.1")
        git(self.repos.work, "fetch", "--tags")
        self.repos.push_new()
        status = self.updater.check()
        self.assertEqual(status["current"]["describe"].rsplit("-", 1)[0], "desktop-v0.4.1-0")
        self.assertEqual(status["target"]["describe"].rsplit("-", 1)[0], "desktop-v0.4.1-1")
        self.assertRegex(status["target"]["commit"], r"^[0-9a-f]{7,}$")
        self.assertRegex(status["target"]["date"], r"^\d{4}-\d\d-\d\dT")
        self.assertIsNone(status["phase"])
        self.updater.start()
        status = wait_done(self.updater)
        self.assertEqual(status["current"], status["target"])
        self.assertIsNone(status["phase"])

    def test_names_the_new_changes(self):
        self.repos.push_new()
        self.repos.push_new("README", "drei\n")
        self.assertEqual(self.updater.check()["changes"], ["zwei", "zwei"])
        self.updater.start()
        self.assertEqual(wait_done(self.updater)["changes"], [])

    def test_steps_while_updating(self):
        # install.sh prints its steps; the state follows them.
        self.repos.push_new(
            "desktop/install.sh",
            "echo '1/4 Build'\nsleep 0.6\necho '2/4 Launcher'\nsleep 0.6\necho '4/4 Fertig.'\n",
        )
        self.updater.check()
        self.updater.start()
        seen = set()
        end = time.time() + 20
        while time.time() < end:
            status = self.updater.status()
            if status["state"] != "running":
                break
            seen.add(status["phase"])
            time.sleep(0.05)
        self.assertIn("build", seen)
        self.assertIn("install", seen)
        self.assertEqual(self.updater.status()["state"], "done")
        self.assertIn("4/4 Fertig.", self.updater.status()["log"])

    def test_asks_for_a_restart_when_the_server_changed(self):
        restarted = threading.Event()
        self.updater.on_restart = restarted.set
        self.repos.write(self.repos.other, "desktop/goTV_local.py", "# neu\n")
        git(self.repos.other, "add", ".")
        git(self.repos.other, "commit", "-m", "server")
        git(self.repos.other, "push", "origin", "HEAD:master")
        self.updater.start()
        self.assertTrue(wait_done(self.updater)["restart"])
        # Not by itself: a restart cuts the KGS connection, the page asks
        # for it when no own game runs.
        self.assertFalse(restarted.wait(3))
        self.assertTrue(self.updater.restart_now()["restarting"])
        self.assertTrue(restarted.wait(5))

    def test_restarts_only_after_an_update_that_needs_it(self):
        restarted = threading.Event()
        self.updater.on_restart = restarted.set
        self.assertFalse(self.updater.restart_now()["restarting"])
        self.repos.push_new()
        self.updater.start()
        wait_done(self.updater)
        self.assertFalse(self.updater.restart_now()["restarting"])
        self.assertFalse(restarted.wait(3))

    def test_leaves_own_changes_alone(self):
        self.repos.push_new()
        self.repos.write(self.repos.work, "README", "eigene Änderung\n")
        status = self.updater.start()
        self.assertEqual(status["error"], "dirty")
        self.assertEqual(status["state"], "idle")
        with open(os.path.join(self.repos.work, "README")) as fh:
            self.assertEqual(fh.read(), "eigene Änderung\n")

    def test_reports_a_failed_install(self):
        self.repos.push_new("desktop/install.sh", "echo kaputt\nexit 3\n")
        self.updater.start()
        status = wait_done(self.updater)
        self.assertEqual(status["state"], "failed")
        self.assertEqual(status["error"], "installFailed")
        self.assertIn("kaputt", status["log"])

    def test_no_git_checkout(self):
        with tempfile.TemporaryDirectory() as plain:
            self.assertEqual(ScriptUpdater(plain).check()["error"], "noGit")


class ServerTest(unittest.TestCase):
    def setUp(self):
        self.repos = Repos()
        self.addCleanup(self.repos.cleanup)
        build = tempfile.TemporaryDirectory()
        self.addCleanup(build.cleanup)
        with open(os.path.join(build.name, "index.html"), "w") as fh:
            fh.write("<html></html>")

        class Handler(goTV_local.GoTvHandler):
            build_dir = build.name
            updater = ScriptUpdater(self.repos.work)

            def log_message(self, *args):
                pass

        self.server = goTV_local.ThreadingServer(("127.0.0.1", 0), Handler)
        self.port = self.server.server_address[1]
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)

    def request(self, method, path, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=30)
        base = {"Host": "127.0.0.1:%d" % self.port}
        conn.request(method, path, body=b"" if method == "POST" else None, headers={**base, **(headers or {})})
        resp = conn.getresponse()
        body = resp.read()
        conn.close()
        return resp.status, body

    def page_headers(self):
        return {"Origin": "http://127.0.0.1:%d" % self.port, "X-GoTV-Update": "1"}

    def test_state_and_check_from_the_page(self):
        status, body = self.request("GET", "/desktop/script-update")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["state"], "idle")
        self.repos.push_new()
        status, body = self.request("POST", "/desktop/script-update/check", self.page_headers())
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["behind"], 1)

    def test_restart_from_the_page(self):
        status, body = self.request("POST", "/desktop/script-update/restart", self.page_headers())
        self.assertEqual(status, 200)
        self.assertFalse(json.loads(body)["restarting"])
        self.assertEqual(self.request("POST", "/desktop/script-update/restart")[0], 403)

    def test_refuses_posts_not_from_the_page(self):
        # Without Origin, without the header, from a foreign site.
        self.assertEqual(self.request("POST", "/desktop/script-update/run")[0], 403)
        local = {"Origin": "http://127.0.0.1:%d" % self.port}
        self.assertEqual(self.request("POST", "/desktop/script-update/run", local)[0], 403)
        foreign = {"Origin": "https://example.org", "X-GoTV-Update": "1"}
        self.assertEqual(self.request("POST", "/desktop/script-update/run", foreign)[0], 403)

    def test_no_update_actions_without_an_updater(self):
        class Plain(goTV_local.GoTvHandler):
            updater = None

        self.server.RequestHandlerClass = Plain
        status, _ = self.request("POST", "/desktop/script-update/check", self.page_headers())
        self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()
