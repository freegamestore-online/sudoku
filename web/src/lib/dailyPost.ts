export const KILLER_DAILY_POSTED_KEY = "sudoku:killer-daily-posted";

type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

/** Whether this device has already posted a Killer daily score for `key` (`YYYY-MM-DD`). */
export function hasPostedKillerDaily(key: string, store?: KeyValueStore): boolean {
  try {
    return (store ?? localStorage).getItem(KILLER_DAILY_POSTED_KEY) === key;
  } catch {
    return false;
  }
}

/** Remember that this device posted for `key`. Storage being blocked only means it may post again. */
export function markPostedKillerDaily(key: string, store?: KeyValueStore): void {
  try {
    (store ?? localStorage).setItem(KILLER_DAILY_POSTED_KEY, key);
  } catch {
    // Nothing to do.
  }
}
