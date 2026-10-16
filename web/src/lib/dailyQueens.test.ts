import { describe, it, expect } from "vitest";
import { dailyQueensPuzzle, dailyQueensSeed, QUEENS_N } from "./dailyQueens";
import { solveQueens } from "./queens";

describe("dailyQueensPuzzle", () => {
  it("is the same puzzle for the same day", () => {
    expect(dailyQueensPuzzle("2026-10-16")).toEqual(dailyQueensPuzzle("2026-10-16"));
  });

  it("is a different puzzle on another day", () => {
    expect(dailyQueensPuzzle("2026-10-16").colors).not.toEqual(dailyQueensPuzzle("2026-10-17").colors);
  });

  it("is the board size the game uses and has exactly one solution", () => {
    const puzzle = dailyQueensPuzzle("2026-10-16");
    expect(puzzle.n).toBe(QUEENS_N);
    expect(solveQueens(puzzle.colors, 2)).toEqual([puzzle.solution]);
  });

  it("seeds from the day", () => {
    expect(dailyQueensSeed("2026-10-16")).toContain("2026-10-16");
  });
});
