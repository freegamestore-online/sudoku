import { describe, it, expect } from "vitest";
import { TIME_SCORE_BASE, timeScore } from "./timeScore";

describe("timeScore", () => {
  it("ranks a faster solve above a slower one", () => {
    expect(timeScore(90)).toBeGreaterThan(timeScore(300));
  });

  it("is the base minus the seconds taken", () => {
    expect(timeScore(0)).toBe(TIME_SCORE_BASE);
    expect(timeScore(125)).toBe(TIME_SCORE_BASE - 125);
  });
});
