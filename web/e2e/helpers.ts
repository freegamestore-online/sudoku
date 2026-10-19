import { expect, type Page } from "@playwright/test";
import { generateKiller, MAX_CAGE_SIZE } from "../src/lib/killer";
import { generateQueens } from "../src/lib/queens";
import { QUEENS_N } from "../src/lib/dailyQueens";
import { hashSeed, seededRandom } from "../src/lib/random";
import { generatePuzzle } from "../src/lib/sudoku";

export const SEED = "issue-3-phone";
const expectedBrowserNetworkNoise = [
  "CORS",
  "Access-Control-Allow-Origin",
  "ERR_FAILED",
  "Failed to load resource",
  "ERR_NETWORK_CHANGED",
];

export function listenForConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !expectedBrowserNetworkNoise.some((noise) => message.text().includes(noise))) {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return () => expect(errors, `browser console errors:\n${errors.join("\n")}`).toEqual([]);
}

export async function setTheme(page: Page, theme: "light" | "dark") {
  const control = page.getByRole("button", { name: /^Theme:/ });
  await expect(control).toBeVisible();
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await control.getAttribute("aria-label");
    if (current === `Theme: ${theme}`) return;
    await control.click();
  }
  await expect(control).toHaveAttribute("aria-label", `Theme: ${theme}`);
}

export async function assertNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.page, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.body, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport);
}

export async function start(page: Page) {
  await page.goto(`/?seed=${encodeURIComponent(SEED)}`);
  await expect(page.getByRole("button", { name: "Classic" })).toBeVisible();
}

export function classicSolution() {
  return generatePuzzle("easy", seededRandom(hashSeed(SEED))).solution;
}

export function killerSolution() {
  return generateKiller(MAX_CAGE_SIZE, seededRandom(hashSeed(SEED))).solution;
}

export function queensSolution() {
  return generateQueens(QUEENS_N, hashSeed(SEED)).solution;
}

export async function playSudoku(page: Page, solution: number[][], allowUndo = false) {
  const cells = page.locator("[data-row][data-col]");
  const count = await cells.count();
  expect(count).toBe(81);

  let didUndo = false;
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const cell = page.locator(`[data-row="${row}"][data-col="${col}"]`);
      if ((await cell.getAttribute("data-given")) === "true") continue;
      await cell.click();
      if (allowUndo && !didUndo) {
        const wrong = (solution[row]![col]! % 9) + 1;
        await page.keyboard.press(String(wrong));
        await expect(page.getByText("Errors", { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Undo move" })).toBeEnabled();
        await page.getByRole("button", { name: "Undo move" }).click();
        await expect(cell).toHaveAttribute("data-value", "");
        didUndo = true;
      }
      await cell.click();
      await page.keyboard.press(String(solution[row]![col]));
    }
  }
  await expect(page.getByText("Congratulations!", { exact: true })).toBeVisible({ timeout: 30_000 });
}

export async function playQueens(page: Page, solution: [number, number][], allowUndo = false) {
  const first = solution[0]!;
  const firstCell = page.getByRole("button", { name: new RegExp(`^Row ${first[0] + 1}, column ${first[1] + 1},`) });
  if (allowUndo) {
    await firstCell.click();
    await expect(firstCell).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Undo move" }).click();
    await expect(firstCell).toHaveAttribute("aria-pressed", "false");
  }

  // Use real DOM clicks for the remaining known solution cells. This sends the same
  // click events as a tap and lets React run its normal state and win-condition logic,
  // while avoiding repeated Playwright accessibility-tree searches for every move.
  // Re-add the first solution cell after the optional undo check above.
  const moves = solution.slice(0, -1);
  await page.evaluate((positions) => {
    for (const [row, col] of positions) {
      const cell = document.querySelector<HTMLButtonElement>(`[aria-label^="Row ${row + 1}, column ${col + 1},"]`);
      if (!cell) throw new Error(`Queens cell ${row + 1},${col + 1} not found`);
      cell.click();
    }
  }, moves);

  const [lastRow, lastCol] = solution.at(-1)!;
  await page.getByRole("button", { name: new RegExp(`^Row ${lastRow + 1}, column ${lastCol + 1},`) }).click();
  await expect(page.getByText("Congratulations!", { exact: true })).toBeVisible({ timeout: 30_000 });
}

export async function captureReference(page: Page, name: string) {
  await page.screenshot({ path: `e2e/reference/${name}.png`, animations: "disabled" });
}
