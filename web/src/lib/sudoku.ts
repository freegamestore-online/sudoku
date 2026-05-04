import type { CellValue, Difficulty } from "../types";

/** Generate a complete valid 9x9 Sudoku grid using backtracking with randomized candidates. */
export function generateSolution(): number[][] {
  const board: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0) as number[]);

  function solve(pos: number): boolean {
    if (pos === 81) return true;
    const row = Math.floor(pos / 9);
    const col = pos % 9;

    const candidates = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
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

/** Generate a puzzle by removing cells from a complete grid. */
export function generatePuzzle(difficulty: Difficulty): {
  puzzle: CellValue[][];
  solution: number[][];
} {
  const solution = generateSolution();
  const puzzle: CellValue[][] = solution.map((row) => [...row]);

  const cellsToRemove =
    difficulty === "easy" ? 35 : difficulty === "medium" ? 45 : 55;

  // Create a shuffled list of all 81 positions
  const positions = shuffle(
    Array.from({ length: 81 }, (_, i) => i),
  );

  let removed = 0;
  for (const pos of positions) {
    if (removed >= cellsToRemove) break;
    const row = Math.floor(pos / 9);
    const col = pos % 9;
    puzzle[row]![col] = null;
    removed++;
  }

  return { puzzle, solution };
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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
