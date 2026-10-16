import { describe, it, expect } from "vitest";
import { hashSeed, seededRandom } from "./random";

describe("seededRandom", () => {
  it("gives the same sequence for the same seed", () => {
    const a = seededRandom(hashSeed("same"));
    const b = seededRandom(hashSeed("same"));
    const first = Array.from({ length: 20 }, () => a());
    const second = Array.from({ length: 20 }, () => b());
    expect(first).toEqual(second);
  });

  it("gives different sequences for different seeds", () => {
    const a = seededRandom(hashSeed("one"));
    const b = seededRandom(hashSeed("two"));
    expect(a()).not.toBe(b());
  });

  it("returns values in [0, 1)", () => {
    const rng = seededRandom(hashSeed("range"));
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
