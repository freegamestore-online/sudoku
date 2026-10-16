type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

/** The storage key for one game's daily post record. Each game keeps its own. */
export function dailyPostKey(game: string): string {
  return `sudoku:${game}-daily-posted`;
}

/** Whether this device has already posted a daily score for `game` on `key` (`YYYY-MM-DD`). */
export function hasPostedDaily(game: string, key: string, store?: KeyValueStore): boolean {
  try {
    return (store ?? localStorage).getItem(dailyPostKey(game)) === key;
  } catch {
    return false;
  }
}

/** Remember that this device posted for `game` on `key`. Storage being blocked only means it may post again. */
export function markPostedDaily(game: string, key: string, store?: KeyValueStore): void {
  try {
    (store ?? localStorage).setItem(dailyPostKey(game), key);
  } catch {
    // Nothing to do.
  }
}
