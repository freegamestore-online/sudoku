import { expect, test } from "@playwright/test";
import { assertNoHorizontalOverflow, classicSolution, listenForConsoleErrors, setTheme, start } from "./helpers";

for (const theme of ["light", "dark"] as const) {
  test(`hint and auto-fill work on a 390x844 phone in ${theme} mode`, async ({ page }) => {
    const checkConsole = listenForConsoleErrors(page);
    await start(page);
    await setTheme(page, theme);

    const hintButton = page.getByRole("button", { name: "Hint", exact: true });
    const autoFillButton = page.getByRole("button", { name: "Auto-fill notes", exact: true });
    await expect(hintButton).toBeVisible();
    await expect(autoFillButton).toBeVisible();
    await expect(hintButton).toBeDisabled();

    const emptyCells = page.locator('[data-row][data-col][data-given="false"]');
    const hintCell = emptyCells.first();
    const row = Number(await hintCell.getAttribute("data-row"));
    const col = Number(await hintCell.getAttribute("data-col"));
    await hintCell.click();
    await expect(hintButton).toBeEnabled();
    await assertNoHorizontalOverflow(page);
    await hintButton.click();
    await expect(hintCell).toHaveAttribute("data-value", String(classicSolution()[row]![col]));
    await expect(page.getByText("Hints", { exact: true }).locator("..")).toContainText("1");

    await autoFillButton.click();
    const nextEmpty = page.locator('[data-row][data-col][data-given="false"][data-value=""]').first();
    const nextRow = Number(await nextEmpty.getAttribute("data-row"));
    const nextCol = Number(await nextEmpty.getAttribute("data-col"));
    await expect(nextEmpty.locator("span").filter({ hasText: /\d/ })).not.toHaveCount(0);
    await nextEmpty.click();
    const displayedNotes = nextEmpty.locator("span").filter({ hasText: /\d/ });
    await expect(displayedNotes).not.toHaveCount(0);
    const expectedCandidate = classicSolution()[nextRow]![nextCol]!;
    await expect(nextEmpty.locator("span").filter({ hasText: String(expectedCandidate) })).toHaveCount(1);
    await assertNoHorizontalOverflow(page);
    checkConsole();
  });
}
