# Sudoku audit (#329)

Audit of the existing Sudoku game before the feel and motion kit was added. Part of #328.

## Structure

- pnpm workspace (`pnpm-workspace.yaml`) with a single package, `web/` (`@sudoku/web`).
- Root scripts: `dev`, `build`, `preview`, `typecheck` (all delegate to `web/`).
- `web/src/App.tsx`: the whole game UI and state in one component (board, notes, timer, errors, win and leaderboard submit).
- `web/src/lib/sudoku.ts`: pure logic. Generation (`generateSolution`, `generatePuzzle`), validation (`isValidPlacement`, `isBoardComplete`, `checkSolution`) and `completedRegions`.
- `web/src/types.ts`: `Difficulty`, `CellValue`, `Board`, `Notes`.
- `web/src/components/Shell.tsx`: an older custom shell. App no longer imports it, and the compliance test forbids that import.
- `web/src/feel/`, `web/src/motion/`, `web/src/hooks/`: feel and motion kit (see below).
- Deploy: `.github/workflows/deploy.yml` calls the shared `ci-workflows` game CI with `cf_project: freesudokuapp`.

## Tests

- Framework: Vitest 4 with jsdom and Testing Library, set up in `web/src/test/setup.ts`.
- `web/src/test/compliance.test.ts` checks file contents: SDK imports, CSS variables, dark mode, the PWA plugin, no tracking SDKs and no banned CSS frameworks.
- `web/src/lib/sudoku.test.ts` covers `completedRegions`, the only logic test in the app.
- Gap: the generator, the validators and the App behaviour have no logic tests. Killer and Queens work in #328 will need solver and uniqueness tests.

## Save format

- **None.** All game state is ephemeral React `useState`. Nothing reads or writes `localStorage`, IndexedDB or any other store.
- Reloading starts a new game. Only the leaderboard (via the SDK's `useLeaderboard("sudoku")`) persists anything.
- No migration is needed. Any future save would be new, so it should carry a version field from its first version.

## Feel and motion kit

Copied from `zap-drills-gh` (`web/src/motion/`, `web/src/feel/`, `web/src/hooks/useGameLoop.ts`). That kit was itself copied from chain-rush-gh.

- `motion/`: easing, tween, flight, reduced-motion check (`prefersReducedMotion`).
- `feel/`: `ParticleLayer` (canvas bursts), `Celebration` (confetti and banner), `ScorePop`, `flyWord`, `shake`/`useShake`, `haptics`/`useHaptics`.
- Adapted for sudoku:
  - `Celebration` now takes an optional label (default empty). Sudoku passes "Solved!" for a full-board solve.
  - The `feel/index.ts` barrel also exports `Celebration`.
- Wired in `App.tsx`:
  - Cell pop: a small accent burst when a correct number lands in an empty cell. Re-entering the same number does not pop.
  - Region complete: each row, column or box that becomes fully correct gets a success-coloured burst and a CSS shimmer for 700 ms.
  - Solve: the confetti celebration with "Solved!". It replaces the level-up sound that App used to play, because `Celebration` now plays it.
  - Reduced motion: bursts are skipped by `ParticleLayer`, shimmers are not added, and confetti is not drawn. The "Solved!" banner still shows.
- CSS for the kit lives at the end of `web/src/index.css`. The zap-drills checkout has no CSS for these classes.
- Not used in sudoku yet: `ScorePop`, `flyWord`, `shake`, `haptics`. They are copied but unwired.

## TODO

- Switch the kit to `@freegamestore/games/feel` once SDK ≥ 0.17 ships it. The copied files carry `TODO` comments to do this.
