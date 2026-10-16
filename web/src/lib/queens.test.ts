import { describe, it, expect } from "vitest";
import { generateQueens, queensConflicts, solveQueens, type QueensPuzzle } from "./queens";

/** Checks the rules directly, without the solver: one queen per row, column and region, none touching. */
function assertValidSolution({ n, colors, solution }: QueensPuzzle) {
  expect(solution).toHaveLength(n);
  expect(new Set(solution.map(([r]) => r)).size).toBe(n);
  expect(new Set(solution.map(([, c]) => c)).size).toBe(n);
  expect(new Set(solution.map(([r, c]) => colors[r]![c])).size).toBe(n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const [r1, c1] = solution[i]!;
      const [r2, c2] = solution[j]!;
      expect(Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2))).toBeGreaterThan(1);
    }
  }
}

describe("generateQueens", () => {
  it.each([5, 6, 8])("makes a valid %i×%i puzzle with one region per colour", (n) => {
    const puzzle = generateQueens(n, 2026 + n);
    expect(puzzle.n).toBe(n);
    expect(puzzle.colors).toHaveLength(n);
    expect(new Set(puzzle.colors.flat()).size).toBe(n);
    assertValidSolution(puzzle);
  });

  it.each([5, 6, 8])("makes an %i×%i puzzle with exactly one solution, and it is the stored one", (n) => {
    const puzzle = generateQueens(n, 4242 + n);
    const solutions = solveQueens(puzzle.colors, 2);
    expect(solutions).toHaveLength(1);
    expect(solutions[0]).toEqual(puzzle.solution);
  });

  it("is the same puzzle for the same seed", () => {
    expect(generateQueens(8, 99)).toEqual(generateQueens(8, 99));
  });

  it("gives different puzzles for different seeds", () => {
    expect(generateQueens(8, 1).colors).not.toEqual(generateQueens(8, 2).colors);
  });
});

describe("solveQueens", () => {
  it("finds no solution on a 2x2 board, where any two queens in adjacent rows touch", () => {
    expect(solveQueens([[0, 0], [1, 1]], 2)).toHaveLength(0);
  });

  it("stops at the limit", () => {
    expect(solveQueens(generateQueens(8, 3).colors, 1)).toHaveLength(1);
  });
});

describe("queensConflicts", () => {
  const puzzle = generateQueens(6, 17);

  it("reports no conflicts for the solution", () => {
    expect(queensConflicts(puzzle.colors, puzzle.solution).size).toBe(0);
  });

  it("flags two queens in the same row", () => {
    const [r] = puzzle.solution[0]!;
    const other: [number, number] = [r, (puzzle.solution[0]![1] + 3) % puzzle.n];
    const conflicts = queensConflicts(puzzle.colors, [puzzle.solution[0]!, other]);
    expect(conflicts.has(`${r}-${puzzle.solution[0]![1]}`)).toBe(true);
    expect(conflicts.has(`${other[0]}-${other[1]}`)).toBe(true);
  });

  it("flags two touching queens, diagonals included", () => {
    const conflicts = queensConflicts(
      [[0, 1, 2], [3, 4, 5], [6, 7, 8]],
      [[0, 0], [1, 1]],
    );
    expect(conflicts.size).toBe(2);
  });
});
