// @flow
import React, { PureComponent as Component } from "react";
import type { StreamChatInfo } from "../../model/StreamChat";

type Props = {
  chat: StreamChatInfo,
  title: string,
};

type State = {
  open: boolean,
};

const PLATFORM_LABEL = {
  youtube: "YouTube",
  twitch: "Twitch",
};

// The platform's own chat next to a stream, through its official embed.
// Like the player it loads only after a click (two-click solution).
export default class StreamChat extends Component<Props, State> {
  state = { open: false };

  _onToggle = () => {
    this.setState((state) => ({ open: !state.open }));
  };

  render() {
    let { chat, title } = this.props;
    let label = PLATFORM_LABEL[chat.platform];
    return (
      <div className="StreamChat">
        <button
          type="button"
          className="Button Button-small Button-secondary StreamChat-toggle"
          aria-expanded={this.state.open}
          onClick={this._onToggle}>
          {this.state.open
            ? label + "-Chat ausblenden"
            : label + "-Chat anzeigen"}
        </button>
        {this.state.open ? (
          <iframe
            className="StreamChat-frame"
            src={chat.embedUrl}
            title={"Chat: " + title}
          />
        ) : (
          <span className="StreamChat-hint">
            lädt den Chat von {label}; schreiben nur mit {label}-Anmeldung
          </span>
        )}
      </div>
    );
  }
}
