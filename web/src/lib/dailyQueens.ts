import { generateQueens, type QueensPuzzle } from "./queens";
import { hashSeed } from "./random";

/** Board size for Queens. The layouts are unique and quick to generate at this size. */
export const QUEENS_N = 8;

/** The one leaderboard board for Queens dailies. Platform must register this id. */
export const QUEENS_DAILY_GAME_ID = "sudoku-queens-daily";

/** Seed for the daily Queens puzzle. Same day, same seed, same puzzle. */
export function dailyQueensSeed(key: string): string {
  return `sudoku:queens-daily:${key}`;
}

/** The Queens puzzle for a `YYYY-MM-DD` key. Computed on the client, no server. */
export function dailyQueensPuzzle(key: string): QueensPuzzle {
  return generateQueens(QUEENS_N, hashSeed(dailyQueensSeed(key)));
}
