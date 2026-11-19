# Syntax Highlighting Architecture

Highlighting is deliberately minimal and never blocks a frame. It colours **brackets** and
**quoted strings** only.

## What Is Highlighted

`parseLineSyntax()` in `src/syntax.common.ts` is a single-pass state machine over the
characters of one line:

| Input | Style |
| --- | --- |
| `(`, `)`, `[`, `]`, `{`, `}` outside a string | `ANSI.YELLOW` |
| Characters inside `'...'` or `"..."`, including the quotes | `ANSI.GREEN` |

A quote is escaped when preceded by an odd number of backslashes (`\"` does not close the
string, `\\"` does). State does **not** carry across lines: a multi-line string is parsed
as if each line started outside a string.

There are no keyword, comment, or number rules, despite what a generic "syntax
highlighting" label suggests. That is intentional: the scanner is a pure function with no
configuration, which keeps it cheap enough to run per visible line on every frame.

## Worker Thread

The parse itself is trivial, but the architecture keeps it off the main thread so
highlighting cost never lands inside a keypress:

1. **Initialization.** The `CliEditor` constructor creates a `Worker` from
   `join(__dirname, 'syntax.worker.js')`, i.e. a sibling of `dist/editor.js`. If worker
   creation throws, `syntaxWorker` stays `null` and highlighting falls back to the
   synchronous path. Nothing else changes.
2. **Dispatch.** `getLineSyntaxColor(lineIndex, lineContent)` (`src/editor.syntax.ts`)
   checks `syntaxCache`; on a miss it posts `{ lineIndex, content }` and returns an
   **empty** map immediately.
3. **Processing.** `src/syntax.worker.ts` calls `parseLineSyntax()` and posts back
   `{ lineIndex, colorMap }`.
4. **Cache.** `handleWorkerMessage()` in `src/editor.ts` stores the map in `syntaxCache`
   and calls `render()`. The screen-buffer diff makes the extra repaint cheap.

### The In-Flight Marker

Because the first call returns an empty map, that empty map is cached under the line index.
`render()` therefore stops re-posting the same line on every frame — a cached map means
"already requested". The worker reply overwrites it.

The consequence to remember: **an empty cached map is indistinguishable from a line with
nothing to highlight.** Lines edited since their request are handled by
`invalidateSyntaxCache()`, which clears the whole cache (not one entry) and is called from
`insertContentAtCursor()`, `insertCharacter()`, `insertNewLine()`, `deleteBackward()`,
`deleteForward()`, indent/outdent, and undo/redo.

Because the cache is keyed by line index and only cleared wholesale, any structural edit
correctly repaints, at the cost of re-parsing every visible line.

## Fallback Path

When `syntaxWorker` is `null` — tests, or an environment where the worker cannot start —
`getLineSyntaxColor()` runs `parseLineSyntax()` inline and caches the result. Behaviour is
identical apart from where the parse happens.

## Practical Notes

- **The worker is loaded by path.** It must keep compiling next to `editor.js`; if the build
  layout changes, worker construction fails silently and highlighting degrades to the
  synchronous path.
- **One line per message, no batching.** Scrolling into a screenful of new lines posts one
  message per line, each answered by its own `render()`.
- **Wide characters are not accounted for.** Column indices in the colour map are UTF-16
  offsets, which line up with `ScreenBuffer`'s one-code-unit-per-cell assumption.
