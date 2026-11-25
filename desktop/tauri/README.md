# GoTV Desktop-Apps (Windows, macOS, Linux)

GoTV als eigenständige Desktop-App, gebaut mit [Tauri 2](https://tauri.app). Die App
startet einen kleinen Server nur auf `127.0.0.1` (freier Port) und öffnet darauf ein
Fenster. Der Server liefert die Oberfläche aus und leitet `/json/access` an KGS weiter -
genau wie `desktop/goTV_local.py` unter Linux (Begründung: `AGENTS.md`,
"Proxy-Begründung"). Den Turnierkalender lädt die App zuerst von GitHub, ohne Netz
gilt die mitgelieferte Kopie.

Die Apps sind **nicht signiert**. Beim ersten Start warnt das Betriebssystem deshalb.

## Herunterladen

Immer die neueste Version (Seite mit allen Dateien):
https://github.com/ajiai-labs/GoTV/releases/latest

| System | Datei |
|---|---|
| Windows (Installer) | [GoTV-windows-x64-setup.exe](https://github.com/ajiai-labs/GoTV/releases/latest/download/GoTV-windows-x64-setup.exe) |
| Windows (MSI) | [GoTV-windows-x64.msi](https://github.com/ajiai-labs/GoTV/releases/latest/download/GoTV-windows-x64.msi) |
| macOS (Apple Silicon und Intel) | [GoTV-macos-universal.dmg](https://github.com/ajiai-labs/GoTV/releases/latest/download/GoTV-macos-universal.dmg) |
| Linux (alle Distributionen) | [GoTV-linux-x86_64.AppImage](https://github.com/ajiai-labs/GoTV/releases/latest/download/GoTV-linux-x86_64.AppImage) |
| Linux (Debian, Ubuntu) | [GoTV-linux-amd64.deb](https://github.com/ajiai-labs/GoTV/releases/latest/download/GoTV-linux-amd64.deb) |

iPad/iPhone: keine App (Apple erlaubt keine Installation außerhalb des App Store) -
dort die Web-Version https://ajiai-labs.github.io/GoTV/ öffnen und "Zum Home-Bildschirm".

## Updates

Beim Start fragt die App GitHub nach dem neuesten Release (`desktop-vX.Y.Z`). Ist es
neuer, erscheint oben ein Hinweis mit "Herunterladen"; die Version steht außerdem unter
Einstellungen → "Über GoTV" (dort auch "Nach Updates suchen"). Der Download öffnet sich
im System-Browser: der lokale Server öffnet dafür nur die fünf festen Installer-Adressen
(`POST /desktop/open-download/<Datei>`, keine frei wählbare Adresse). Danach GoTV
schließen und den Installer starten. Die Version kommt beim Bauen aus dem Tag
(`VITE_DESKTOP_VERSION`).

## Installieren

**Windows:** `GoTV-windows-x64-setup.exe` starten. SmartScreen meldet "Der Computer
wurde durch Windows geschützt": **Weitere Informationen → Trotzdem ausführen**.
Fehlt WebView2 (nur sehr alte Windows-10-Stände), lädt der Installer es nach.

**macOS:** `.dmg` öffnen, GoTV in "Programme" ziehen. Beim ersten Start meldet macOS,
dass der Entwickler nicht verifiziert werden kann: im Finder **Rechtsklick auf GoTV →
Öffnen → Öffnen**. Geht das nicht (neuere macOS-Versionen): einmal starten, dann
**Systemeinstellungen → Datenschutz & Sicherheit → "Dennoch öffnen"**. Meldet macOS
"GoTV ist beschädigt", hilft im Terminal: `xattr -dr com.apple.quarantine /Applications/GoTV.app`

**Linux:** AppImage ausführbar machen und starten:
`chmod +x GoTV-linux-x86_64.AppImage && ./GoTV-linux-x86_64.AppImage`.
Oder das Paket installieren: `sudo apt install ./GoTV-linux-amd64.deb`.
Linux ohne Tauri geht weiterhin über `desktop/install.sh` (Python-Server + Browserfenster).

## Lokal bauen

Voraussetzungen: Rust (stable), Node.js 24, unter Linux die Tauri-Pakete
(`libwebkit2gtk-4.1-dev`, `librsvg2-dev`, `libayatana-appindicator3-dev`, `patchelf`),
siehe https://tauri.app/start/prerequisites/

```bash
# 1. Oberfläche für den Desktop bauen (landet in app/build, wird eingebettet)
cd app && npm ci && VITE_API_URL=/json/access VITE_EVENTS_REMOTE_FIRST=true npm run build && cd ..

# 2. Server testen (braucht kein webkit)
cd desktop/tauri && cargo test -p gotv-server

# 3. App starten bzw. Installer bauen
cargo run -p gotv-desktop
cd gotv-desktop && npx @tauri-apps/cli@2.12.6 build    # -> desktop/tauri/target/release/bundle/
```

Auf diesem Rechner ohne globales Rust: Befehle in
`nix shell nixpkgs#cargo nixpkgs#rustc nixpkgs#pkg-config -c …` ausführen.

Aufbau:
- `gotv-server/` - Bibliothek ohne Tauri: Server, SPA-Fallback, DNS-Rebinding-Schutz,
  KGS-Proxy. Tests mit nachgebautem KGS auf 127.0.0.1 (kein Internet).
- `gotv-desktop/` - die Tauri-App (Fenster "GoTV", Icons in `icons/`, erzeugt mit
  `tauri icon desktop/icons/png/gotv-512.png`).

## Neue Version veröffentlichen

Version im Format `X.Y.Z` (nur Zahlen, das Windows-MSI verlangt es):

```bash
git tag desktop-v1.0.0
git push origin desktop-v1.0.0
```

Der Workflow `.github/workflows/desktop.yml` baut auf Windows, macOS und Linux, legt das
Release "GoTV Desktop 1.0.0" an (erst als Entwurf, öffentlich sobald alle drei Builds
fertig sind) und lädt die Installer hoch - mit Versionsnummer im Namen und zusätzlich
unter den festen Namen aus der Tabelle oben. Alternativ: Actions → "Desktop-Apps" →
"Run workflow" mit der Version; der Tag entsteht dann beim Veröffentlichen.
Schlägt ein Build fehl, bleibt das Release ein Entwurf (unter Releases sichtbar, nur für
Bearbeiter) - nach der Korrektur Entwurf und Tag löschen und neu taggen.
