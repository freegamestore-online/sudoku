import { useCallback, useEffect, useRef, useState } from "react";
import { GameShell, GameTopbar, GameAuth, useGameSounds } from "@freegamestore/games";
import { useLeaderboard } from '@freegamestore/games';

type SoundsApi = ReturnType<typeof useGameSounds>;

function AudioBridge({ apiRef }: { apiRef: React.MutableRefObject<SoundsApi | null> }) {
  const sounds = useGameSounds();
  apiRef.current = sounds;
  return null;
}

import { generatePuzzle, checkSolution, completedRegions, isBoardComplete } from "./lib/sudoku";
import { Celebration, ParticleLayer, prefersReducedMotion, type ParticleLayerHandle } from "./feel";
import type { Board, Difficulty, Notes } from "./types";

/** How long a completed row, column or box keeps its shimmer, in ms. Matches the CSS animation. */
const SHIMMER_MS = 700;
const ACCENT_HEX = "#2563eb";
const SUCCESS_HEX = "#16a34a";

function createEmptyNotes(): Notes {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => new Set<number>()),
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function App() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [board, setBoard] = useState<Board>([]);
  const [solution, setSolution] = useState<number[][]>([]);
  const [givens, setGivens] = useState<boolean[][]>([]);
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [notes, setNotes] = useState<Notes>(createEmptyNotes);
  const [timer, setTimer] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const [errors, setErrors] = useState(0);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [solveBurst, setSolveBurst] = useState<string | null>(null);
  const [shimmering, setShimmering] = useState<ReadonlySet<string>>(() => new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const particleRef = useRef<ParticleLayerHandle>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const { submitScore } = useLeaderboard("sudoku");
  const audioRef = useRef<SoundsApi | null>(null);

  const startNewGame = useCallback((diff: Difficulty) => {
    const { puzzle, solution: sol } = generatePuzzle(diff);
    setBoard(puzzle.map((row) => [...row]));
    setSolution(sol);
    setGivens(puzzle.map((row) => row.map((cell) => cell !== null)));
    setSelectedCell(null);
    setNotesMode(false);
    setNotes(createEmptyNotes());
    setTimer(0);
    setGameWon(false);
    setErrors(0);
    setScoreSubmitted(false);
    setDifficulty(diff);
  }, []);

  // Start first game
  useEffect(() => {
    startNewGame("easy");
  }, [startNewGame]);

  // Timer
  useEffect(() => {
    if (gameWon || board.length === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameWon, board.length]);

  // Check win condition
  useEffect(() => {
    if (board.length === 0 || gameWon) return;
    if (isBoardComplete(board) && checkSolution(board, solution)) {
      setGameWon(true);
      // The celebration plays its own level-up sound.
      setSolveBurst("solve");
    }
  }, [board, solution, gameWon]);

  // Submit score on win
  useEffect(() => {
    if (gameWon && !scoreSubmitted) {
      setScoreSubmitted(true);
      submitScore(timer);
    }
  }, [gameWon, scoreSubmitted, timer, submitScore]);

  const handleCellClick = useCallback((row: number, col: number) => {
    setSelectedCell([row, col]);
  }, []);

  const endSolveBurst = useCallback(() => setSolveBurst(null), []);

  /** Centre of a cell in the particle layer's pixel space, which covers the whole grid. */
  function cellCentre(row: number, col: number): [number, number] {
    const { width, height } = boardRef.current?.getBoundingClientRect() ?? { width: 0, height: 0 };
    return [((col + 0.5) * width) / 9, ((row + 0.5) * height) / 9];
  }

  /** Small burst where a correct number lands. The layer skips it under reduced motion. */
  function popCell(row: number, col: number) {
    const [x, y] = cellCentre(row, col);
    particleRef.current?.burst(x, y, [ACCENT_HEX], { count: 10, speed: [120, 260], size: [3, 5], life: 0.45 });
  }

  /** Shimmer and burst for each row, column or box that a correct number just finished. */
  function celebrateRegions(groups: [number, number][][]) {
    for (const group of groups) {
      const [sumRow, sumCol] = group.reduce<[number, number]>(
        ([r, c], [gr, gc]) => [r + gr, c + gc],
        [0, 0],
      );
      const [x, y] = cellCentre(sumRow / group.length, sumCol / group.length);
      particleRef.current?.burst(x, y, [SUCCESS_HEX, ACCENT_HEX], {
        count: 18,
        speed: [160, 340],
        size: [3, 6],
        life: 0.7,
      });
    }
    if (prefersReducedMotion()) return;
    const keys = groups.flat().map(([r, c]) => `${r}-${c}`);
    setShimmering((prev) => new Set([...prev, ...keys]));
    window.setTimeout(() => {
      setShimmering((prev) => {
        const next = new Set(prev);
        for (const key of keys) next.delete(key);
        return next;
      });
    }, SHIMMER_MS);
  }

  const handleNumberInput = useCallback(
    (num: number) => {
      if (!selectedCell || gameWon) return;
      const [row, col] = selectedCell;
      if (givens[row]?.[col]) return;

      if (notesMode) {
        setNotes((prev) => {
          const next = prev.map((r) => r.map((s) => new Set(s)));
          const cellNotes = next[row]![col]!;
          if (cellNotes.has(num)) {
            cellNotes.delete(num);
          } else {
            cellNotes.add(num);
          }
          return next;
        });
      } else {
        const wasNum = board[row]?.[col];
        const nextBoard = board.map((r) => [...r]);
        nextBoard[row]![col] = num;
        setBoard(nextBoard);
        // Clear notes for this cell when placing a number
        setNotes((prev) => {
          const next = prev.map((r) => r.map((s) => new Set(s)));
          next[row]![col] = new Set();
          return next;
        });
        // Check if wrong
        if (solution[row]?.[col] !== num) {
          setErrors((e) => e + 1);
          audioRef.current?.playError();
        } else {
          audioRef.current?.playTick();
          // Re-entering the same correct number is not a new fill.
          if (wasNum !== num) {
            popCell(row, col);
            celebrateRegions(completedRegions(nextBoard, solution, row, col));
          }
        }
      }
    },
    [selectedCell, gameWon, givens, notesMode, solution, board],
  );

  const handleErase = useCallback(() => {
    if (!selectedCell || gameWon) return;
    const [row, col] = selectedCell;
    if (givens[row]?.[col]) return;

    setBoard((prev) => {
      const next = prev.map((r) => [...r]);
      next[row]![col] = null;
      return next;
    });
    setNotes((prev) => {
      const next = prev.map((r) => r.map((s) => new Set(s)));
      next[row]![col] = new Set();
      return next;
    });
  }, [selectedCell, gameWon, givens]);

  // Keyboard handling
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (gameWon) return;

      if (e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        handleNumberInput(parseInt(e.key, 10));
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        handleErase();
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setNotesMode((n) => !n);
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedCell((prev) => {
          if (!prev) return [0, 0];
          const [r, c] = prev;
          if (e.key === "ArrowUp") return [Math.max(0, r - 1), c];
          if (e.key === "ArrowDown") return [Math.min(8, r + 1), c];
          if (e.key === "ArrowLeft") return [r, Math.max(0, c - 1)];
          if (e.key === "ArrowRight") return [r, Math.min(8, c + 1)];
          return prev;
        });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameWon, handleNumberInput, handleErase]);

  const selectedValue =
    selectedCell ? board[selectedCell[0]]?.[selectedCell[1]] ?? null : null;

  function getCellStyle(row: number, col: number): React.CSSProperties {
    const isSelected = selectedCell?.[0] === row && selectedCell?.[1] === col;
    const isGiven = givens[row]?.[col];
    const cellValue = board[row]?.[col];
    const isWrong = cellValue !== null && !isGiven && solution[row]?.[col] !== cellValue;
    const isSameNumber =
      selectedValue !== null && cellValue === selectedValue && cellValue !== null;
    const isInSelectedRow = selectedCell?.[0] === row;
    const isInSelectedCol = selectedCell?.[1] === col;
    const isInSelectedBox =
      selectedCell &&
      Math.floor(selectedCell[0] / 3) === Math.floor(row / 3) &&
      Math.floor(selectedCell[1] / 3) === Math.floor(col / 3);

    let bg = "transparent";
    if (isSelected) {
      bg = "color-mix(in srgb, var(--accent) 25%, transparent)";
    } else if (isSameNumber) {
      bg = "color-mix(in srgb, var(--accent) 15%, transparent)";
    } else if (isInSelectedRow || isInSelectedCol || isInSelectedBox) {
      bg = "color-mix(in srgb, var(--accent) 6%, transparent)";
    }

    let color: string = "var(--ink)";
    if (isWrong) {
      color = "var(--error)";
    } else if (!isGiven && cellValue !== null) {
      color = "var(--accent)";
    }

    // Border logic for 3x3 boxes
    const borderRight =
      col === 2 || col === 5 ? "2px solid var(--line-strong)" : "1px solid var(--line)";
    const borderBottom =
      row === 2 || row === 5 ? "2px solid var(--line-strong)" : "1px solid var(--line)";

    return {
      background: bg,
      color,
      fontWeight: isGiven ? 700 : 500,
      borderRight: col < 8 ? borderRight : undefined,
      borderBottom: row < 8 ? borderBottom : undefined,
      cursor: "pointer",
      fontSize: "clamp(1rem, 3.5vmin, 1.5rem)",
      fontFamily: isGiven ? "Fraunces, serif" : "Manrope, system-ui, sans-serif",
    };
  }

  return (
    <GameShell
      topbar={
        <GameTopbar
          title="Sudoku"
          stats={[
            { label: "Time", value: formatTime(timer) },
            { label: "Errors", value: errors, accent: errors > 0 },
          ]}
          actions={
            <>
              <button className="min-h-[2.75rem] min-w-[2.75rem]" onClick={() => setNotesMode((n) => !n)}>
                Notes {notesMode ? "ON" : "OFF"}
              </button>
              <GameAuth />
            </>
          }
          rules={
            <div>
              <h3 style={{ fontWeight: 700 }}>Sudoku</h3>
              <h4 style={{ fontWeight: 600 }}>Rules</h4>
              <ul><li>Fill the 9x9 grid so every row, column, and 3x3 box contains 1-9 with no repeats</li></ul>
              <h4 style={{ fontWeight: 600 }}>Controls</h4>
              <ul><li>Tap a cell, then tap a number to place it</li><li>Use Notes mode for pencil marks</li><li>Arrow keys to navigate, Backspace to erase</li></ul>
              <h4 style={{ fontWeight: 600 }}>Difficulty</h4>
              <ul><li>Three levels: Easy, Medium, Hard</li></ul>
            </div>
          }
        />
      }
    >
      <AudioBridge apiRef={audioRef} />
      <div className="relative w-full h-full" style={{ overflowY: "auto" }}>
        {solveBurst && <Celebration id={solveBurst} label="Solved!" onDone={endSolveBurst} />}
        <div className="flex flex-col items-center justify-center h-full gap-4 p-4">
          {/* Win overlay */}
          {gameWon && (
            <div
              className="flex flex-col items-center gap-3 p-6 text-center"
              style={{
                borderRadius: "1.25rem",
                background: "var(--panel)",
                border: "1px solid var(--line)",
              }}
            >
              <h2
                className="text-2xl font-bold"
                style={{ fontFamily: "Fraunces, serif", color: "var(--success)" }}
              >
                Congratulations!
              </h2>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Solved in {formatTime(timer)} with {errors} error{errors !== 1 ? "s" : ""}
              </p>
              <div className="flex gap-2 mt-2">
                {(["easy", "medium", "hard"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => startNewGame(d)}
                    className="px-4 py-2 text-sm font-semibold capitalize min-h-[2.75rem]"
                    style={{
                      borderRadius: "0.75rem",
                      background: "var(--accent)",
                      color: "#fff",
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Difficulty selector */}
          <div className="flex gap-1">
            {(["easy", "medium", "hard"] as const).map((d) => (
              <button
                key={d}
                onClick={() => startNewGame(d)}
                className="px-3 py-1.5 text-xs font-semibold capitalize min-h-[2.75rem]"
                style={{
                  borderRadius: "0.75rem",
                  background: difficulty === d ? "var(--accent)" : "var(--line)",
                  color: difficulty === d ? "#fff" : "var(--ink)",
                }}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Sudoku Grid */}
          {board.length > 0 && (
            <div
              ref={boardRef}
              className="w-full relative"
              style={{
                maxWidth: "min(90vw, 90vh - 12rem, 32rem)",
                aspectRatio: "1",
              }}
            >
              <div
                className="grid w-full h-full"
                style={{
                  gridTemplateColumns: "repeat(9, 1fr)",
                  gridTemplateRows: "repeat(9, 1fr)",
                  border: "2px solid var(--line-strong)",
                  borderRadius: "0.5rem",
                  overflow: "hidden",
                }}
              >
                {board.map((row, r) =>
                  row.map((cell, c) => (
                    <button
                      key={`${r}-${c}`}
                      onClick={() => handleCellClick(r, c)}
                      className={`flex items-center justify-center relative select-none${shimmering.has(`${r}-${c}`) ? " region-shimmer" : ""}`}
                      style={getCellStyle(r, c)}
                    >
                      {cell !== null ? (
                        cell
                      ) : notes[r]![c]!.size > 0 ? (
                        <NotesGrid notes={notes[r]![c]!} />
                      ) : null}
                    </button>
                  )),
                )}
              </div>
              <ParticleLayer ref={particleRef} />
            </div>
          )}

          {/* Number Pad */}
          {!gameWon && (
            <div className="flex flex-wrap justify-center gap-2 w-full" style={{ maxWidth: "24rem" }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handleNumberInput(num)}
                  className="flex items-center justify-center font-bold text-lg"
                  style={{
                    width: "3rem",
                    height: "3rem",
                    borderRadius: "0.75rem",
                    background:
                      selectedValue === num
                        ? "var(--accent)"
                        : "var(--panel)",
                    color: selectedValue === num ? "#fff" : "var(--ink)",
                    border: "1px solid var(--line)",
                  }}
                >
                  {num}
                </button>
              ))}
              <button
                onClick={handleErase}
                className="flex items-center justify-center font-semibold text-sm"
                style={{
                  width: "3rem",
                  height: "3rem",
                  borderRadius: "0.75rem",
                  background: "var(--panel)",
                  color: "var(--muted)",
                  border: "1px solid var(--line)",
                }}
              >
                Erase
              </button>
            </div>
          )}
        </div>
      </div>
    </GameShell>
  );
}

function NotesGrid({ notes }: { notes: Set<number> }) {
  return (
    <div
      className="grid absolute inset-0"
      style={{
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(3, 1fr)",
        fontSize: "clamp(0.4rem, 1.2vmin, 0.6rem)",
        color: "var(--muted)",
        lineHeight: 1,
      }}
    >
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
        <span key={n} className="flex items-center justify-center">
          {notes.has(n) ? n : ""}
        </span>
      ))}
    </div>
  );
}
