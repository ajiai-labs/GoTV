// @flow
import React, { PureComponent as Component } from "react";

type Props = {
  active: boolean,
  // What gets starred, for the tooltip and screen readers.
  name: string,
  onToggle: () => any,
};

// The star of "Mein GoTV" at a channel or tournament card.
export default class FavoriteStar extends Component<Props> {
  render() {
    let { active, name, onToggle } = this.props;
    let label = active
      ? name + " aus Mein GoTV entfernen"
      : name + " zu Mein GoTV hinzufügen";
    return (
      <button
        type="button"
        className={"FavoriteStar" + (active ? " FavoriteStar-active" : "")}
        aria-pressed={active}
        aria-label={label}
        title={label}
        onClick={onToggle}>
        {active ? "★" : "☆"}
      </button>
    );
  }
}
