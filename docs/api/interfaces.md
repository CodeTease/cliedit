# API Reference: Interfaces

This document outlines the core types and interfaces used in `cliedit`.

## `EditorOptions`

Configuration object passed to the `openEditor` function or `CliEditor` constructor.

```typescript
export interface EditorOptions {
    /**
     * The number of spaces a tab character represents.
     * Default: 4
     */
    tabSize?: number;

    /**
     * The initial width of the line number gutter.
     * Default: 5
     */
    gutterWidth?: number;

    /**
     * The readable stream to use for keyboard input.
     * Defaults to process.stdin.
     * Useful for advanced scenarios (e.g. testing or custom TTY handling).
     */
    inputStream?: NodeJS.ReadStream;
}
```

## `DocumentState`

Represents a snapshot of the editor state, used by the Undo/Redo system (`HistoryManager`).

```typescript
export type DocumentState = { 
    /**
     * The content of the document, split by newline.
     */
    lines: string[];

    /**
     * The logical column index of the cursor (0-based).
     */
    cursorX: number;

    /**
     * The logical row index of the cursor (0-based).
     */
    cursorY: number; 
};
```

## `EditorMode`

Enum-like string union representing the current interaction mode of the editor.

```typescript
export type EditorMode = 
  | 'edit'             // Standard editing mode
  | 'search_find'      // Entering search query
  | 'search_replace'   // Entering replacement string
  | 'search_confirm'   // Confirming replacement (y/n/a/q)
  | 'goto_line';       // Entering line number
```

## `NormalizedRange`

Represents a selected range of text, guaranteed to have `start` before `end`.

```typescript
export type NormalizedRange = {
    start: {
        line: number;
        col: number;
    };
    end: {
        line: number;
        col: number;
    };
};
```
