# Rendering Architecture

The rendering system in `cliedit` is designed for performance and flicker-free updates, crucial for a terminal user interface (TUI).

## Double Buffering (`ScreenBuffer`)

Directly writing to `process.stdout` on every keystroke or frame update causes significant flickering and visual artifacts. To solve this, `cliedit` implements a **Double Buffering** strategy via the `ScreenBuffer` class (`src/screen_buffer.ts`).

### How It Works

1.  **Two Buffers:** The system maintains two 2D arrays representing the terminal grid:
    -   `currentBuffer`: Represents what is currently displayed on the user's screen.
    -   `nextBuffer`: Represents what the next frame *should* look like.

2.  **Drawing Phase:** All rendering logic (drawing text, gutters, status bar) writes to `nextBuffer`. This happens in memory and is extremely fast.

3.  **Flush Phase:** When `screenBuffer.flush()` is called:
    -   It iterates through every cell of the grid.
    -   It compares `nextBuffer[y][x]` with `currentBuffer[y][x]`.
    -   **Optimization:** If (and only if) the character or style has changed, it constructs the necessary ANSI escape sequence to move the cursor and update that specific cell.
    -   Finally, it writes the accumulated minimal change set to `stdout` in one go.

This ensures that only the necessary pixels (characters) are updated, resulting in a smooth experience even over SSH.

## Virtual Scrolling (Math-Only Viewport)

Rendering a large file (e.g., 10,000 lines) by iterating through every line would be prohibitively slow (O(N) per frame). `cliedit` uses a **Virtual Scrolling** technique.

### Logic

The editor maintains a `rowOffset` property, which represents the index of the top-most *visual* row currently visible.

1.  **Math-Based Lookup:** The function `getLogicalFromVisual(visualY)` (in `src/editor.rendering.ts`) calculates which logical line corresponds to a given visual row index. It accounts for line wrapping (where one long logical line might take up multiple visual rows).

2.  **Viewport Only:** The `render()` loop only iterates `screenRows` times (the height of the terminal). It starts from `rowOffset` and draws only the visible slice of the document.

3.  **Dynamic Gutter:** The gutter width is recalculated each frame (`updateGutterWidth`) based on the total number of lines, ensuring the layout adapts correctly.

This approach makes the rendering performance independent of file size—rendering a 100-line file takes roughly the same time as rendering a 1,000,000-line file (O(ScreenHeight)).
