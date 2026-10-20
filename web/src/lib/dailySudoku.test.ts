import { describe, expect, it } from "vitest";
import { dailySudokuPuzzle, dailySudokuSeed, dailySudokuResults, recordDailySudokuResult } from "./dailySudoku";
import { countSolutions, checkSolution } from "./sudoku";

describe("daily classic Sudoku", () => {
  it.each(["easy", "medium", "hard"] as const)("is deterministic and uniquely solvable for %s", (difficulty) => {
    const a = dailySudokuPuzzle("2026-10-20", difficulty);
    const b = dailySudokuPuzzle("2026-10-20", difficulty);
    expect(b).toBe(a);
    expect(dailySudokuSeed("2026-10-20", difficulty)).toContain(difficulty);
    expect(countSolutions(a.puzzle, 2)).toBe(1);
    expect(checkSolution(a.solution, a.solution)).toBe(true);
  });

  it("varies by day and tier", () => {
    expect(dailySudokuPuzzle("2026-10-20", "easy").solution).not.toEqual(dailySudokuPuzzle("2026-10-21", "easy").solution);
    expect(dailySudokuPuzzle("2026-10-20", "easy").solution).not.toEqual(dailySudokuPuzzle("2026-10-20", "hard").solution);
  });

  it("records and replaces completion stats for a date and tier", () => {
    const store = window.localStorage;
    store.clear();
    recordDailySudokuResult({ date: "2026-10-20", difficulty: "easy", time: 91, hints: 2 }, store);
    recordDailySudokuResult({ date: "2026-10-20", difficulty: "easy", time: 80, hints: 1 }, store);
    recordDailySudokuResult({ date: "2026-10-20", difficulty: "hard", time: 120, hints: 0 }, store);
    expect(dailySudokuResults(store)).toHaveLength(2);
    expect(dailySudokuResults(store).find((result) => result.difficulty === "easy")?.time).toBe(80);
  });
});
