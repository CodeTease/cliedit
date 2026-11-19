# `cliedit` Documentation

`cliedit` is a zero-runtime-dependency, embeddable TUI text editor for Node.js. You import
`openEditor()` from your own CLI tool; the editor takes over the terminal in raw mode until
the user saves (`Ctrl+S`) or quits (`Ctrl+Q`).

## Getting Started

- [Installation & Hello World](./getting-started.md)
- [Basic Usage (openEditor, options, crash recovery)](./guide/basic-usage.md)
- [Piping & Stdin Support](./guide/piping.md)
- [Keyboard Shortcuts](./guide/shortcuts.md)

## Architecture (Advanced)

For contributors and anyone extending the editor:

- [Overview (module map, mixin pattern, state, undo/redo)](./architecture/overview.md)
- [Rendering (double buffering, visual-row viewport)](./architecture/rendering.md)
- [Syntax Highlighting (brackets, strings, worker thread)](./architecture/syntax-highlight.md)

## API Reference

- [Interfaces & Types (`openEditor`, `EditorOptions`, `DocumentState`, `EditorMode`, `NormalizedRange`)](./api/interfaces.md)

## Contributing

- [Development Workflow (Bun, build, tests, lint)](./contributing.md)

## Repository Entry Points

| What | Where |
| --- | --- |
| Package entry | `src/index.ts` — `openEditor()` |
| Editor class | `src/editor.ts` — `CliEditor` |
| Mixins | `src/editor.<area>.ts` |
| Rendering | `src/screen_buffer.ts`, `src/editor.rendering.ts` |
| Tests | `tests/*.test.ts` (Bun's runner) |
