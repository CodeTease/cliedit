# API Reference: Interfaces

This document describes the types `cliedit` exposes and the ones it uses internally.
Everything below is taken from `src/types.ts`, `src/editor.selection.ts`, and
`src/index.ts`.

## `openEditor`

The package has a single runtime entry point:

```typescript
export async function openEditor(
    filepath: string,
    options?: EditorOptions,
): Promise<{ saved: boolean; content: string }>;
```

- `filepath` is read on start and written on `Ctrl+S`. Pass `''` for a scratch buffer
  (saving then fails, because `fs.writeFile('')` throws).
- `saved` is `true` only when the user exited with `Ctrl+S`; `Ctrl+Q` reports `false`.
- `content` is the buffer at exit, joined with `\n`.
- The promise rejects if `stdout` is not a TTY, and propagates non-`ENOENT` read errors.

## `EditorOptions`

Passed to `openEditor()` or to the `CliEditor` constructor. All fields are optional.

```typescript
export interface EditorOptions {
    /**
     * Spaces per soft tab and per indent/outdent step.
     * Default: 4
     */
    tabSize?: number;

    /**
     * Nominal line-number gutter width.
     * `render()` overwrites this before every frame with
     * `max(5, String(lines.length).length + 3)`, so a custom value currently has no effect.
     * Default: 5
     */
    gutterWidth?: number;

    /**
     * Stream that supplies keypresses.
     * Default: process.stdin
     */
    inputStream?: NodeJS.ReadStream;
}
```

Two behaviours worth knowing:

- **`gutterWidth` is overwritten every frame.** `render()` calls `updateGutterWidth()`
  before drawing anything, which sets
  `gutterWidth = Math.max(5, String(lines.length).length + 3)`. A value you pass is
  replaced immediately, so the option currently has no observable effect.
- **`inputStream` is filled in for you when piping.** If `process.stdin` is not a TTY,
  `openEditor()` drains the pipe, opens `/dev/tty` (or `CONIN$` on Windows), and assigns
  it to `options.inputStream`. Because the options object is mutated, do not reuse a
  single options object across several `openEditor()` calls.

`EditorOptions` is exported from `src/types.ts` but **not** re-exported from the package
entry point. Import it from the source path, or derive it:

```typescript
type EditorOptions = NonNullable<Parameters<typeof openEditor>[1]>;
```

## `DocumentState`

The snapshot unit of the undo/redo stack (`src/history.ts`).

```typescript
export type DocumentState = {
    /** The document content, split by newline. */
    lines: string[];

    /** Logical cursor column (0-based). */
    cursorX: number;

    /** Logical cursor row (0-based). */
    cursorY: number;
};
```

`HistoryManager` defaults to a 100-snapshot limit; the oldest snapshot is dropped when
the stack is full.

## `EditorMode`

String union for the current interaction mode. It decides how keypresses are routed.

```typescript
export type EditorMode =
  | 'edit'            // Normal editing
  | 'search_find'     // Typing the search query (also the first step of replace)
  | 'search_replace'  // Typing the replacement string
  | 'search_confirm'  // Answering the y/n/a/q replace prompt
  | 'goto_line';      // Typing a line number
```

`search_confirm` has no dedicated entry key: `findNext()` switches into it when a
replace flow is active.

## `NormalizedRange`

A selection with `start` guaranteed to sort before `end`. Returned by
`getNormalizedSelection()` and accepted by `isPositionInSelection()`.

```typescript
export type NormalizedRange = {
    start: { x: number; y: number };
    end:   { x: number; y: number };
};
```

Coordinates are logical: `y` is a line index, `x` a column index within that line.
Selections are stored as an anchor (`selectionAnchor`) plus the live cursor, and are
converted to a normalized range only when read.

## `CliEditor`

The editor class, exported from the package for embedding:

```typescript
new CliEditor(initialContent: string, filepath: string, options?: EditorOptions)
```

The constructor builds state and starts the syntax worker; `run()` takes over the
terminal, starts the swap timer, and returns the same
`Promise<{ saved: boolean; content: string }>` as `openEditor()`.

Methods are attached to the prototype at load time from the mixins in
`src/editor.*.ts` — see [Architecture Overview](../architecture/overview.md).
