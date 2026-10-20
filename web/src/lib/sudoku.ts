import type { Board, CellValue, Difficulty, Notes } from "../types";

/** Reveal the solution value at a cell and clear its pencil marks. */
export function getHint(
  board: Board,
  notes: Notes,
  solution: number[][],
  row: number,
  col: number,
): { board: Board; notes: Notes; value: number } {
  const value = solution[row]![col]!;
  const nextBoard = board.map((line) => [...line]);
  nextBoard[row]![col] = value;
  const nextNotes = notes.map((line) => line.map((cellNotes) => new Set(cellNotes)));
  nextNotes[row]![col] = new Set();
  return { board: nextBoard, notes: nextNotes, value };
}

/** Fill pencil marks in every empty cell with digits allowed by its row, column and box. */
export function autoFillNotes(board: Board, notes?: Notes): Notes {
  return board.map((line, row) => line.map((cell, col) =>
    cell === null
      ? new Set([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((num) => isValidPlacement(board, row, col, num)))
      : new Set(notes?.[row]?.[col] ?? []),
  ));
}

/** Generate a complete valid 9x9 Sudoku grid using backtracking with randomized candidates. */
export function generateSolution(random: () => number = Math.random): number[][] {
  const board: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0) as number[]);

  function solve(pos: number): boolean {
    if (pos === 81) return true;
    const row = Math.floor(pos / 9);
    const col = pos % 9;

    const candidates = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
    for (const num of candidates) {
      if (canPlace(board, row, col, num)) {
        board[row]![col] = num;
        if (solve(pos + 1)) return true;
        board[row]![col] = 0;
      }
    }
    return false;
  }

  solve(0);
  return board;
}

/** Generate a puzzle by removing cells from a complete grid while keeping its solution unique. */
export function generatePuzzle(difficulty: Difficulty, random: () => number = Math.random): {
  puzzle: CellValue[][];
  solution: number[][];
} {
  const solution = generateSolution(random);
  const puzzle: CellValue[][] = solution.map((row) => [...row]);

  const cellsToRemove =
    difficulty === "easy" ? 35 : difficulty === "medium" ? 45 : 55;

  // Create a shuffled list of all 81 positions
  const positions = shuffle(
    Array.from({ length: 81 }, (_, i) => i), random,
  );

  let removed = 0;
  for (const pos of positions) {
    if (removed >= cellsToRemove) break;
    const row = Math.floor(pos / 9);
    const col = pos % 9;
    puzzle[row]![col] = null;
    if (countSolutions(puzzle, 2) === 1) removed++;
    else puzzle[row]![col] = solution[row]![col]!;
  }

  return { puzzle, solution };
}

/** Count Sudoku completions, stopping at `limit`; used to keep generated puzzles unique. */
export function countSolutions(board: CellValue[][], limit = 2): number {
  const grid = board.map((row) => row.map((value) => value ?? 0));
  let count = 0;

  function search(): void {
    if (count >= limit) return;
    let bestRow = -1;
    let bestCol = -1;
    let bestCandidates: number[] = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r]![c] !== 0) continue;
        const candidates = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) =>
          isValidPlacement(grid as CellValue[][], r, c, n),
        );
        if (candidates.length === 0) return;
        if (bestRow === -1 || candidates.length < bestCandidates.length) {
          bestRow = r;
          bestCol = c;
          bestCandidates = candidates;
          if (candidates.length === 1) break;
        }
      }
      if (bestCandidates.length === 1) break;
    }
    if (bestRow === -1) {
      count++;
      return;
    }
    for (const n of bestCandidates) {
      grid[bestRow]![bestCol] = n;
      search();
      grid[bestRow]![bestCol] = 0;
      if (count >= limit) return;
    }
  }

  search();
  return count;
}

/** Check if placing a number at (row, col) is valid (no conflicts in row/col/box). */
export function isValidPlacement(
  board: CellValue[][],
  row: number,
  col: number,
  num: number,
): boolean {
  // Check row
  for (let c = 0; c < 9; c++) {
    if (c !== col && board[row]![c] === num) return false;
  }
  // Check column
  for (let r = 0; r < 9; r++) {
    if (r !== row && board[r]![col] === num) return false;
  }
  // Check 3x3 box
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (r !== row && c !== col && board[r]![c] === num) return false;
    }
  }
  return true;
}

/** Check if the board is fully filled (no null cells). */
export function isBoardComplete(board: CellValue[][]): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r]![c] === null) return false;
    }
  }
  return true;
}

/** Check if the current board matches the solution exactly. */
export function checkSolution(board: CellValue[][], solution: number[][]): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r]![c] !== solution[r]![c]) return false;
    }
  }
  return true;
}

/**
 * The row, column and 3x3 box through (row, col) that are now fully filled with
 * the correct numbers. Call it after a correct placement; a group is only
 * returned when it is complete, so an unrelated complete group is never reported.
 */
export function completedRegions(
  board: CellValue[][],
  solution: number[][],
  row: number,
  col: number,
): [number, number][][] {
  const rowCells: [number, number][] = Array.from({ length: 9 }, (_, c) => [row, c]);
  const colCells: [number, number][] = Array.from({ length: 9 }, (_, r) => [r, col]);
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  const boxCells: [number, number][] = [];
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) boxCells.push([r, c]);
  }

  return [rowCells, colCells, boxCells].filter((group) =>
    group.every(([r, c]) => board[r]![c] === solution[r]![c]),
  );
}

// --- helpers ---

function canPlace(board: number[][], row: number, col: number, num: number): boolean {
  for (let c = 0; c < 9; c++) {
    if (board[row]![c] === num) return false;
  }
  for (let r = 0; r < 9; r++) {
    if (board[r]![col] === num) return false;
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (board[r]![c] === num) return false;
    }
  }
  return true;
}

/** Fisher-Yates shuffle. `random` returns values in [0, 1), so a seeded source gives the same order every time. */
export function shuffle<T>(arr: T[], random: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
