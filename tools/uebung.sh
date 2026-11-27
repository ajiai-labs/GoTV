#!/bin/sh
# Practice GoTV: starts the practice KGS (tools/fake_kgs.py) on port 8799
# and opens GoTV against it in a browser window with its own profile - your
# real GoTV, its settings and boards stay untouched. Developer tool, not
# part of any app build. Needs build-desktop/ (sh desktop/install.sh).
# Usage: sh tools/uebung.sh [--strict]
set -eu
cd "$(dirname "$0")/.."
PORT=8799
PROFILE="$HOME/.local/share/gotv/uebung-profile"
URL="http://127.0.0.1:$PORT"

if ! curl -s -o /dev/null "$URL/"; then
	python3 tools/fake_kgs.py --port "$PORT" "$@" &
	i=0
	until curl -s -o /dev/null "$URL/" || [ "$i" -ge 20 ]; do
		i=$((i + 1))
		sleep 0.5
	done
fi

if command -v chromium >/dev/null 2>&1; then
	chromium --app="$URL" --user-data-dir="$PROFILE" --class=gotv-uebung >/dev/null 2>&1 &
elif flatpak info org.chromium.Chromium >/dev/null 2>&1; then
	flatpak run org.chromium.Chromium --app="$URL" --user-data-dir="$PROFILE" --class=gotv-uebung >/dev/null 2>&1 &
else
	echo "Kein Chromium gefunden - öffne $URL in einem Browser." >&2
fi
echo "Übungs-GoTV: $URL - beliebiger Name, beliebiges Passwort."
wait
