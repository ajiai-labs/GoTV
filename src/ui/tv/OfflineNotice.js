// @flow
import React, { PureComponent as Component } from "react";

type State = { offline: boolean };

// Says what still works without a connection: replaying (also stored
// tournament games) and KataGo; streams and live boards need the network.
export default class OfflineNotice extends Component<{}, State> {
  state = {
    offline: typeof navigator !== "undefined" && navigator.onLine === false,
  };

  componentDidMount() {
    window.addEventListener("online", this._update);
    window.addEventListener("offline", this._update);
  }

  componentWillUnmount() {
    window.removeEventListener("online", this._update);
    window.removeEventListener("offline", this._update);
  }

  _update = () => {
    this.setState({ offline: navigator.onLine === false });
  };

  render() {
    if (!this.state.offline) {
      return null;
    }
    return (
      <div className="OfflineNotice" role="status">
        Offline · Nachspielen und KataGo gehen weiter, auch schon geöffnete
        Turnierpartien. Streams, Live-Bretter und neue Kalenderdaten brauchen
        Internet.
      </div>
    );
  }
}
