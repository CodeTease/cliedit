# Contributing

Contributions to `cliedit` are welcome.

## Setup

1. **Fork** the repository and **clone** your fork.
2. Install [Bun](https://bun.sh/) and dependencies:

   ```bash
   bun install
   ```

   `bun.lock` is the lockfile. CI runs `bun ci`, which requires the lockfile to be up to
   date — commit it whenever you add or remove a devDependency.

   Only `devDependencies` may be added. `cliedit` has **zero runtime dependencies** and
   imports nothing but Node core modules at runtime.

## Development Workflow

### Building

```bash
bun run build
```

`tsc` compiles `src/` to `dist/`. This build is also the authoritative typecheck, since
`tsconfig.json` only includes `src/**/*.ts` and excludes `src/demo.ts`.

`bun check` (`bun run typecheck`) is a faster gate during iteration.

### Running the Demo

```bash
bun run demo
```

This builds first, then runs `src/demo.ts` with `NODE_ENV=development`. The demo imports
from `../dist/index.js`, so it always needs a fresh build. It writes `cliedit-demo.txt`
and a `.cliedit-demo.txt.swp`; both are gitignored (`*.txt`, `*.swp`).

### Testing

Tests use **Bun's built-in runner** with the vitest-style API
(`describe`/`it`/`expect`/`vi`).

```bash
bun test
```

`vitest` is not a dependency — `vitest.config.ts` no longer exists, and the `import ...
from 'vitest'` statements resolve through Bun's shim. Do not add `vitest` to
`package.json` without also changing the `test` script.

Unit tests cover pure logic: navigation, selection, history, the screen buffer, and the
syntax scanner. The TTY lifecycle (raw mode, alternate screen, swap files) is not
unit-tested. `tests/test_utils.ts` provides `createMockEditor(mixins)`, which builds a
`MockEditor` with stubbed I/O and applies the mixins you pass — use it instead of
instantiating the real `CliEditor` in a test.

Add new tests as `tests/<area>.test.ts`.

### Linting

```bash
bun run lint      # eslint src/
bun run lint:fix  # eslint src/ --fix
```

ESLint covers `src/` only and skips `src/vendor/`. CI treats lint as advisory
(`bun lint || exit 0`), but keep the tree clean.

## Guidelines

- **Zero runtime dependencies.** Solve small problems with Node core modules.
- **Follow the mixin pattern.** Add the function to the relevant `src/editor.<area>.ts` as
  `function name(this: CliEditor, ...)`, add it to that module's `*Methods` object (and to
  the hand-written `T*Methods` type if the module has one). A new *area* module must also
  be imported, added to the `CliEditor` interface merge, and `Object.assign`ed in
  `src/editor.ts`. New keys also need a route in `handleEditKeys()` and an entry in
  `docs/guide/shortcuts.md`.
- **Rendering goes through `ScreenBuffer`.** Do not write to `process.stdout` per cell;
  build the frame with `put`/`putString` and let `flush()` diff it. The only other direct
  writes are the cursor-position escape at the end of `render()` and the setup/teardown
  sequences in `editor.ts`.
- **Document mutations.** Call `setDirty()` and, when line text changes,
  `invalidateSyntaxCache()`; call `saveState()` *before* the first mutation of a multi-step
  edit so undo restores the pre-edit document. Single keystrokes save after the edit,
  because `handleKeypressEvent()` does it when the handler reports a change.
- **Imports use `.js` specifiers** (`from './types.js'`), because the project compiles with
  `moduleResolution: NodeNext`.
- **Match the surrounding formatting.** Two spaces in `editor.ts`/`index.ts`, four spaces in
  the `editor.*` mixins and `screen_buffer.ts`; single quotes, semicolons.
- **Comments explain why, not what.** No TODOs, banners, or narration.

## Before Opening a Pull Request

```bash
bun run build
bun test
bun run lint
```
