import { generateKiller, MAX_CAGE_SIZE, type KillerPuzzle } from "./killer";
import { hashSeed, seededRandom } from "./random";

/** The one leaderboard board for Killer dailies. Platform must register this id. */
export const KILLER_DAILY_GAME_ID = "sudoku-killer-daily";

/** The calendar day in UTC, as `YYYY-MM-DD`. Every player sees the same key on the same UTC day. */
export function dailyKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Seed for the daily puzzle. Same day, same seed, same puzzle. */
export function dailySeed(key: string): string {
  return `sudoku:killer-daily:${key}`;
}

/** The Killer puzzle for a `YYYY-MM-DD` key. Computed on the client, no server. */
export function dailyKillerPuzzle(key: string): KillerPuzzle {
  return generateKiller(MAX_CAGE_SIZE, seededRandom(hashSeed(dailySeed(key))));
}
