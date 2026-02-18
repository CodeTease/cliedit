# Architecture Overview

`cliedit` is built with a focus on maintainability and separation of concerns, utilizing a Mixin pattern to keep the core class lightweight while extending functionality through modular components.

## The Mixin Pattern

The heart of the application is the `CliEditor` class defined in `src/editor.ts`. However, you won't find thousands of lines of code in this file. Instead, it serves as a central state container and event coordinator.

Specific functionalities are implemented in separate modules:

- `src/editor.editing.ts`: Core text manipulation (insert, delete, indent).
- `src/editor.rendering.ts`: Display logic (draw to screen buffer).
- `src/editor.keys.ts`: Input handling and routing.
- `src/editor.navigation.ts`: Cursor movement logic.
- `src/editor.search.ts`: Find and Replace operations.
- ...and others.

These modules export objects containing methods, which are then merged into the `CliEditor` prototype at runtime:

```typescript
// src/editor.ts
Object.assign(CliEditor.prototype, editingMethods);
Object.assign(CliEditor.prototype, navigationMethods);
// ...
```

This approach allows us to:
1.  **Organize Code Logically:** Related functions live together.
2.  **Keep Files Small:** Easier to read and review.
3.  **Share State Easily:** All methods operate on `this` (the `CliEditor` instance), giving them access to the document state without prop drilling.

## State Management

The editor's state is primarily held in the `CliEditor` instance properties:

- **`lines`** (`string[]`): The document content, split by newline.
- **`cursorX`, `cursorY`** (`number`): The current cursor position (logical).
- **`mode`** (`EditorMode`): Current interaction mode (e.g., `'edit'`, `'search_find'`).
- **`scrollTop`, `scrollLeft`** (managed via `rowOffset`): Viewport position.

### Undo/Redo History

History is managed by the `HistoryManager` class (`src/history.ts`).

Instead of complex Operational Transformation (OT) or differential patches, `cliedit` uses a **Snapshot** approach for simplicity and reliability:

1.  A **`DocumentState`** is defined as `{ lines: string[], cursorX: number, cursorY: number }`.
2.  Before any destructive operation (typing, deleting), the current state is pushed to the Undo stack.
3.  **Undo** simply restores the previous state.
4.  **Redo** restores the state from the Redo stack.

This trade-off (memory usage vs. complexity) is acceptable for the typical use case of editing configuration files or commit messages in a CLI environment.
