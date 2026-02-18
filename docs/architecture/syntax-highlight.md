# Syntax Highlighting Architecture

Syntax highlighting in `cliedit` is designed to be lightweight and non-blocking, ensuring that typing and navigation remain responsive even when parsing complex files.

## Worker Threads

Parsing code for syntax highlighting can be computationally expensive, especially for large files or complex grammars. Running this on the main JavaScript thread (which also handles input and rendering) would cause noticeable lag.

To solve this, `cliedit` offloads syntax parsing to a **Worker Thread** (`src/syntax.worker.ts`).

### The Workflow

1.  **Initialization:** When the editor starts, it spawns a Node.js `Worker`.
2.  **Dispatch:** Whenever a line changes or needs to be highlighted, the main thread sends a message to the worker containing:
    -   The line index (`lineIndex`).
    -   The line content (`content`).
3.  **Processing (Background):** The worker receives the message and runs the parsing logic (`parseLineSyntax` in `src/syntax.common.ts`).
    -   This function identifies tokens (keywords, strings, comments) and assigns colors.
4.  **Result:** The worker sends back a `Map<number, string>` (mapping column index to ANSI color code).
5.  **Update:** The main thread receives the map, updates its `syntaxCache`, and triggers a partial re-render if the line is currently visible.

## Parsing Logic ("Poor Man's Highlighting")

The current implementation uses a simple, regex-based tokenizer designed for speed and simplicity rather than full semantic analysis.

It supports:
-   **Keywords:** Common language keywords (e.g., `function`, `class`, `if`, `return`).
-   **Strings:** Single (`'`) and double (`"`) quoted strings.
-   **Comments:** Single-line comments (`//`).
-   **Numbers:** Integers and floats.

This approach is "good enough" for quick edits in a terminal without the overhead of a full language server or TextMate grammar engine.
