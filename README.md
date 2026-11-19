# cliedit

A lightweight, zero-runtime-dependency, raw-mode terminal editor component for Node.js.

`cliedit` is a library rather than a CLI: you `import { openEditor }` from your own
tool, and the editor takes over the terminal until the user saves or quits. It fits
wherever a CLI needs real multi-line input: commit messages, configuration files,
templates, or free-form text.

It ships line wrapping, visual navigation, smart auto-indentation, undo/redo, text
selection, Find/Replace, and cross-platform clipboard support.

A **CodeTease** project.

## Features

- **Raw-mode TTY:** enters the alternate screen, hides the cursor, and restores both on exit.
- **Visual line wrapping:** long lines wrap to the terminal width.
- **Visual navigation:** `Up`/`Down` move by visual row, so wrapped lines behave like separate rows.
- **Undo/redo:** `Ctrl+Z` / `Ctrl+Y`, snapshot based, 100 states.
- **Text selection:** `Ctrl+Arrow` extends a selection, including across wrapped lines.
- **Clipboard:** `Ctrl+C` (copy), `Ctrl+X` (cut), `Ctrl+V` / `Ctrl+U` (paste) through the system clipboard
  (`pbcopy`/`pbpaste` on macOS, `clip`/`Get-Clipboard` on Windows, `xclip` on Linux — the command
  must be installed, and a missing `xclip` fails silently).
- **Syntax highlighting:** brackets `() [] {}` and single/double-quoted strings, parsed on a worker thread.
- **File I/O:** loads the target file and writes it back on `Ctrl+S`.
- **Search & replace:** `Ctrl+W` to find, `Ctrl+R` to replace interactively, `Ctrl+G` for the next match.
- **Go to line:** `Ctrl+L`.
- **Smart indentation:** `Enter` keeps the current indentation; `Tab` inserts soft tabs;
  `Tab` / `Shift+Tab` indent or outdent a block.
- **Auto-pairing:** typing `(`, `[`, `{`, `'` or `"` inserts the pair; typing over a closer steps past it;
  `Backspace` removes an empty pair; typing an opener with a selection wraps the selection.
- **Line editing:** `Alt+Up`/`Alt+Down` move lines, `Ctrl+D` duplicates, `Ctrl+K`/`Ctrl+U` cut and paste lines.
- **Piping:** reads piped stdin, then re-opens the TTY so the user can keep typing.
- **Crash recovery:** refreshes a hidden swap file (`.name.swp`) every 2 seconds while editing.

> `Ctrl+M` (match bracket) is bound to the same byte as `Enter`, and `handleEditKeys()`
> matches `Enter` first, so bracket matching cannot be triggered from the keyboard in
> the current build. See [Keyboard Shortcuts](docs/guide/shortcuts.md).

## Design notes

- **The viewport is measured in visual rows.** `rowOffset` is a global visual-row index.
  Wrapping is recomputed from the line lengths every frame, so no layout cache has to be
  invalidated. The draw loop is bounded by the terminal height; mapping a visual row back
  to a line is a linear scan (`getLogicalFromVisual()`), which keeps memory flat but makes
  a frame cost grow with the number of lines above the viewport.
- **A frame is a diff.** `ScreenBuffer` keeps the grid that is on screen and the grid being
  built, then `flush()` writes only the cells that changed.
- **Highlighting is asynchronous and optional.** A worker thread parses lines; if the worker
  cannot start, the same pure parser runs synchronously on the main thread.

Tens of thousands of lines (configs, scripts, logs) are comfortable; very large files pay
for the per-frame visual-row scan.

## Installation

```shell
npm install cliedit
```

The library uses only Node core modules. The publish workflow builds and tests on Node.js 22.

## Usage

```typescript
import { openEditor } from 'cliedit';
import path from 'node:path';

async function getCommitMessage() {
  const tempFile = path.resolve(process.cwd(), 'COMMIT_MSG.txt');

  const result = await openEditor(tempFile, {
    tabSize: 2,
  });

  if (result.saved) {
    // Ctrl+S already wrote tempFile; result.content is what was written.
    console.log('Message saved:', result.content);
  } else {
    console.log('Editor quit without saving.');
  }
}

getCommitMessage().catch(console.error);
```

`Ctrl+S` saves the buffer to `filepath` and exits. `Ctrl+Q` exits without saving and asks
for a second `Ctrl+Q` within three seconds when the buffer is dirty (the prompt is stored in
`statusMessage` but not painted, so the first key looks ignored). A failed write does not
reject the promise: `saveFile()` records the error in `statusMessage` and `saved` still
reports whether the save key ran, so verify the file yourself when it matters.

## Public API

### `openEditor(filepath, options?)`

Opens the editor and resolves when it exits.

- **filepath:** path to read on start and write on `Ctrl+S`. It may be `''` for a pure
  scratch buffer, but saving then fails.
- **options:** optional `EditorOptions`:
  - `tabSize` (default `4`): spaces per soft tab and per indent step.
  - `gutterWidth` (default `5`): nominally the line-number gutter width, but `render()`
    calls `updateGutterWidth()` before drawing, which overwrites it with
    `max(5, digits + 3)`. The option therefore has no effect in the current build.
  - `inputStream` (default `process.stdin`): stream that supplies keypresses. `openEditor()`
    fills this in with a re-opened TTY when stdin is piped, and it mutates the options
    object you pass.
- **Returns:** `Promise<{ saved: boolean; content: string }>`
  - `saved`: `true` when the exit came from `Ctrl+S`, `false` when it came from `Ctrl+Q`.
  - `content`: the buffer at exit, newline-joined.

`openEditor()` rejects when `stdout` is not a TTY (`Editor requires a TTY environment (stdout).`)
and propagates non-`ENOENT` read errors.

### `CliEditor`

The editor class, exported for advanced embedding:

```typescript
import { CliEditor } from 'cliedit';

const editor = new CliEditor('initial text', 'notes.txt', { tabSize: 2 });
const { saved, content } = await editor.run();
```

The constructor only builds state; `run()` takes over the terminal and starts the swap
timer.

### Types

```typescript
import type { DocumentState, EditorMode, NormalizedRange } from 'cliedit';
```

`EditorOptions` is not re-exported by name; derive it with `Parameters<typeof openEditor>[1]`.
See the [API reference](docs/api/interfaces.md) for every field.

## Piping support

When stdin is not a TTY, `openEditor()` drains it, re-opens the terminal device
(`/dev/tty`, or `CONIN$` on Windows), and uses that for keypresses. Piped content takes
precedence over the file's contents, and `Ctrl+S` writes it to `filepath`.

```shell
# node app.js contains: await openEditor('notes.md')
cat template.md | node app.js

# Edit the output of another command
git diff | node app.js
```

See [Piping & Stdin](docs/guide/piping.md).

## Crash recovery

While the editor runs, `SwapManager` writes the buffer to `.<basename>.swp` next to the
target file (`.untitled.swp` in the working directory when `filepath` is empty), every two
seconds, and only when the content changed.

- If a session ends without saving (crash, kill, or `Ctrl+Q`), the swap file stays on disk.
- The next `openEditor(filepath)` finds it, prints a warning, waits 1.5 s, and reopens the
  recovered buffer marked dirty with `RECOVERED FROM SWAP FILE` set on the status message.
- A successful `Ctrl+S` deletes the swap file.
- Recovery needs a non-empty `filepath`; scratch buffers are not recovered.
- Note: the status bar's second row renders the fixed help text while in `edit` mode, so
  `setStatusMessage()` confirmations (including this marker) are stored but not painted.

## Development

```bash
bun install          # devDependencies (CI uses `bun ci`, i.e. a frozen lockfile)
bun run build        # tsc -> dist/
bun test             # Bun's test runner, 32 tests
bun run lint         # eslint src/
bun run demo         # build, then run src/demo.ts against dist/
```

See [docs/contributing.md](docs/contributing.md) for the full workflow.

## Documentation

- [Getting Started](docs/getting-started.md)
- [Basic Usage](docs/guide/basic-usage.md)
- [Piping & Stdin](docs/guide/piping.md)
- [Keyboard Shortcuts](docs/guide/shortcuts.md)
- [API Reference](docs/api/interfaces.md)
- [Architecture](docs/architecture/overview.md)

## License

[MIT](LICENSE)

The [LICENSE](LICENSE) file also contains the copyright notices and license terms for the
vendored [`keypress`](https://github.com/TooTallNate/keypress) component.

