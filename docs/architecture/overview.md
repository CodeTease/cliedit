# Architecture Overview

`cliedit` keeps `CliEditor` thin and pushes behaviour into per-area mixin modules that are
merged onto the prototype at load time.

## Module Map

| File | Responsibility |
| --- | --- |
| `src/index.ts` | Public `openEditor()`: stdin piping, swap recovery, wiring |
| `src/editor.ts` | `CliEditor` state, TTY lifecycle, worker construction, mixin assembly |
| `src/editor.editing.ts` | Insert/delete, auto-pair, indent, move/duplicate lines |
| `src/editor.navigation.ts` | Cursor movement, viewport scrolling, go-to-line, bracket match |
| `src/editor.rendering.ts` | Grid drawing, gutter, status bar, cursor placement |
| `src/editor.keys.ts` | Keypress routing and per-mode key handlers |
| `src/editor.selection.ts` | Anchor/cursor selection model |
| `src/editor.clipboard.ts` | System clipboard via `pbcopy`/`clip`/`xclip` |
| `src/editor.search.ts` | Find, replace, replace-all |
| `src/editor.history.ts` | Thin `CliEditor` ↔ `HistoryManager` bridge |
| `src/editor.io.ts` | `saveFile()`, `setDirty()` |
| `src/editor.syntax.ts` | Syntax cache, worker dispatch, sync fallback |
| `src/editor.swap.ts` | `SwapManager`: periodic swap writes, crash recovery |
| `src/screen_buffer.ts` | Double-buffered grid + ANSI diffing |
| `src/history.ts` | Snapshot undo/redo stack |
| `src/syntax.common.ts` | Pure per-line scanner (no Node APIs) |
| `src/syntax.worker.ts` | Worker-thread wrapper around `syntax.common.ts` |
| `src/constants.ts` | `ANSI` escape codes and `KEYS` byte sequences |
| `src/types.ts` | `DocumentState`, `EditorMode`, `EditorOptions` |

## The Mixin Pattern

Behaviour lives in modules that export a plain object of functions. Each function declares
`this: CliEditor`, which gives it typed access to editor state without inheritance:

```typescript
function moveCursorLogically(this: CliEditor, dx: number): void { /* ... */ }

export const navigationMethods = { moveCursorLogically, /* ... */ };
```

`src/editor.ts` merges those objects into the prototype and into the class type:

```typescript
export interface CliEditor extends TEditingMethods, TNavigationMethods, /* ... */ {}

Object.assign(CliEditor.prototype, editingMethods);
Object.assign(CliEditor.prototype, navigationMethods);
// ...one Object.assign per module
```

Two modules (`editor.keys.ts`, `editor.selection.ts`) hand-write a `T*Methods` type and
annotate the exported object with it, because their methods are referenced from other
mixins. The rest derive their type with `typeof`.

The `interface CliEditor` merge is what makes `this.render()` type-check inside a mixin
that lives in another file. Adding a mixin means editing three places in `editor.ts`: the
import, the `interface` merge, and the `Object.assign` list.

## State Management

State lives directly on the `CliEditor` instance:

- **`lines`** (`string[]`): the document, split by newline. Always at least one entry.
- **`cursorX`, `cursorY`** (`number`): logical cursor position (column within a line, line
  index). They are *not* visual coordinates; wrapping is applied at draw time.
- **`rowOffset`** (`number`): index of the top-most **visual** row in the viewport. There
  is no horizontal scroll offset — long lines wrap instead.
- **`selectionAnchor`** (`{x, y} | null`): the fixed end of a selection; the cursor is the
  moving end.
- **`mode`** (`EditorMode`): `'edit'`, `'search_find'`, `'search_replace'`,
  `'search_confirm'`, or `'goto_line'`.
- **`isDirty`, `statusMessage`, `quitConfirm`, `isExiting`, `isCleanedUp`**: lifecycle and
  status-bar flags.
- **`screenRows`, `screenCols`**: `stdout.rows - 2` (two status-bar lines) and
  `stdout.columns`, refreshed on `resize`.
- **`gutterWidth`, `tabSize`**: layout options; `gutterWidth` is recomputed each frame.
- **`syntaxCache`** (`Map<lineIndex, Map<col, style>>`), **`syntaxWorker`**.
- **`searchQuery`, `replaceQuery`, `searchResults`, `searchResultMap`**: find/replace state.

### Undo/Redo History

`HistoryManager` (`src/history.ts`) stores **whole-document snapshots** rather than patches:

1. A `DocumentState` is `{ lines, cursorX, cursorY }`, deep-cloned with
   `JSON.parse(JSON.stringify(...))` in `getCurrentState()`.
2. `saveState()` pushes the *current* state; it is called before a mutation for multi-step
   edits (indent, outdent, move, duplicate) and after the mutation for single keystrokes
   (`handleKeypressEvent()` calls it when `handleEditKeys()` reports an edit).
3. `undo()` pops a snapshot, pushes the current state onto the redo stack, and restores it.
4. Capped at 100 snapshots; the oldest is dropped.

The trade-off is memory (each snapshot holds the full buffer) in exchange for trivially
correct restore semantics.

## Key Routing

`handleKeypressEvent()` in `src/editor.keys.ts` is the single entry point for the vendored
`keypress` emitter. It:

1. ignores everything while `isExiting`;
2. maps raw characters and escape sequences onto `KEYS` names, checking `meta` before the
   plain arrow names so `Alt+Arrow` is not swallowed as an arrow;
3. routes to a mode-specific handler (`handleSearchKeys`, `handleSearchConfirmKeys`,
   `handleGoToLineKeys`) or to `handleEditKeys()`;
4. saves history when an edit was reported, then renders.

## Lifecycle

`CliEditor.run()` (`src/editor.ts`):

- **Setup:** `setupTerminal()` requires `process.stdout.isTTY`, resizes the
  `ScreenBuffer`, enters the alternate screen, enables SGR mouse reporting (`?1000h`,
  `?1006h`), sets raw mode, and attaches the `keypress` listener.
- **Loop:** input events mutate state and call `render()`; `SwapManager.start()` writes a
  swap file every 2 s.
- **Teardown:** `performCleanup()` stops the swap timer, terminates the worker, removes
  listeners, writes the exit sequence (show cursor, leave alternate screen, disable mouse),
  and only then restores cooked mode. Writing the sequence first and using the write
  callback prevents the "ghost TUI" left on screen after exit.
