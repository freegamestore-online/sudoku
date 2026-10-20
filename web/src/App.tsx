import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameShell, GameTopbar, GameAuth, GameThemeToggle, Leaderboard, useGameSounds } from "@freegamestore/games";
import { useLeaderboard } from '@freegamestore/games';

type SoundsApi = ReturnType<typeof useGameSounds>;

function AudioBridge({ apiRef }: { apiRef: React.MutableRefObject<SoundsApi | null> }) {
  const sounds = useGameSounds();
  apiRef.current = sounds;
  return null;
}

import { generatePuzzle, checkSolution, completedRegions, isBoardComplete, getHint, autoFillNotes } from "./lib/sudoku";
import { cageIndexMap, cageLabelCell, cageStatus, generateKiller, MAX_CAGE_SIZE, type Cage, type CageStatus } from "./lib/killer";
import { dailyKey, dailyKillerPuzzle, KILLER_DAILY_GAME_ID } from "./lib/daily";
import { dailyQueensPuzzle, QUEENS_DAILY_GAME_ID, QUEENS_N } from "./lib/dailyQueens";
import { hasPostedDaily, markPostedDaily } from "./lib/dailyPost";
import { generateQueens, queensConflicts, type QueensPuzzle } from "./lib/queens";
import { hashSeed, randomSeed, seededRandom } from "./lib/random";
import { QueensBoard } from "./QueensBoard";
import { Celebration, ParticleLayer, prefersReducedMotion, type ParticleLayerHandle } from "./feel";
import type { Board, Difficulty, Notes } from "./types";

/** How long a completed row, column or box keeps its shimmer, in ms. Matches the CSS animation. */
const SHIMMER_MS = 700;
const ACCENT_HEX = "#2563eb";
const SUCCESS_HEX = "#16a34a";

/**
 * Classic is the random game; Killer adds cage sums; Queens places one queen per row, column
 * and region. The daily modes are one puzzle per UTC day, the same for everyone.
 */
type Mode = "classic" | "killer" | "killer-daily" | "queens" | "queens-daily";
const MODES: { id: Mode; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "killer", label: "Killer" },
  { id: "killer-daily", label: "Daily Killer" },
  { id: "queens", label: "Queens" },
  { id: "queens-daily", label: "Daily Queens" },
];
/** The random game a mode offers from its win screen. */
const RANDOM_MODE: Record<Mode, Mode> = {
  classic: "classic",
  killer: "killer",
  "killer-daily": "killer",
  queens: "queens",
  "queens-daily": "queens",
};

/** Whether a mode plays Queens rather than the number grid. */
const isQueensMode = (mode: Mode) => mode === "queens" || mode === "queens-daily";

/**
 * The puzzle for a mode. Killer and Queens start empty, Killer with a cage layout and no
 * givens; Queens has its own board, so the number grid is empty.
 */
function buildGame(
  mode: Mode,
  diff: Difficulty,
): { puzzle: Board; solution: number[][]; cages: Cage[] | null; date: string | null; queens: QueensPuzzle | null } {
  const testSeed = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("seed");
  const random = testSeed === null ? Math.random : seededRandom(hashSeed(testSeed));
  if (mode === "classic") {
    const { puzzle, solution } = generatePuzzle(diff, random);
    return { puzzle, solution, cages: null, date: null, queens: null };
  }
  if (isQueensMode(mode)) {
    const date = mode === "queens-daily" ? dailyKey() : null;
    const queens = date ? dailyQueensPuzzle(date) : generateQueens(QUEENS_N, testSeed === null ? randomSeed() : hashSeed(testSeed));
    return { puzzle: [], solution: [], cages: null, date, queens };
  }
  const date = mode === "killer-daily" ? dailyKey() : null;
  const killer = date ? dailyKillerPuzzle(date) : generateKiller(MAX_CAGE_SIZE, random);
  return {
    puzzle: killer.solution.map((row) => row.map((): null => null)),
    solution: killer.solution,
    cages: killer.cages,
    date,
    queens: null,
  };
}

/** One line for the sum helper: what a cage still needs, and the digit sets that could fill it. */
function describeCage({ remaining, empty, candidates }: CageStatus): string {
  if (empty === 0) return remaining === 0 ? "Cage complete" : `Cage over by ${-remaining}`;
  const cells = `${empty} empty ${empty === 1 ? "cell" : "cells"}`;
  if (candidates.length === 0) return `Cage: ${remaining} left in ${cells}, no digits fit`;
  return `Cage: ${remaining} left in ${cells} · ${candidates.map((combo) => combo.join("+")).join(", ")}`;
}

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
  const [hintsUsed, setHintsUsed] = useState(0);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [undoStack, setUndoStack] = useState<{ board: Board; notes: Notes; queens: ReadonlySet<string>; errors: number }[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [solveBurst, setSolveBurst] = useState<string | null>(null);
  const [shimmering, setShimmering] = useState<ReadonlySet<string>>(() => new Set());
  const [mode, setMode] = useState<Mode>("classic");
  // Cage layout for the Killer modes. Null in Classic.
  const [cages, setCages] = useState<Cage[] | null>(null);
  // The UTC day of the current Daily Killer, captured at start so a midnight rollover does not change it.
  const [dailyDate, setDailyDate] = useState<string | null>(null);
  // Queens: the puzzle and the queens the player has placed, as "row-col" keys.
  const [queensPuzzle, setQueensPuzzle] = useState<QueensPuzzle | null>(null);
  const [queensPlaced, setQueensPlaced] = useState<ReadonlySet<string>>(() => new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const particleRef = useRef<ParticleLayerHandle>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const { submitScore, topScores, recentScores, loading: leaderboardLoading } = useLeaderboard("sudoku");
  const { submitScore: submitKillerDaily } = useLeaderboard(KILLER_DAILY_GAME_ID);
  const { submitScore: submitQueensDaily } = useLeaderboard(QUEENS_DAILY_GAME_ID);
  const audioRef = useRef<SoundsApi | null>(null);

  const startGame = useCallback((next: Mode, diff: Difficulty) => {
    const game = buildGame(next, diff);
    setBoard(game.puzzle.map((row) => [...row]));
    setSolution(game.solution);
    setGivens(game.puzzle.map((row) => row.map((cell) => cell !== null)));
    setCages(game.cages);
    setDailyDate(game.date);
    setQueensPuzzle(game.queens);
    setQueensPlaced(new Set());
    setMode(next);
    setSelectedCell(null);
    setNotesMode(false);
    setNotes(createEmptyNotes());
    setTimer(0);
    setGameWon(false);
    setErrors(0);
    setHintsUsed(0);
    setScoreSubmitted(false);
    setUndoStack([]);
    setShowLeaderboard(false);
    setDifficulty(diff);
  }, []);

  // Start first game
  useEffect(() => {
    startGame("classic", "easy");
  }, [startGame]);

  // Cage lookups for the Killer board: which cage each cell is in, and where each sum label goes.
  const cageIndex = useMemo(() => (cages ? cageIndexMap(cages) : null), [cages]);
  const cageLabels = useMemo(() => {
    const labels = new Map<string, number>();
    for (const cage of cages ?? []) {
      const [r, c] = cageLabelCell(cage);
      labels.set(`${r}-${c}`, cage.sum);
    }
    return labels;
  }, [cages]);

  // Timer
  useEffect(() => {
    const inPlay = queensPuzzle !== null || board.length > 0;
    if (gameWon || !inPlay) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameWon, board.length, queensPuzzle]);

  // Check win condition
  useEffect(() => {
    if (board.length === 0 || gameWon) return;
    if (isBoardComplete(board) && checkSolution(board, solution)) {
      setGameWon(true);
      // The celebration plays its own level-up sound.
      setSolveBurst("solve");
    }
  }, [board, solution, gameWon]);

  // Queens win: every queen placed, none in conflict. With one solution that is the solution.
  const queenList = useMemo(
    () => [...queensPlaced].map((key): [number, number] => {
      const [r, c] = key.split("-").map(Number) as [number, number];
      return [r, c];
    }),
    [queensPlaced],
  );
  const queenConflicts = useMemo(
    () => (queensPuzzle ? queensConflicts(queensPuzzle.colors, queenList) : new Set<string>()),
    [queensPuzzle, queenList],
  );
  useEffect(() => {
    if (!queensPuzzle || gameWon) return;
    if (queensPlaced.size === queensPuzzle.n && queenConflicts.size === 0) {
      setGameWon(true);
      setSolveBurst("solve");
    }
  }, [queensPuzzle, queensPlaced, queenConflicts, gameWon]);

  // Submit score on win. Classic times go to the classic board. A daily time goes to its
  // game's board, once per device per day. Random Killer and Queens are not posted.
  useEffect(() => {
    if (!gameWon || scoreSubmitted) return;
    setScoreSubmitted(true);
    const daily =
      mode === "killer-daily" ? { game: "killer", submit: submitKillerDaily }
      : mode === "queens-daily" ? { game: "queens", submit: submitQueensDaily }
      : null;
    if (mode === "classic" && hintsUsed === 0) {
      submitScore(timer);
    } else if (hintsUsed === 0 && daily && dailyDate && !hasPostedDaily(daily.game, dailyDate)) {
      // An "Invalid game" reply or a network failure is not shown. Nothing is marked posted,
      // so the next win today can try again.
      daily.submit(timer).then(
        (posted) => {
          if (posted.ok) markPostedDaily(daily.game, dailyDate);
        },
        () => {},
      );
    }
  }, [gameWon, scoreSubmitted, timer, submitScore, submitKillerDaily, submitQueensDaily, mode, dailyDate, hintsUsed]);

  const toggleQueen = useCallback(
    (row: number, col: number) => {
      if (gameWon) return;
      const key = `${row}-${col}`;
      setUndoStack((history) => [...history, { board, notes, queens: queensPlaced, errors }]);
      setQueensPlaced((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [gameWon, board, notes, queensPlaced, errors],
  );

  const undo = useCallback(() => {
    setUndoStack((history) => {
      const previous = history.at(-1);
      if (!previous) return history;
      setBoard(previous.board);
      setNotes(previous.notes);
      setQueensPlaced(new Set(previous.queens));
      setErrors(previous.errors);
      setGameWon(false);
      return history.slice(0, -1);
    });
  }, []);

  const handleCellClick = useCallback((row: number, col: number) => {
    setSelectedCell([row, col]);
  }, []);

  const handleHint = useCallback(() => {
    if (!selectedCell || gameWon || board.length === 0) return;
    const [row, col] = selectedCell;
    if (givens[row]?.[col] || board[row]?.[col] === solution[row]?.[col]) return;
    setUndoStack((history) => [...history, { board, notes, queens: queensPlaced, errors }]);
    const hint = getHint(board, notes, solution, row, col);
    setBoard(hint.board);
    setNotes(hint.notes);
    setHintsUsed((count) => count + 1);
    popCell(row, col);
    celebrateRegions(completedRegions(hint.board, solution, row, col));
  }, [selectedCell, gameWon, board, givens, solution, notes, queensPlaced, errors]);

  const handleAutoFillNotes = useCallback(() => {
    if (gameWon || board.length === 0) return;
    setUndoStack((history) => [...history, { board, notes, queens: queensPlaced, errors }]);
    setNotes(autoFillNotes(board, notes));
  }, [gameWon, board, notes, queensPlaced, errors]);

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
      if (!selectedCell || gameWon || board.length === 0) return;
      const [row, col] = selectedCell;
      if (givens[row]?.[col]) return;

      if (notesMode) {
        setUndoStack((history) => [...history, { board, notes, queens: queensPlaced, errors }]);
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
        setUndoStack((history) => [...history, { board, notes, queens: queensPlaced, errors }]);
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
    [selectedCell, gameWon, givens, notesMode, solution, board, notes, queensPlaced, errors],
  );

  const handleErase = useCallback(() => {
    if (!selectedCell || gameWon || board.length === 0) return;
    const [row, col] = selectedCell;
    if (givens[row]?.[col]) return;

    setUndoStack((history) => [...history, { board, notes, queens: queensPlaced, errors }]);

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
  }, [selectedCell, gameWon, givens, board, notes, queensPlaced, errors]);

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

    // Border logic: solid lines for 3x3 boxes, dashed lines where a Killer cage ends inside a box.
    const cageRightEdge = cageIndex !== null && col < 8 && cageIndex[row]![col + 1] !== cageIndex[row]![col];
    const cageBottomEdge = cageIndex !== null && row < 8 && cageIndex[row + 1]![col] !== cageIndex[row]![col];
    const cageEdge = "1.5px dashed var(--ink)";
    const borderRight =
      col === 2 || col === 5 ? "2px solid var(--line-strong)" : cageRightEdge ? cageEdge : "1px solid var(--line)";
    const borderBottom =
      row === 2 || row === 5 ? "2px solid var(--line-strong)" : cageBottomEdge ? cageEdge : "1px solid var(--line)";

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

  // The sum helper follows the selected cell's cage.
  const selectedCageStatus = useMemo(() => {
    if (!cages || !cageIndex || !selectedCell || board.length === 0) return null;
    const index = cageIndex[selectedCell[0]]![selectedCell[1]]!;
    return index >= 0 ? cageStatus(cages[index]!, board) : null;
  }, [cages, cageIndex, selectedCell, board]);

  return (
    <GameShell
      topbar={
        <GameTopbar
          title="Sudoku"
          stats={[
            { label: "Time", value: formatTime(timer) },
            { label: "Hints", value: hintsUsed },
            isQueensMode(mode)
              ? { label: "Conflicts", value: queenConflicts.size, accent: queenConflicts.size > 0 }
              : { label: "Errors", value: errors, accent: errors > 0 },
          ]}
          actions={
            <>
              <button
                aria-label="Undo move"
                disabled={undoStack.length === 0}
                onClick={undo}
                className="min-h-[2.75rem] px-2 whitespace-nowrap disabled:opacity-40"
              >Undo</button>
              <GameThemeToggle />
              {!isQueensMode(mode) && (
                <>
                  <button
                    className="min-h-[2.75rem] px-2 whitespace-nowrap disabled:opacity-40"
                    disabled={!selectedCell || gameWon || board.length === 0}
                    onClick={handleHint}
                  >Hint</button>
                  <button
                    className="min-h-[2.75rem] px-2 whitespace-nowrap disabled:opacity-40"
                    disabled={gameWon || board.length === 0}
                    onClick={handleAutoFillNotes}
                  >Auto-fill notes</button>
                  <button
                    className="min-h-[2.75rem] min-w-[2.75rem] px-2 whitespace-nowrap"
                    aria-pressed={notesMode}
                    onClick={() => setNotesMode((n) => !n)}
                    style={{ borderRadius: "0.75rem", background: notesMode ? "var(--accent)" : undefined, color: notesMode ? "#fff" : undefined }}
                  >
                    Notes
                  </button>
                </>
              )}
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
              <ul><li>Classic has three levels: Easy, Medium, Hard</li></ul>
              <h4 style={{ fontWeight: 600 }}>Queens</h4>
              <ul><li>Place one queen in each row, column and coloured region</li><li>Queens cannot touch, diagonals included</li><li>Tap a cell to place or remove a queen. Red marks a conflict</li></ul>
              <h4 style={{ fontWeight: 600 }}>Killer</h4>
              <ul><li>Dashed lines outline cages. Digits in a cage are all different and add up to the small number in its top-left cell</li><li>The line under the grid shows what a cage still needs</li><li>Daily Killer is the same puzzle for everyone on a UTC day</li></ul>
            </div>
          }
        />
      }
    >
      <AudioBridge apiRef={audioRef} />
      <div className="relative w-full h-full" style={{ overflowY: "auto" }}>
        {solveBurst && <Celebration id={solveBurst} label="Solved!" onDone={endSolveBurst} />}
        <div className="flex flex-col items-center justify-center min-h-full gap-4 p-4">
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
                {mode === "classic" ? (
                  (["easy", "medium", "hard"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => startGame("classic", d)}
                      className="px-4 py-2 text-sm font-semibold capitalize min-h-[2.75rem]"
                      style={{
                        borderRadius: "0.75rem",
                        background: "var(--accent)",
                        color: "#fff",
                      }}
                    >
                      {d}
                    </button>
                  ))
                ) : (
                  <button
                    onClick={() => startGame(RANDOM_MODE[mode], difficulty)}
                    className="px-4 py-2 text-sm font-semibold min-h-[2.75rem]"
                    style={{
                      borderRadius: "0.75rem",
                      background: "var(--accent)",
                      color: "#fff",
                    }}
                  >
                    {`New ${MODES.find((m) => m.id === RANDOM_MODE[mode])!.label}`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Mode selector, with the difficulty for Classic */}
          <div className="flex flex-wrap justify-center gap-1">
            {MODES.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => startGame(id, difficulty)}
                className="px-3 py-1.5 text-xs font-semibold min-h-[2.75rem]"
                style={{
                  borderRadius: "0.75rem",
                  background: mode === id ? "var(--accent)" : "var(--line)",
                  color: mode === id ? "#fff" : "var(--ink)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="px-3 py-1.5 text-xs font-semibold min-h-[2.75rem]"
            style={{ borderRadius: "0.75rem", background: "var(--line)", color: "var(--ink)" }}
            aria-expanded={showLeaderboard}
            onClick={() => setShowLeaderboard((show) => !show)}
          >{showLeaderboard ? "Hide leaderboard" : "Leaderboard"}</button>
          {showLeaderboard && (
            <section aria-label="Leaderboard" className="w-full max-w-sm rounded-xl" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
              <h2 className="px-4 pt-3 text-sm font-bold">Sudoku leaderboard</h2>
              <Leaderboard topScores={topScores} recentScores={recentScores} loading={leaderboardLoading} />
            </section>
          )}
          {mode === "classic" && (
            <div className="flex gap-1">
              {(["easy", "medium", "hard"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => startGame("classic", d)}
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
          )}
          {(mode === "killer-daily" || mode === "queens-daily") && dailyDate && (
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {`${MODES.find((m) => m.id === mode)!.label} for ${dailyDate} (UTC)`}
            </p>
          )}

          {/* Queens board */}
          {queensPuzzle && (
            <div className="w-full" style={{ maxWidth: "min(90vw, 90vh - 12rem, 32rem)" }}>
              <QueensBoard
                puzzle={queensPuzzle}
                placed={queensPlaced}
                conflicts={queenConflicts}
                onToggle={toggleQueen}
              />
            </div>
          )}

          {/* Sudoku Grid */}
          {!isQueensMode(mode) && board.length > 0 && (
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
                      type="button"
                      onClick={() => handleCellClick(r, c)}
                      aria-label={`Row ${r + 1}, column ${c + 1}, ${cell === null ? "empty" : `value ${cell}`}${givens[r]?.[c] ? ", given" : ""}`}
                      data-row={r}
                      data-col={c}
                      data-given={givens[r]?.[c] ? "true" : "false"}
                      data-value={cell ?? ""}
                      className={`flex items-center justify-center relative select-none${shimmering.has(`${r}-${c}`) ? " region-shimmer" : ""}`}
                      style={getCellStyle(r, c)}
                    >
                      {cageLabels.has(`${r}-${c}`) && (
                        <span
                          className="absolute left-0.5 top-0 font-semibold leading-none pointer-events-none"
                          style={{ fontSize: "clamp(0.5rem, 1.6vmin, 0.7rem)", color: "var(--ink)" }}
                        >
                          {cageLabels.get(`${r}-${c}`)}
                        </span>
                      )}
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

          {/* Sum helper: what the selected cage still needs */}
          {selectedCageStatus && (
            <p className="text-sm text-center" aria-live="polite" style={{ color: "var(--muted)" }}>
              {describeCage(selectedCageStatus)}
            </p>
          )}

          {/* Number Pad */}
          {!gameWon && !isQueensMode(mode) && (
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
