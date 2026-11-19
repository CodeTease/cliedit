# Basic Usage

The entry point for `cliedit` is `openEditor` from `src/index.ts`.

## The `openEditor` Function

```typescript
import { openEditor } from 'cliedit';

const result = await openEditor(filepath, options);
```

### Parameters

- `filepath` (string): the file read on start and written by `Ctrl+S`. If it does not
  exist, `openEditor()` starts with an empty buffer and creates the file on save
  (`ENOENT` is the only read error it ignores). Pass `''` for a scratch buffer — saving
  then fails, and because `saveFile()` only records the error in `statusMessage` (which
  the status bar does not paint in `edit` mode), the failure is silent.
- `options` (optional): an `EditorOptions` object.

### Options (`EditorOptions`)

- **`tabSize`** (number, default 4): spaces per soft tab and per indent/outdent step.
- **`gutterWidth`** (number, default 5): nominally the gutter width, but `render()` calls
  `updateGutterWidth()` before drawing, which overwrites it with
  `max(5, String(lines.length).length + 3)`. The option has no effect in the current build.
- **`inputStream`** (`NodeJS.ReadStream`, default `process.stdin`): where keypresses come
  from. Set automatically when stdin is piped — see [Piping](./piping.md).

Example:

```typescript
await openEditor('config.json', {
    tabSize: 2,
});
```

## Handling the Result

The promise resolves to:

```typescript
{
    saved: boolean;   // true when the user pressed Ctrl+S, false after Ctrl+Q
    content: string;  // the buffer at exit, joined with "\n"
}
```

`Ctrl+S` already wrote the buffer to `filepath` before the promise resolves, so most
callers only need `saved` to decide whether to keep going. `Ctrl+Q` on a dirty buffer
requires a second `Ctrl+Q` within three seconds and leaves the file untouched.

A failed write does **not** reject the promise: `saveFile()` records the message in
`statusMessage` and `handleSave()` still resolves with `saved: true` and the in-memory
content. Since the status bar renders the fixed help text in `edit` mode, that error is not
displayed — verify the bytes on disk yourself if the save matters.

The promise *does* reject at startup when `stdout` is not a TTY
(`Editor requires a TTY environment (stdout).`), so guard interactive paths:

```typescript
if (!process.stdout.isTTY) {
    throw new Error('This command needs an interactive terminal.');
}
```

## Crash Recovery

Crash recovery is managed by `SwapManager` (`src/editor.swap.ts`).

- **Mechanism:** a hidden swap file sits next to the target: `.<basename>.swp`
  (`notes.txt` → `.notes.txt.swp`). With an empty `filepath` it falls back to
  `.untitled.swp` in the working directory.
- **Auto-save:** every 2 seconds while the editor runs, and only when the content changed
  since the previous swap write.
- **Recovery:** if a session ends without saving (crash, kill, `Ctrl+Q`), the swap file
  remains. The next `openEditor(filepath)` prints a warning, waits 1.5 s, reopens the swap
  content as a dirty buffer, and marks it `RECOVERED FROM SWAP FILE`. Because the status
  bar renders the fixed help text in `edit` mode, that marker is stored in `statusMessage`
  rather than displayed; the reliable signal is the dirty flag and the warning printed
  before the TUI starts.
- **Cleanup:** only a successful `Ctrl+S` deletes the swap file. Quitting with `Ctrl+Q`
  intentionally leaves it behind, so the next open recovers the unsaved work. Delete it
  by hand if you do not want that.
- Recovery requires a non-empty `filepath`; scratch buffers are never recovered.
