import { describe, it, expect } from "vitest";
import { completedRegions, generateSolution } from "./sudoku";
import type { CellValue } from "../types";

function emptyBoard(): CellValue[][] {
  return Array.from({ length: 9 }, () => Array<CellValue>(9).fill(null));
}

describe("completedRegions", () => {
  const solution = generateSolution();

  it("reports nothing when the placed cell does not finish any group", () => {
    const board = emptyBoard();
    board[0]![0] = solution[0]![0]!;
    expect(completedRegions(board, solution, 0, 0)).toEqual([]);
  });

  it("reports a row, column and box that are all correct after the placement", () => {
    const board = solution.map((row) => [...row]) as CellValue[][];
    const groups = completedRegions(board, solution, 4, 4);
    expect(groups).toHaveLength(3);
    expect(groups.every((group) => group.length === 9)).toBe(true);
    expect(groups.every((group) => group.some(([r, c]) => r === 4 && c === 4))).toBe(true);
  });

  it("ignores a group that holds a wrong number", () => {
    const board = solution.map((row) => [...row]) as CellValue[][];
    board[0]![1] = (solution[0]![1]! % 9) + 1;
    // (0, 1) sits in row 0 and in box 0, so both are wrong now. Only column 0 is complete.
    const groups = completedRegions(board, solution, 0, 0);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.every(([, c]) => c === 0)).toBe(true);
  });
});
