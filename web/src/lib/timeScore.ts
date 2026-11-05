/** Leaderboards rank higher scores first, so a solve time is posted as this base minus the seconds taken. */
export const TIME_SCORE_BASE = 100000;

/** The leaderboard score for a solve that took `seconds`: faster solves score higher. */
export function timeScore(seconds: number): number {
  return TIME_SCORE_BASE - seconds;
}
