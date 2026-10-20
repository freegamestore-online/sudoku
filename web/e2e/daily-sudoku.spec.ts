import { expect, test } from "@playwright/test";
import { dailySudokuPuzzle } from "../src/lib/dailySudoku";
import { dailyKey } from "../src/lib/daily";
import { assertNoHorizontalOverflow, listenForConsoleErrors, playSudoku, setTheme, start } from "./helpers";

for (const theme of ["light", "dark"] as const) {
  test(`daily Sudoku tiers work on a 390x844 phone in ${theme} mode`, async ({ page }) => {
    test.setTimeout(180_000);
    const checkConsole = listenForConsoleErrors(page);
    await start(page);
    await setTheme(page, theme);
    await page.getByRole("button", { name: "Daily Sudoku", exact: true }).click();
    await expect(page.getByRole("region", { name: "Daily stats" })).toContainText(/Daily Sudoku for \d{4}-\d{2}-\d{2} \(UTC\)/);
    await expect(page.getByText(/Next daily in \d+h \d+m \d+s/)).toBeVisible();
    await page.getByRole("button", { name: /^easy$/i }).click();
    await expect(page.locator("[data-row][data-col]")).toHaveCount(81);
    await assertNoHorizontalOverflow(page);
    await playSudoku(page, dailySudokuPuzzle(dailyKey(), "easy").solution);
    await expect(page.getByRole("region", { name: "Daily stats" })).toContainText("Completed in");
    await expect(page.getByRole("region", { name: "Daily stats" })).toContainText("0 hints");
    checkConsole();
  });
}
