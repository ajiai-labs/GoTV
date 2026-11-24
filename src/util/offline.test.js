import { getBuildVersion, shouldRegisterOffline } from "./offline";

describe("offline support", () => {
  it("names the build after the main bundle", () => {
    let doc = document.implementation.createHTMLDocument("x");
    let script = doc.createElement("script");
    script.src =
      "https://ajiai-labs.github.io/GoTV/static/js/main.4341e0f5.chunk.js";
    doc.body.appendChild(script);
    expect(getBuildVersion(doc)).toBe("4341e0f5");
    expect(
      getBuildVersion(document.implementation.createHTMLDocument("y"))
    ).toBe("dev");
  });

  it("is only registered by the web version's production build", () => {
    expect(
      shouldRegisterOffline({
        NODE_ENV: "production",
        REACT_APP_GUEST_ONLY: "true",
      })
    ).toBe(true);
    expect(shouldRegisterOffline({ NODE_ENV: "production" })).toBe(false);
    expect(
      shouldRegisterOffline({
        NODE_ENV: "development",
        REACT_APP_GUEST_ONLY: "true",
      })
    ).toBe(false);
  });
});
