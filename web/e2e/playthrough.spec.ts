import { expect, test } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  captureReference,
  classicSolution,
  killerSolution,
  listenForConsoleErrors,
  playQueens,
  playSudoku,
  queensSolution,
  setTheme,
  start,
} from "./helpers";

const sudokuModes = [
  { label: "Classic", solution: classicSolution, screenshot: "classic" },
  { label: "Killer", solution: killerSolution, screenshot: "killer" },
] as const;

for (const theme of ["light", "dark"] as const) {
  for (const mode of sudokuModes) {
    test(`${mode.label} completes on a 390x844 phone in ${theme} mode`, async ({ page }) => {
      const checkConsole = listenForConsoleErrors(page);
      await start(page);
      await setTheme(page, theme);
      await page.getByRole("button", { name: mode.label, exact: true }).click();
      await expect(page.locator("[data-row][data-col]")).toHaveCount(81);
      await assertNoHorizontalOverflow(page);
      await captureReference(page, `${mode.screenshot}-${theme}`);
      await playSudoku(page, mode.solution(), true);
      await expect(page.getByText("Time", { exact: true })).toBeVisible();
      await expect(page.getByText("Errors", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Leaderboard" }).click();
      await expect(page.getByRole("region", { name: "Leaderboard" })).toBeVisible();
      await assertNoHorizontalOverflow(page);
      checkConsole();
    });
  }

  test(`Queens completes on a 390x844 phone in ${theme} mode`, async ({ page }) => {
    test.setTimeout(180_000);
    const checkConsole = listenForConsoleErrors(page);
    await start(page);
    await setTheme(page, theme);
    await page.getByRole("button", { name: "Queens", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Row 1, column 1,/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Row 1, column / })).toHaveCount(8);
    await assertNoHorizontalOverflow(page);
    await captureReference(page, `queens-${theme}`);
    await playQueens(page, queensSolution(), true);
    await page.getByRole("button", { name: "Leaderboard" }).click();
    await expect(page.getByRole("region", { name: "Leaderboard" })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    checkConsole();
  });
}

test("daily games start with a UTC date label", async ({ page }) => {
  const checkConsole = listenForConsoleErrors(page);
  await start(page);
  await page.getByRole("button", { name: "Daily Killer", exact: true }).click();
  await expect(page.getByText(/^Daily Killer for \d{4}-\d{2}-\d{2} \(UTC\)$/)).toBeVisible({ timeout: 30_000 });
  await assertNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Daily Queens", exact: true }).click();
  await expect(page.getByText(/^Daily Queens for \d{4}-\d{2}-\d{2} \(UTC\)$/)).toBeVisible();
  checkConsole();
});
