import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueensBoard } from "./QueensBoard";
import { generateQueens } from "./lib/queens";

describe("QueensBoard", () => {
  const puzzle = generateQueens(6, 5);
  const [qr, qc] = puzzle.solution[0]!;

  it("draws one cell per square, labelled with its region", () => {
    render(<QueensBoard puzzle={puzzle} placed={new Set()} conflicts={new Set()} onToggle={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(36);
    expect(screen.getByLabelText(`Row ${qr + 1}, column ${qc + 1}, region ${puzzle.colors[qr]![qc]! + 1}`)).toBeTruthy();
  });

  it("reports a tap with the cell's row and column", () => {
    const onToggle = vi.fn();
    render(<QueensBoard puzzle={puzzle} placed={new Set()} conflicts={new Set()} onToggle={onToggle} />);
    fireEvent.click(screen.getByLabelText(new RegExp(`Row ${qr + 1}, column ${qc + 1},`)));
    expect(onToggle).toHaveBeenCalledWith(qr, qc);
  });

  it("marks placed queens and conflicts in the label", () => {
    const key = `${qr}-${qc}`;
    render(<QueensBoard puzzle={puzzle} placed={new Set([key])} conflicts={new Set([key])} onToggle={() => {}} />);
    const cell = screen.getByLabelText(/queen, conflict/);
    expect(cell.getAttribute("aria-pressed")).toBe("true");
    expect(cell.textContent).toBe("♛");
  });
});
