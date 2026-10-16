import { describe, it, expect } from "vitest";
import { dailyKey, dailyKillerPuzzle, dailySeed } from "./daily";
import { solveKiller } from "./killer";
import { checkSolution } from "./sudoku";

describe("dailyKey", () => {
  it("is the UTC calendar date as YYYY-MM-DD", () => {
    expect(dailyKey(new Date("2026-10-16T23:30:00Z"))).toBe("2026-10-16");
    expect(dailyKey(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01-01");
  });
});

describe("dailyKillerPuzzle", () => {
  it("is the same puzzle for the same day", () => {
    const a = dailyKillerPuzzle("2026-10-16");
    const b = dailyKillerPuzzle("2026-10-16");
    expect(b).toBe(a);
    expect(a.solution).toEqual(b.solution);
    expect(a.cages).toEqual(b.cages);
  }, 60_000);

  it("is a different puzzle on another day", () => {
    const a = dailyKillerPuzzle("2026-10-16");
    const b = dailyKillerPuzzle("2026-10-17");
    expect(a.solution).not.toEqual(b.solution);
  }, 60_000);

  it("has exactly one solution, and it is the stored one", () => {
    const puzzle = dailyKillerPuzzle("2026-10-16");
    const solutions = solveKiller(puzzle.cages, 2);
    expect(solutions).toHaveLength(1);
    expect(checkSolution(solutions[0]!, puzzle.solution)).toBe(true);
  }, 60_000);

  it("seeds from the day", () => {
    expect(dailySeed("2026-10-16")).toContain("2026-10-16");
  });
});
