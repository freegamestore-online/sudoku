import { generateSolution } from "./sudoku";

/** A group of cells whose digits must be distinct and add up to `sum`. */
export interface Cage {
  cells: [number, number][];
  sum: number;
}

export interface KillerPuzzle {
  cages: Cage[];
  /** The one solution the cages were built from. */
  solution: number[][];
}

/**
 * Largest cage the generator will build. Cages of 4 or more cells make the solver's
 * uniqueness proof slow (seconds to minutes in testing), so the generator stops at 3.
 */
export const MAX_CAGE_SIZE = 3;

/** Every row, column and 3x3 box, as lists of cells. The solver checks each one for hidden singles. */
const UNITS: [number, number][][] = [
  ...Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c): [number, number] => [r, c])),
  ...Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r): [number, number] => [r, c])),
  ...Array.from({ length: 9 }, (_, b) =>
    Array.from({ length: 9 }, (_, i): [number, number] => [
      Math.floor(b / 3) * 3 + Math.floor(i / 3),
      (b % 3) * 3 + (i % 3),
    ]),
  ),
];

/**
 * Every set of `size` distinct digits from 1-9 that adds up to `sum`, each in
 * ascending order. This is the candidate list for a cage with that sum and size.
 */
export function cageCombinations(sum: number, size: number): number[][] {
  const out: number[][] = [];
  const pick = (start: number, left: number, remaining: number, chosen: number[]) => {
    if (left === 0) {
      if (remaining === 0) out.push([...chosen]);
      return;
    }
    for (let digit = start; digit <= 9; digit++) {
      // Digits only grow, so once one is too big every later one is too.
      if (remaining < digit) break;
      chosen.push(digit);
      pick(digit + 1, left - 1, remaining - digit, chosen);
      chosen.pop();
    }
  };
  pick(1, size, sum, []);
  return out;
}

/**
 * Find solutions to a Killer puzzle, stopping at `limit`. A result of one solution
 * means the cages pin the grid down. Forced moves (naked and hidden singles) are
 * placed before any guess, so unique puzzles are proven quickly.
 */
export function solveKiller(cages: Cage[], limit = 2): number[][][] {
  const cageOf: number[][] = Array.from({ length: 9 }, () => Array<number>(9).fill(-1));
  cages.forEach((cage, i) => {
    for (const [r, c] of cage.cells) cageOf[r]![c] = i;
  });

  const grid: number[][] = Array.from({ length: 9 }, () => Array<number>(9).fill(0));
  // Bit d is set when digit d is used. Digits 1-9 map to bits 1-9.
  const rowMask = Array<number>(9).fill(0);
  const colMask = Array<number>(9).fill(0);
  const boxMask = Array<number>(9).fill(0);
  const cageMask = cages.map(() => 0);
  const cageLeft = cages.map((cage) => cage.cells.length);
  const cageSumLeft = cages.map((cage) => cage.sum);
  const solutions: number[][][] = [];
  // Memo for cageAllowed, keyed by (sum left, cells left, digits already in the cage).
  const allowedMemo = new Map<number, number>();

  /**
   * Bit mask of the digits that can still go in a cage with `left` empty cells and
   * `sum` left to fill, given the digits already in it. A digit is allowed when some
   * set of `left` unused digits that adds up to `sum` contains it.
   */
  function cageAllowed(sum: number, left: number, mask: number): number {
    const key = (sum * 16 + left) * 1024 + mask;
    const cached = allowedMemo.get(key);
    if (cached !== undefined) return cached;
    let allowed = 0;
    for (const combo of cageCombinations(sum, left)) {
      if (combo.some((d) => mask & (1 << d))) continue;
      for (const d of combo) allowed |= 1 << d;
    }
    allowedMemo.set(key, allowed);
    return allowed;
  }

  /** Bit mask of the digits that can go in an empty cell, given the row, column, box and cage. */
  function candidateMask(r: number, c: number): number {
    const box = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    const cage = cageOf[r]![c]!;
    const used = rowMask[r]! | colMask[c]! | boxMask[box]! | cageMask[cage]!;
    const allowed = cageAllowed(cageSumLeft[cage]!, cageLeft[cage]!, cageMask[cage]!);
    return allowed & ~used & 0x3fe;
  }

  function place(r: number, c: number, d: number, on: boolean) {
    const box = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    const cage = cageOf[r]![c]!;
    const bit = 1 << d;
    grid[r]![c] = on ? d : 0;
    rowMask[r] = on ? rowMask[r]! | bit : rowMask[r]! & ~bit;
    colMask[c] = on ? colMask[c]! | bit : colMask[c]! & ~bit;
    boxMask[box] = on ? boxMask[box]! | bit : boxMask[box]! & ~bit;
    cageMask[cage] = on ? cageMask[cage]! | bit : cageMask[cage]! & ~bit;
    cageLeft[cage] = cageLeft[cage]! + (on ? -1 : 1);
    cageSumLeft[cage] = cageSumLeft[cage]! + (on ? -d : d);
  }

  /**
   * One forced move: a cell with a single candidate, or a digit with a single
   * place in some row, column or box. 'dead' means a contradiction. null means none.
   */
  function findForced(): [number, number, number] | "dead" | null {
    const masks = grid.map((row, r) => row.map((v, c) => (v === 0 ? candidateMask(r, c) : 0)));
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r]![c] !== 0) continue;
        const mask = masks[r]![c]!;
        if (mask === 0) return "dead";
        if ((mask & (mask - 1)) === 0) return [r, c, Math.log2(mask)];
      }
    }
    for (const unit of UNITS) {
      for (let d = 1; d <= 9; d++) {
        let placedInUnit = false;
        let count = 0;
        let at: [number, number] = [0, 0];
        for (const [r, c] of unit) {
          if (grid[r]![c] === d) {
            placedInUnit = true;
            break;
          }
          if (grid[r]![c] === 0 && masks[r]![c]! & (1 << d)) {
            count++;
            at = [r, c];
          }
        }
        if (placedInUnit) continue;
        if (count === 0) return "dead";
        if (count === 1) return [at[0], at[1], d];
      }
    }
    return null;
  }

  function search() {
    if (solutions.length >= limit) return;

    // Apply forced moves until none are left, remembering them so they can be undone.
    const placed: [number, number, number][] = [];
    const undo = () => {
      while (placed.length > 0) {
        const [r, c, d] = placed.pop()!;
        place(r, c, d, false);
      }
    };
    for (;;) {
      const forced = findForced();
      if (forced === "dead") {
        undo();
        return;
      }
      if (forced === null) break;
      place(forced[0], forced[1], forced[2], true);
      placed.push(forced);
    }

    // Guess in the empty cell with the fewest candidates.
    let bestR = -1;
    let bestC = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r]![c] !== 0) continue;
        const mask = candidateMask(r, c);
        const count = popcount(mask);
        if (count < bestCount) {
          bestR = r;
          bestC = c;
          bestMask = mask;
          bestCount = count;
        }
      }
    }
    if (bestR === -1) {
      solutions.push(grid.map((row) => [...row]));
    } else {
      for (let d = 1; d <= 9; d++) {
        if (!(bestMask & (1 << d))) continue;
        place(bestR, bestC, d, true);
        search();
        place(bestR, bestC, d, false);
        if (solutions.length >= limit) break;
      }
    }
    undo();
  }

  search();
  return solutions;
}

/**
 * Build a Killer puzzle with no givens and exactly one solution. It starts with one
 * cage per cell, which is trivially unique, and merges adjacent cages while the
 * solver still finds one solution. Each merge needs distinct digits in the
 * combined cage and at most `maxCageSize` cells.
 */
export function generateKiller(maxCageSize = MAX_CAGE_SIZE): KillerPuzzle {
  const solution = generateSolution();
  const cageOf: number[][] = Array.from({ length: 9 }, (_, r) =>
    Array.from({ length: 9 }, (_, c) => r * 9 + c),
  );
  const members = new Map<number, [number, number][]>();
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) members.set(r * 9 + c, [[r, c]]);
  }

  const buildCages = (): Cage[] =>
    [...members.values()].map((cells) => ({
      cells,
      sum: cells.reduce((total, [r, c]) => total + solution[r]![c]!, 0),
    }));

  let merged = true;
  while (merged) {
    merged = false;
    for (const [a, b] of shuffle(adjacentCagePairs(cageOf))) {
      const cellsA = members.get(a);
      const cellsB = members.get(b);
      if (!cellsA || !cellsB) continue; // one of them was merged away earlier in this pass
      const size = cellsA.length + cellsB.length;
      if (size > maxCageSize) continue;
      const digits = new Set([...cellsA, ...cellsB].map(([r, c]) => solution[r]![c]));
      if (digits.size !== size) continue;

      members.set(a, [...cellsA, ...cellsB]);
      members.delete(b);
      for (const [r, c] of cellsB) cageOf[r]![c] = a;

      if (solveKiller(buildCages(), 2).length === 1) {
        merged = true;
      } else {
        members.set(a, cellsA);
        members.set(b, cellsB);
        for (const [r, c] of cellsB) cageOf[r]![c] = b;
      }
    }
  }

  return { cages: buildCages(), solution };
}

function popcount(mask: number): number {
  let count = 0;
  for (let m = mask; m; m &= m - 1) count++;
  return count;
}

/** Every pair of different cages that touch orthogonally, each pair listed once. */
function adjacentCagePairs(cageOf: number[][]): [number, number][] {
  const seen = new Set<string>();
  const pairs: [number, number][] = [];
  const add = (x: number, y: number) => {
    if (x === y) return;
    const key = x < y ? `${x}-${y}` : `${y}-${x}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push([x, y]);
  };
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (c < 8) add(cageOf[r]![c]!, cageOf[r]![c + 1]!);
      if (r < 8) add(cageOf[r]![c]!, cageOf[r + 1]![c]!);
    }
  }
  return pairs;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
