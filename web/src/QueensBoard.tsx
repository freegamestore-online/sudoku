import type { QueensPuzzle } from "./lib/queens";

/** One colour per region. Pastels, so the queens and the ink stay readable in light and dark. */
const REGION_COLOURS = ["#fca5a5", "#fdba74", "#fde047", "#86efac", "#93c5fd", "#c4b5fd", "#f9a8d4", "#5eead4", "#d6d3d1"];

interface QueensBoardProps {
  puzzle: QueensPuzzle;
  /** Queens placed by the player, as "row-col" keys. */
  placed: ReadonlySet<string>;
  /** Placed queens that break a rule, as "row-col" keys. */
  conflicts: ReadonlySet<string>;
  onToggle: (row: number, col: number) => void;
}

/**
 * The Queens grid. Each cell takes its region's colour. Region borders are drawn where
 * neighbours differ. A tap places or removes a queen, and conflicting queens are tinted red.
 */
export function QueensBoard({ puzzle, placed, conflicts, onToggle }: QueensBoardProps) {
  const { n, colors } = puzzle;

  return (
    <div
      className="grid w-full"
      style={{
        gridTemplateColumns: `repeat(${n}, 1fr)`,
        gridTemplateRows: `repeat(${n}, 1fr)`,
        aspectRatio: "1",
        border: "2px solid var(--line-strong)",
        borderRadius: "0.5rem",
        overflow: "hidden",
      }}
    >
      {colors.map((row, r) =>
        row.map((region, c) => {
          const key = `${r}-${c}`;
          const isQueen = placed.has(key);
          const isConflict = conflicts.has(key);
          const edge = (other: number | undefined) =>
            other !== undefined && other !== region ? "2px solid var(--ink)" : "1px solid rgba(0, 0, 0, 0.12)";
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggle(r, c)}
              aria-label={`Row ${r + 1}, column ${c + 1}, region ${region + 1}${isQueen ? ", queen" : ""}${isConflict ? ", conflict" : ""}`}
              aria-pressed={isQueen}
              className="flex items-center justify-center select-none"
              style={{
                background: REGION_COLOURS[region % REGION_COLOURS.length],
                boxShadow: isConflict ? "inset 0 0 0 3px var(--error)" : undefined,
                borderRight: c < n - 1 ? edge(colors[r]![c + 1]) : undefined,
                borderBottom: r < n - 1 ? edge(colors[r + 1]?.[c]) : undefined,
                // Fixed ink on the pastel regions: red text would clash with a red region in both themes.
                color: isConflict ? "#7f1d1d" : "#1a1a1a",
                fontSize: "clamp(1rem, 4vmin, 2rem)",
                cursor: "pointer",
              }}
            >
              {isQueen ? "♛" : null}
            </button>
          );
        }),
      )}
    </div>
  );
}
