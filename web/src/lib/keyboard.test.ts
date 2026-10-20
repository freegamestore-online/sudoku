import { describe, expect, it } from "vitest";
import { isTextEntryTarget } from "./keyboard";

describe("isTextEntryTarget", () => {
  it("recognizes text inputs and editable regions", () => {
    for (const element of [
      document.createElement("input"),
      document.createElement("textarea"),
      document.createElement("select"),
      (() => {
        const element = document.createElement("div");
        element.setAttribute("contenteditable", "true");
        return element;
      })(),
    ]) {
      expect(isTextEntryTarget(element)).toBe(true);
    }
  });

  it("does not treat the game board or missing targets as text entry", () => {
    expect(isTextEntryTarget(document.createElement("button"))).toBe(false);
    expect(isTextEntryTarget(null)).toBe(false);
  });
});
