import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { hasPostedDaily, markPostedDaily } from "./dailyPost";

// Keys a player's browser could still hold from earlier builds, or from another game on this origin.
// The first release read "sudoku-player-name" when a win was submitted and never wrote it. Nothing
// in the game has ever saved a board, so these are stale values with no current meaning.
const OLD_KEYS: Record<string, string> = {
  "sudoku-player-name": "Ada",
  sudoku_save: JSON.stringify({ difficulty: "hard", board: [[1, null]], timer: 120 }),
  sudoku_progress: JSON.stringify({ version: 1 }),
};

const SRC = resolve(__dirname, "..");

/** Every TypeScript source file under src, except the test files, as [path, text]. */
function sourceFiles(dir: string): [string, string][] {
  return readdirSync(dir).flatMap((name): [string, string][] => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (!/\.(ts|tsx)$/.test(name) || /\.test\./.test(name)) return [];
    return [[relative(SRC, path), readFileSync(path, "utf-8")]];
  });
}

describe("old saves", () => {
  beforeEach(() => {
    localStorage.clear();
    for (const [key, value] of Object.entries(OLD_KEYS)) localStorage.setItem(key, value);
  });

  it("boots and posts without reading any old key as a score or a save", () => {
    // Stale values must not count as a posted day, so the first real win still posts.
    expect(hasPostedDaily("killer", "2026-10-16")).toBe(false);
    expect(hasPostedDaily("queens", "2026-10-16")).toBe(false);
  });

  it("leaves every old key as it was", () => {
    markPostedDaily("killer", "2026-10-16");
    for (const [key, value] of Object.entries(OLD_KEYS)) {
      expect(localStorage.getItem(key)).toBe(value);
    }
  });

  it("writes only its own sudoku: keys", () => {
    markPostedDaily("killer", "2026-10-16");
    const added = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!).filter(
      (key) => !(key in OLD_KEYS),
    );
    expect(added).toEqual(["sudoku:killer-daily-posted"]);
  });

  it("no source file still reads the first release's player-name key", () => {
    const readers = sourceFiles(SRC).filter(([, text]) => text.includes("sudoku-player-name"));
    expect(readers).toEqual([]);
  });

  it("storage users namespace every key under sudoku:", () => {
    const users = sourceFiles(SRC).filter(([, text]) => /localStorage|sessionStorage/.test(text));
    expect(users.map(([file]) => file).sort()).toEqual(["lib/dailyPost.ts", "lib/dailySudoku.ts"]);
    expect(readFileSync(resolve(SRC, "lib/dailyPost.ts"), "utf-8")).toContain("`sudoku:${game}-daily-posted`");
    expect(readFileSync(resolve(SRC, "lib/dailySudoku.ts"), "utf-8")).toContain('"sudoku:daily-sudoku-results"');
  });
});
