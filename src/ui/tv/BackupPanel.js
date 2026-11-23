// @flow
import React, { PureComponent as Component } from "react";
import {
  collectBackup,
  describeBackup,
  getBackupFileName,
  parseBackup,
  restoreBackup,
} from "../../model/Backup";
import type { Backup, BackupSummary } from "../../model/Backup";

type Props = {
  // After a restore every part of GoTV has to read its data again; a
  // reload does that. Tests pass their own.
  onRestored?: () => any,
};

type State = {
  pending: ?Backup,
  message: ?string,
  error: ?string,
};

const RELOAD_DELAY_MS = 1200;

function getStorage(): ?Object {
  try {
    return window.localStorage;
  } catch (err) {
    return null; // storage disabled
  }
}

function plural(count: number, one: string, many: string): string {
  return count + " " + (count === 1 ? one : many);
}

export function formatSummary(summary: BackupSummary): string {
  let parts = [];
  if (summary.favoriteChannels) {
    parts.push(
      plural(summary.favoriteChannels, "Lieblingskanal", "Lieblingskanäle")
    );
  }
  if (summary.favoriteEvents) {
    parts.push(
      plural(summary.favoriteEvents, "Lieblingsturnier", "Lieblingsturniere")
    );
  }
  if (summary.games) {
    let game = plural(
      summary.games,
      "nachgespielte Partie",
      "nachgespielte Partien"
    );
    let extras = [];
    if (summary.bookmarks) {
      extras.push(plural(summary.bookmarks, "Lesezeichen", "Lesezeichen"));
    }
    if (summary.variationMoves) {
      extras.push(
        plural(summary.variationMoves, "Variantenzug", "Variantenzüge")
      );
    }
    parts.push(game + (extras.length ? " (" + extras.join(", ") + ")" : ""));
  }
  if (summary.settings) {
    parts.push(plural(summary.settings, "Einstellung", "Einstellungen"));
  }
  return parts.length ? parts.join(", ") : "keine Daten";
}

function formatDate(iso: string): string {
  let date = new Date(iso);
  return isNaN(date.getTime())
    ? "unbekanntem Datum"
    : date.toLocaleDateString("de-DE") +
        ", " +
        date.toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
        }) +
        " Uhr";
}

// "Meine Daten": carry stars, replays and settings to another device as a
// file. Nothing leaves the browser unless the viewer saves the file.
export default class BackupPanel extends Component<Props, State> {
  state = { pending: null, message: null, error: null };

  _onSave = () => {
    let storage = getStorage();
    if (!storage) {
      this.setState({ error: "Dieser Browser speichert keine Daten." });
      return;
    }
    let now = new Date();
    let backup = collectBackup(storage, now);
    let blob = new Blob([JSON.stringify(backup, null, 1)], {
      type: "application/json",
    });
    let url = URL.createObjectURL(blob);
    let link = document.createElement("a");
    link.href = url;
    link.download = getBackupFileName(now);
    document.body && document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.setState({
      message:
        "Sicherung gespeichert: " + formatSummary(describeBackup(backup)) + ".",
      error: null,
      pending: null,
    });
  };

  _onChooseFile = (e: Object) => {
    let file = e.target.files && e.target.files[0];
    e.target.value = ""; // the same file can be chosen again
    if (!file) {
      return;
    }
    let reader = new FileReader();
    reader.onload = () => {
      let result = parseBackup(String(reader.result || ""));
      if (result.ok) {
        this.setState({ pending: result.backup, error: null, message: null });
      } else {
        this.setState({ error: result.error, pending: null, message: null });
      }
    };
    reader.onerror = () => {
      this.setState({ error: "Die Datei konnte nicht gelesen werden." });
    };
    reader.readAsText(file);
  };

  _onRestore = () => {
    let { pending } = this.state;
    let storage = getStorage();
    if (!pending || !storage) {
      return;
    }
    let changed = restoreBackup(storage, pending);
    this.setState({
      pending: null,
      message: changed
        ? "Sicherung übernommen. GoTV lädt neu …"
        : "Nichts zu übernehmen - diese Daten sind schon hier.",
    });
    if (changed) {
      let restored = this.props.onRestored || (() => window.location.reload());
      setTimeout(restored, RELOAD_DELAY_MS);
    }
  };

  _onCancel = () => {
    this.setState({ pending: null });
  };

  render() {
    let { pending, message, error } = this.state;
    return (
      <div className="BackupPanel">
        <div className="BackupPanel-header">
          <span className="BackupPanel-title">Meine Daten</span>
          <span className="BackupPanel-hint">
            Favoriten, nachgespielte Partien mit Lesezeichen und Varianten,
            Einstellungen - nur in diesem Browser. Mit einer Sicherungsdatei
            nimmst du sie auf ein anderes Gerät mit.
          </span>
        </div>
        <div className="BackupPanel-actions">
          <button
            type="button"
            className="Button Button-small Button-secondary BackupPanel-save"
            onClick={this._onSave}>
            Sicherung speichern
          </button>
          <label className="Button Button-small Button-secondary BackupPanel-load">
            Sicherung einspielen …
            <input
              type="file"
              accept=".json,application/json"
              className="BackupPanel-input"
              onChange={this._onChooseFile}
            />
          </label>
        </div>
        {pending ? (
          <div className="BackupPanel-confirm">
            <div>
              Sicherung vom {formatDate(pending.createdAt)}:{" "}
              {formatSummary(describeBackup(pending))}.
            </div>
            <div className="BackupPanel-hint">
              Einspielen ergänzt nur: Was hier schon gespeichert ist, bleibt
              erhalten; bei derselben Partie gilt der neuere Stand.
            </div>
            <button
              type="button"
              className="Button Button-small BackupPanel-restore"
              onClick={this._onRestore}>
              Einspielen
            </button>{" "}
            <button
              type="button"
              className="Button Button-small Button-secondary"
              onClick={this._onCancel}>
              Abbrechen
            </button>
          </div>
        ) : null}
        {message ? (
          <div className="BackupPanel-message" role="status">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="BackupPanel-error" role="alert">
            {error}
          </div>
        ) : null}
      </div>
    );
  }
}
