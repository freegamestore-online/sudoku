import { describe, it, expect } from "vitest";
import {
  cageCombinations,
  cageIndexMap,
  cageLabelCell,
  cageStatus,
  generateKiller,
  solveKiller,
  MAX_CAGE_SIZE,
  type Cage,
} from "./killer";
import { checkSolution } from "./sudoku";

/** One cage per row, each summing to 45. Any valid Sudoku grid satisfies them. */
function rowCages(): Cage[] {
  return Array.from({ length: 9 }, (_, r) => ({
    cells: Array.from({ length: 9 }, (_, c): [number, number] => [r, c]),
    sum: 45,
  }));
}

describe("cageCombinations", () => {
  it("lists the only pair that sums to 3", () => {
    expect(cageCombinations(3, 2)).toEqual([[1, 2]]);
  });

  it("lists every distinct pair that sums to 10", () => {
    expect(cageCombinations(10, 2)).toEqual([
      [1, 9],
      [2, 8],
      [3, 7],
      [4, 6],
    ]);
  });

  it("returns the full digit set for a nine-cell cage summing to 45", () => {
    expect(cageCombinations(45, 9)).toEqual([[1, 2, 3, 4, 5, 6, 7, 8, 9]]);
  });

  it("returns nothing when no digits fit", () => {
    expect(cageCombinations(1, 2)).toEqual([]);
    expect(cageCombinations(30, 2)).toEqual([]);
  });

  it("only returns distinct ascending digits that add up to the sum", () => {
    for (let size = 1; size <= MAX_CAGE_SIZE; size++) {
      for (let sum = 1; sum <= 45; sum++) {
        for (const combo of cageCombinations(sum, size)) {
          expect(combo).toHaveLength(size);
          expect(new Set(combo).size).toBe(size);
          expect([...combo].sort((a, b) => a - b)).toEqual(combo);
          expect(combo.reduce((a, b) => a + b, 0)).toBe(sum);
        }
      }
    }
  });
});

describe("solveKiller", () => {
  it("finds the grid behind a generated puzzle as its only solution", () => {
    const puzzle = generateKiller();
    const solutions = solveKiller(puzzle.cages, 2);
    expect(solutions).toHaveLength(1);
    expect(checkSolution(solutions[0]!, puzzle.solution)).toBe(true);
  });

  it("finds no solution when a cage sum is wrong", () => {
    const puzzle = generateKiller();
    const broken = puzzle.cages.map((cage, i) => (i === 0 ? { ...cage, sum: cage.sum + 1 } : cage));
    expect(solveKiller(broken, 2)).toHaveLength(0);
  });

  it("reports two solutions when the cages leave the grid open", () => {
    // Row cages sum to 45 and so do not constrain anything beyond normal Sudoku rules,
    // which many grids satisfy.
    expect(solveKiller(rowCages(), 2)).toHaveLength(2);
  });
});

describe("generateKiller", () => {
  it("partitions all 81 cells into cages with distinct digits", () => {
    const { cages, solution } = generateKiller();
    const cells = cages.flatMap((cage) => cage.cells);
    expect(cells).toHaveLength(81);
    expect(new Set(cells.map(([r, c]) => `${r}-${c}`)).size).toBe(81);

    for (const cage of cages) {
      expect(cage.cells.length).toBeGreaterThanOrEqual(1);
      expect(cage.cells.length).toBeLessThanOrEqual(MAX_CAGE_SIZE);
      const digits = cage.cells.map(([r, c]) => solution[r]![c]!);
      expect(new Set(digits).size).toBe(digits.length);
      expect(digits.reduce((a, b) => a + b, 0)).toBe(cage.sum);
    }
  }, 60_000);

  it("produces puzzles with exactly one solution, and it is the generated grid", () => {
    for (let i = 0; i < 5; i++) {
      const puzzle = generateKiller();
      const solutions = solveKiller(puzzle.cages, 2);
      expect(solutions).toHaveLength(1);
      expect(checkSolution(solutions[0]!, puzzle.solution)).toBe(true);
    }
  }, 60_000);
});

describe("cage helpers", () => {
  const cage: Cage = {
    cells: [
      [0, 1],
      [0, 0],
      [1, 0],
    ],
    sum: 10,
  };

  it("indexes each cell to its cage", () => {
    const index = cageIndexMap([cage]);
    expect(index[0]![0]).toBe(0);
    expect(index[0]![1]).toBe(0);
    expect(index[1]![0]).toBe(0);
    expect(index[8]![8]).toBe(-1);
  });

  it("places the sum label on the first cell in reading order", () => {
    expect(cageLabelCell(cage)).toEqual([0, 0]);
  });

  it("reports what a cage still needs", () => {
    const board: (number | null)[][] = Array.from({ length: 9 }, () => Array<number | null>(9).fill(null));
    const empty = cageStatus(cage, board);
    expect(empty.remaining).toBe(10);
    expect(empty.empty).toBe(3);
    // Three cells summing to 10 with distinct digits: 1+2+7, 1+3+6, 1+4+5, 2+3+5.
    expect(empty.candidates).toEqual([
      [1, 2, 7],
      [1, 3, 6],
      [1, 4, 5],
      [2, 3, 5],
    ]);

    board[0]![0] = 1;
    board[0]![1] = 2;
    const partial = cageStatus(cage, board);
    expect(partial.remaining).toBe(7);
    expect(partial.empty).toBe(1);
    // One cell left needing 7, and 1 and 2 are already in the cage.
    expect(partial.candidates).toEqual([[7]]);
  });

  it("reports no candidates for a finished cage", () => {
    const board: (number | null)[][] = Array.from({ length: 9 }, () => Array<number | null>(9).fill(null));
    board[0]![0] = 1;
    board[0]![1] = 3;
    board[1]![0] = 6;
    const done = cageStatus(cage, board);
    expect(done.remaining).toBe(0);
    expect(done.empty).toBe(0);
    expect(done.candidates).toEqual([]);
  });
});
