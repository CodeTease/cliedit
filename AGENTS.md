# AGENTS.md

Guidance for AI coding agents working in this repository. Read this before
changing code; it records the conventions and sharp edges that are not obvious
from reading any single file.

## What this project is

`cliedit` is a zero-runtime-dependency, embeddable TUI text editor for Node.js.
It is a **library**, not a CLI: consumers import `openEditor()` and the editor
takes over the terminal in raw mode until the user saves or quits.

- Entry point: `src/index.ts` (`openEditor`).
- Core class: `CliEditor` in `src/editor.ts`.
- Package type: ESM (`"type": "module"`), compiled with `tsc` to `dist/`.
- Supported: Node 22 in CI (`.github/workflows/publish.yml`). Built with Bun;
  `bun.lock` is the lockfile (`package-lock.json` was removed).

## Commands

```bash
bun install          # install devDependencies (CI uses `bun ci`, i.e. frozen lockfile)
bun run build        # tsc -> dist/ (this is the authoritative typecheck)
bun test             # run tests/ (Bun's built-in runner, vitest-compatible API)
bun run lint         # eslint src/ only
bun run lint:fix     # eslint src/ --fix
bun run demo         # build, then run src/demo.ts against dist/
```

`bun run typecheck` (alias `bun check`) is a valid, fast gate. `tsconfig.json`
pins `"types": ["node"]` because TypeScript 6 defaults it to `[]`, which would
otherwise drop the Node globals.

## Repository layout

```
src/
  index.ts              public API (openEditor), stdin piping, swap recovery
  editor.ts             CliEditor class: state, TTY lifecycle, mixin assembly
  editor.<area>.ts      mixins (editing, clipboard, navigation, rendering,
                        search, history, io, keys, selection, syntax, swap)
  screen_buffer.ts      double-buffered terminal grid + ANSI diffing
  history.ts            snapshot undo/redo stack
  syntax.common.ts      pure per-line bracket/quote scanner
  syntax.worker.ts      worker-thread wrapper around syntax.common
  constants.ts          ANSI escape codes and key sequences
  types.ts              DocumentState, EditorMode, EditorOptions
  vendor/keypress.ts    vendored keypress library (see LICENSE)
  demo.ts               dev-only runner; NOT part of the build
tests/                  *.test.ts, shares tests/test_utils.ts
docs/                   user and architecture documentation
```

## Architecture: the mixin pattern

`CliEditor` is deliberately thin. Behaviour lives in `src/editor.*.ts` modules
that export a plain object of functions. `src/editor.ts` merges those objects
into the prototype:

```ts
export interface CliEditor extends TEditingMethods, TRenderingMethods, /* ... */ {}
Object.assign(CliEditor.prototype, editingMethods);
```

Every mixin method declares `this: CliEditor`, which is how the functions get
typed access to editor state (`this.lines`, `this.cursorX`, ...) without
inheritance. The interface merge makes those methods visible on the class type.

### Adding a capability

1. Write the function in the relevant `src/editor.<area>.ts` as
   `function name(this: CliEditor, ...)`, relying on `this` for state.
2. Add it to that module's exported `*Methods` object.
3. If the module declares a `T*Methods` type, add the signature there too.
4. A new *area* module must also be imported, added to the `CliEditor`
   `interface` merge, and `Object.assign`ed at the bottom of `src/editor.ts`.
5. Route the key in `handleEditKeys()` (`src/editor.keys.ts`) and update
   `docs/guide/shortcuts.md`.

## Conventions

- **Zero runtime dependencies.** Only `devDependencies`. Do not add a runtime
  dependency for something small.
- **Import specifiers use `.js`.** `moduleResolution: NodeNext`; write
  `from './types.js'` even though the file is `types.ts`.
- **Comments explain *why*, not *what*.** Do not narrate a train of thought,
  leave "TODO/FIXME/for now/let's" notes, or mark fixes with banners. If a
  choice is non-obvious, state the reason in one or two lines.
- **Colour/style constants live in `constants.ts`** (`ANSI`, `KEYS`). Never
  inline escape sequences in feature code.
- **Rendering goes through `ScreenBuffer`.** Do not write to `process.stdout`
  per cell; build a frame with `put`/`putString`, then `flush()`, which emits the
  diff. The only other direct writes are the cursor-position escape at the end of
  `render()` and the setup/teardown sequences in `editor.ts`.
- **Mutating document content** should call `setDirty()` and, when line text
  changes, `invalidateSyntaxCache()`. Call `saveState()` before the first
  mutation of a multi-step edit so undo restores the pre-edit document.
- **Formatting:** 2 spaces in `editor.ts`/`index.ts`, 4 spaces in the
  `editor.*` mixins and `screen_buffer.ts`, single quotes, semicolons. Match the
  surrounding file rather than reformatting it.

## Testing

Tests use Bun's built-in runner but are written against the vitest API
(`describe`/`it`/`expect`/`vi`), so `vitest.config.ts` and the imports stay
valid. `tests/test_utils.ts` provides `createMockEditor(mixins)`, which builds a
`MockEditor` with stubbed I/O and applies the mixins you pass in — the standard
way to unit-test mixin logic without a TTY.

- Add tests under `tests/<area>.test.ts`.
- Prefer pure logic (navigation, selection, history, screen buffer, syntax);
  the TTY lifecycle is not unit-testable here.
- Run `bun test` and `bun run build` before declaring work done.

## Behavioural model

These three ideas prevent most bugs:

1. **The viewport is measured in visual rows, not lines.** `rowOffset` is a
   global visual row index; one logical line can occupy several visual rows
   because of wrapping. The only conversions are `getLineVisualHeight()` and
   `getLogicalFromVisual()` (`editor.rendering.ts`) and
   `findCurrentVisualRowIndex()` (`editor.navigation.ts`). Nothing caches a
   visual layout, so content changes are picked up on the next frame.
2. **A frame is a diff.** `ScreenBuffer` keeps `currentBuffer` (on screen) and
   `nextBuffer` (being drawn). `clear()` blanks `nextBuffer`; `flush()` emits
   only changed cells. `resize()` sets `forceRedraw`, which repaints the whole
   grid because it no longer describes the terminal.
3. **Highlighting is asynchronous and optional.** `getLineSyntaxColor()` posts
   the line to a worker and returns an empty map immediately; a cached empty map
   means "request in flight" and stops the same line being re-posted every
   frame. `invalidateSyntaxCache()` clears the whole cache. If the worker cannot
   start, the pure synchronous parser is used instead.

## Known gotchas

- **TypeScript 6 no longer auto-includes `@types/*`.** The default of `types` is
  now `[]`, so `@types/node` must be listed explicitly; `tsconfig.json` does
  that. Removing the entry makes every `process`/`fs`/`Buffer` reference fail
  with `TS2591`. A side effect of loading the real Node typings is that
  `EventEmitter.listenerCount` is overloaded for `EventTarget`, so helpers that
  take the static as a value must narrow it (see `src/vendor/keypress.ts`).
- **`vitest` is not a dependency.** Tests import from `vitest`, but only Bun's
  built-in shim satisfies those imports; there is no `vitest.config.ts` and no
  `vitest` package. Do not add `vitest` to `package.json` without also changing
  the `test` script.
- **`tsconfig.json` only includes `src/**/*.ts`** and excludes `src/demo.ts`, so
  `tests/` and the demo are not typechecked by `tsc`. `eslint` likewise covers
  `src/` only and skips `src/vendor/`.
- **`src/demo.ts` imports from `../dist/index.js`**, so the demo always needs a
  build first — that is why `bun run demo` builds before running it.
- **The syntax worker is loaded by path** (`join(__dirname, 'syntax.worker.js')`),
  so it must keep compiling to a sibling of `dist/editor.js`. If the build
  layout changes, the worker is silently skipped and highlighting falls back to
  the synchronous parser.
- **Swap files are real files.** They are written every 2s to
  `.<basename>.swp` next to the target (`.untitled.swp` when there is no
  filepath). They are gitignored; clean them up in tests and demos.
- **`openEditor` mutates the caller's options object** when piping, so the
  editor can read from a re-opened TTY. Keep that in mind when reusing an
  options object across calls.

## Licensing

`LICENSE` contains the project's MIT license **and** a "Third-Party Notices"
section covering the vendored `keypress` component. If you vendor or adapt
another open-source component, add its attribution and license text to that
section as well as to the header of `src/vendor/<name>.ts`.
