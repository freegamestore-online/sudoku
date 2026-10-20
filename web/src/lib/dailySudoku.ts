import { generatePuzzle } from "./sudoku";
import { hashSeed, seededRandom } from "./random";
import type { Difficulty } from "../types";

export const DAILY_DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
export type DailySudokuResult = { date: string; difficulty: Difficulty; time: number; hints: number };
const puzzles = new Map<string, ReturnType<typeof generatePuzzle>>();
const RESULTS_KEY = "sudoku:daily-sudoku-results";

export function dailySudokuSeed(date: string, difficulty: Difficulty): string {
  return `sudoku:classic-daily:${date}:${difficulty}`;
}

export function dailySudokuPuzzle(date: string, difficulty: Difficulty) {
  const key = dailySudokuSeed(date, difficulty);
  let puzzle = puzzles.get(key);
  if (!puzzle) {
    puzzle = generatePuzzle(difficulty, seededRandom(hashSeed(key)));
    puzzles.set(key, puzzle);
  }
  return puzzle;
}

function readResults(store: Storage): DailySudokuResult[] {
  try {
    const value: unknown = JSON.parse(store.getItem(RESULTS_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is DailySudokuResult =>
      item && typeof item.date === "string" && DAILY_DIFFICULTIES.includes(item.difficulty) &&
      Number.isFinite(item.time) && Number.isFinite(item.hints),
    ) : [];
  } catch { return []; }
}

export function dailySudokuResults(store: Storage = localStorage): DailySudokuResult[] {
  return readResults(store);
}

export function recordDailySudokuResult(result: DailySudokuResult, store: Storage = localStorage): void {
  const results = readResults(store).filter((item) => !(item.date === result.date && item.difficulty === result.difficulty));
  store.setItem(RESULTS_KEY, JSON.stringify([...results, result]));
}
