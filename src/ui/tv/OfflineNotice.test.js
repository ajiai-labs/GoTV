import React from "react";
import ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";
import OfflineNotice from "./OfflineNotice";

describe("OfflineNotice", () => {
  let container;
  let onLine = true;

  beforeEach(() => {
    jest.spyOn(navigator, "onLine", "get").mockImplementation(() => onLine);
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
    jest.restoreAllMocks();
    onLine = true;
  });

  it("appears while the device is offline", () => {
    act(() => {
      ReactDOM.render(<OfflineNotice />, container);
    });
    expect(container.textContent).toBe("");
    onLine = false;
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(container.textContent).toContain(
      "Nachspielen und KataGo gehen weiter"
    );
    onLine = true;
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(container.textContent).toBe("");
  });
});
