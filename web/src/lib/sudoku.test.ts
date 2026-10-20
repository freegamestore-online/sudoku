import { describe, it, expect } from "vitest";
import { autoFillNotes, completedRegions, countSolutions, generatePuzzle, generateSolution, getHint } from "./sudoku";
import type { CellValue, Notes } from "../types";

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

describe("hints and pencil marks", () => {
  it("reveals the solution value and clears notes at the hinted cell", () => {
    const { puzzle, solution } = generatePuzzle("easy");
    const notes: Notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set<number>()));
    const row = puzzle.findIndex((line) => line.includes(null));
    const col = puzzle[row]!.findIndex((cell) => cell === null);
    notes[row]![col]!.add(1);
    const result = getHint(puzzle, notes, solution, row, col);

    expect(result.value).toBe(solution[row]![col]);
    expect(result.board[row]![col]).toBe(solution[row]![col]);
    expect(result.notes[row]![col]!.size).toBe(0);
    expect(puzzle[row]![col]).toBeNull();
    expect(notes[row]![col]!.has(1)).toBe(true);
  });

  it("fills each empty cell with legal row, column and box candidates", () => {
    const board: CellValue[][] = [
      [1, 2, 3, 4, 5, 6, 7, 8, null],
      [4, 5, 6, 7, 8, 9, 1, 2, 3],
      [7, 8, 9, 1, 2, 3, 4, 5, 6],
      ...Array.from({ length: 6 }, () => Array<CellValue>(9).fill(null)),
    ];
    const notes = autoFillNotes(board);
    expect([...notes[0]![8]!]).toEqual([9]);
    expect([...notes[1]![0]!]).toEqual([]);
    expect([...notes[3]![0]!]).toEqual([2, 3, 5, 6, 8, 9]);
  });

  it("replaces notes in empty cells and preserves notes on confirmed cells", () => {
    const board: CellValue[][] = Array.from({ length: 9 }, () => Array<CellValue>(9).fill(null));
    board[0]![0] = 1;
    const existing: Notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set<number>()));
    existing[0]![1]!.add(9);
    existing[0]![0]!.add(4);
    const filled = autoFillNotes(board, existing);
    expect([...filled[0]![1]!]).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect([...filled[0]![0]!]).toEqual([4]);
  });
});

describe("generated puzzles", () => {
  it.each(["easy", "medium", "hard"] as const)("keeps %s puzzles uniquely solvable", (difficulty) => {
    const { puzzle, solution } = generatePuzzle(difficulty);
    expect(countSolutions(puzzle, 2)).toBe(1);
    expect(puzzle.flat().filter((cell) => cell === null).length).toBeGreaterThan(0);
    expect(solution).toHaveLength(9);
  }, 60_000);
});
