import { seededRandom } from "./random";

/**
 * A Queens puzzle: an N×N grid where every cell has a colour region (0..N-1). The
 * solution puts one queen in each row, column and region, with no two queens touching,
 * including diagonally.
 */
export interface QueensPuzzle {
  n: number;
  /** colors[row][col] is the region the cell belongs to. */
  colors: number[][];
  /** The unique solution: one [row, col] per row, in row order. */
  solution: [number, number][];
}

/** Fresh starts before giving up. Each start is a random solution with grown regions, then refined. */
const MAX_ATTEMPTS = 20;
/** Recolouring steps per start. Random layouts are rarely unique, so refinement does the work. */
const MAX_REFINE_STEPS = 4000;

/**
 * Generate a Queens puzzle with a unique solution, from `seed`. The same seed always gives
 * the same puzzle, so a date can seed the daily. Throws only if no unique layout is found in
 * MAX_ATTEMPTS, which the tests check does not happen for the sizes used.
 */
export function generateQueens(n: number, seed: number): QueensPuzzle {
  const random = seededRandom(seed);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const solution = randomSolution(n, random);
    const colors = growRegions(n, solution, random);
    if (refineToUnique(colors, solution, random)) return { n, colors, solution };
  }
  throw new Error(`No unique Queens layout found for n=${n}`);
}

/**
 * Recolour cells that are not solution queens, one at a time, to cut the number of
 * solutions to one. A move is kept when it does not raise the count and leaves both
 * regions connected. The solution queens keep their colours, so the seed solution always
 * stays valid. Returns true when the layout ends up unique.
 */
function refineToUnique(colors: number[][], solution: [number, number][], random: () => number): boolean {
  const n = colors.length;
  const queenCells = new Set(solution.map(([r, c]) => `${r}-${c}`));
  let count = solveQueens(colors, 3).length;

  for (let step = 0; step < MAX_REFINE_STEPS && count > 1; step++) {
    const r = Math.floor(random() * n);
    const c = Math.floor(random() * n);
    if (queenCells.has(`${r}-${c}`)) continue;

    const old = colors[r]![c]!;
    const options = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dr, dc]) => colors[r + dr!]?.[c + dc!])
      .filter((color): color is number => color !== undefined && color !== old);
    if (options.length === 0) continue;

    const next = options[Math.floor(random() * options.length)]!;
    colors[r]![c] = next;
    if (!regionIsConnected(colors, old)) {
      colors[r]![c] = old;
      continue;
    }

    const after = solveQueens(colors, 3).length;
    if (after <= count) {
      count = after;
    } else {
      colors[r]![c] = old;
    }
  }

  return count === 1;
}

/** Whether every cell of `color` is reachable from every other, through cells of the same colour. */
function regionIsConnected(colors: number[][], color: number): boolean {
  const n = colors.length;
  let start: [number, number] | null = null;
  let total = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (colors[r]![c] !== color) continue;
      total++;
      start ??= [r, c];
    }
  }
  if (!start) return false;

  const seen = new Set<string>([`${start[0]}-${start[1]}`]);
  const queue: [number, number][] = [start];
  while (queue.length > 0) {
    const [r, c] = queue.pop()!;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nr = r + dr;
      const nc = c + dc;
      const key = `${nr}-${nc}`;
      if (nr < 0 || nr >= n || nc < 0 || nc >= n || seen.has(key) || colors[nr]![nc] !== color) continue;
      seen.add(key);
      queue.push([nr, nc]);
    }
  }
  return seen.size === total;
}

/**
 * Every placement that fits the regions: one queen per row, column and region, no two touching.
 * Stops after `limit` solutions, so the caller can ask "is there exactly one?" cheaply.
 */
export function solveQueens(colors: number[][], limit = 2): [number, number][][] {
  const n = colors.length;
  const usedCol = Array<boolean>(n).fill(false);
  const usedColor = Array<boolean>(n).fill(false);
  const placed: [number, number][] = [];
  const found: [number, number][][] = [];

  function search(row: number) {
    if (found.length >= limit) return;
    if (row === n) {
      found.push([...placed]);
      return;
    }
    for (let col = 0; col < n; col++) {
      const region = colors[row]![col]!;
      if (usedCol[col] || usedColor[region]) continue;
      // A queen in the row above must not be next to this one, diagonals included.
      const prev = placed[row - 1];
      if (prev && Math.abs(prev[1] - col) <= 1) continue;

      usedCol[col] = true;
      usedColor[region] = true;
      placed.push([row, col]);
      search(row + 1);
      placed.pop();
      usedCol[col] = false;
      usedColor[region] = false;
    }
  }

  search(0);
  return found;
}

/**
 * Queens that break a rule: sharing a row, column or region with another queen, or touching
 * one. Returns the conflicting queens as "row-col" keys, for highlighting.
 */
export function queensConflicts(colors: number[][], queens: readonly [number, number][]): Set<string> {
  const conflicts = new Set<string>();
  for (let i = 0; i < queens.length; i++) {
    for (let j = i + 1; j < queens.length; j++) {
      const [r1, c1] = queens[i]!;
      const [r2, c2] = queens[j]!;
      const sameRegion = colors[r1]![c1] === colors[r2]![c2];
      const touching = Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1;
      if (r1 === r2 || c1 === c2 || sameRegion || touching) {
        conflicts.add(`${r1}-${c1}`);
        conflicts.add(`${r2}-${c2}`);
      }
    }
  }
  return conflicts;
}

/** A random placement with one queen per row, no two in adjacent columns. Columns are tried in random order. */
function randomSolution(n: number, random: () => number): [number, number][] {
  const usedCol = Array<boolean>(n).fill(false);
  const placed: [number, number][] = [];

  function search(row: number): boolean {
    if (row === n) return true;
    const order = shuffleInts(n, random);
    for (const col of order) {
      if (usedCol[col]) continue;
      const prev = placed[row - 1];
      if (prev && Math.abs(prev[1] - col) <= 1) continue;
      usedCol[col] = true;
      placed.push([row, col]);
      if (search(row + 1)) return true;
      placed.pop();
      usedCol[col] = false;
    }
    return false;
  }

  search(0);
  return placed;
}

/**
 * Grow one connected region from each solution queen until every cell has a colour. Each
 * step takes a random cell from the frontier, so regions come out irregular and varied.
 */
function growRegions(n: number, solution: [number, number][], random: () => number): number[][] {
  const colors: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(-1));
  const frontier: [number, number, number][] = [];

  const expand = (r: number, c: number, color: number) => {
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < n && nc >= 0 && nc < n && colors[nr]![nc] === -1) {
        frontier.push([nr, nc, color]);
      }
    }
  };

  solution.forEach(([r, c], color) => {
    colors[r]![c] = color;
    expand(r, c, color);
  });

  while (frontier.length > 0) {
    const index = Math.floor(random() * frontier.length);
    const [r, c, color] = frontier[index]!;
    frontier[index] = frontier[frontier.length - 1]!;
    frontier.pop();
    if (colors[r]![c] !== -1) continue;
    colors[r]![c] = color;
    expand(r, c, color);
  }

  return colors;
}

function shuffleInts(n: number, random: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
