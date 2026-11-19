# Rendering Architecture

Rendering aims for flicker-free updates inside one terminal viewport. Two mechanisms do
the work: a diffing `ScreenBuffer` and a visual-row viewport model.

## Double Buffering (`ScreenBuffer`)

In `src/screen_buffer.ts`:

1. **Two grids.** `currentBuffer` describes what is on screen; `nextBuffer` is what is
   being drawn. Each cell is `{ char, style }`.
2. **Draw phase.** `render()` calls `clear()` (which blanks `nextBuffer`) and then places
   every visible cell with `put()` / `putString()`. All of this is in memory.
3. **Flush phase.** `flush()` walks the grid row by row and compares the two buffers. For
   each changed cell it emits a cursor move (only when the next cell is not adjacent), a
   style change (only when it differs from the previous one), and the character. The whole
   frame is written to `process.stdout` in a single `write()`, so the terminal receives one
   minimal, ordered update per frame.

Details that matter when changing the renderer:

- **`forceRedraw`.** `resize()` sets it; the next `flush()` emits `CLEAR_SCREEN` and marks
  `currentBuffer` invalid so every cell is repainted. This is how a terminal resize
  recovers, since the old grid no longer matches the screen.
- **Styles are complete, not incremental.** Each cell stores its whole style string, and
  `flush()` emits `RESET_COLORS` before applying it. Styles are mutually exclusive, so the
  render priority in `render()` is a flat `if/else if` chain:
  selection → cursor → current search match → other search match → syntax colour.
- **One character per cell.** `putString()` advances one column per UTF-16 code unit. Wide
  (CJK) glyphs, combining marks, and emoji are not measured and will overflow their cell.
- **The buffer does not position the physical cursor.** `render()` writes the final
  `ESC[y;xH` itself, after `flush()`, so the cursor lands on the document cursor.

## Viewport Model: Visual Rows

The viewport is measured in **visual rows**, not logical lines. `rowOffset` is the global
visual-row index of the top row.

The three conversions live in `editor.rendering.ts` and `editor.navigation.ts`:

- `getLineVisualHeight(i)` → `ceil(line.length / contentWidth)`, minimum 1. Empty lines
  still occupy one row.
- `getLogicalFromVisual(visualY)` → `{ logicalY, visualYOffset }`. **This is a linear scan
  from line 0**, so its cost grows with the number of lines before the target row.
- `findCurrentVisualRowIndex()` → sums the heights of the lines above the cursor plus
  `floor(cursorX / contentWidth)`.

`contentWidth = max(1, screenCols - gutterWidth)`. Nothing caches a visual layout, so an
edit or a resize is reflected on the next frame without invalidation.

### The Draw Loop

```
while (visualRowsRendered < screenRows) {
  if (logicalY >= lines.length) → fill the rest with '~' (cyan) and stop
  for each visual chunk v of the current line, starting at visualOffsetInLine:
    gutter (dim)  →  up to contentWidth characters  →  scrollbar column
}
renderStatusBarToBuffer()
screenBuffer.flush()
write cursor position
```

Three rendering tasks share that loop:

- **Gutter.** Recomputed every frame by `updateGutterWidth()` as
  `max(5, String(lines.length).length + 3)`. Continuation rows of a wrapped line get
  spaces, so the width never jitters between rows.
- **Scrollbar.** Drawn only when `lines.length > screenRows`: `┃` for the thumb, `│` for
  the track, in the last column. The thumb position is derived from `rowOffset`, so it is
  approximate when long lines wrap.
- **Status bar.** Two rows below the document (`screenRows = stdout.rows - 2`): row 1
  shows `[filepath]` (prefixed with `*` when dirty) and
  `Ln N, Col M (View: V,C)`; row 2 shows the current prompt (`Find:`, `Replace with:`,
  `Go to Line:`) or, in `edit` mode, the fixed `DEFAULT_STATUS` help string.
  Note that `setStatusMessage()` writes to `statusMessage`, but the second row only
  renders that field outside `edit` mode — so transient confirmations such as
  `Saved: ...`, `Undo successful`, or `Clipboard error: ...` are not actually painted
  while editing. Change `renderStatusBarToBuffer()` if you need them visible.

### Cost

A frame does `O(screenRows)` drawing work, plus the cost of `getLogicalFromVisual()` and
`getLineVisualHeight()` calls, which sum the heights of preceding lines. Memory stays flat
because no per-line layout array is stored, but frame time grows with the number of lines
above the viewport. Very large files would need an index (for example, a prefix-sum tree)
over visual heights to become truly `O(screenRows)`.
