# Piping Support

`cliedit` accepts piped input on stdin and still behaves as an interactive editor, so a
CLI can pre-fill the buffer with data from another command.

## How It Works

A TUI needs stdin to be a TTY to receive keystrokes. When you pipe data into a process,
stdin is the pipe instead. `openEditor()` handles that (`src/index.ts`):

1. **Detect non-TTY stdin:** `!process.stdin.isTTY`.
2. **Drain the pipe:** every chunk is collected until the stream ends; this text becomes
   the starting buffer.
3. **Re-open the terminal:** it opens `/dev/tty` (or `CONIN$` on Windows), wraps the fd in
   a `tty.ReadStream`, and assigns it to `options.inputStream`.
4. **Edit interactively:** keypresses come from the re-opened TTY, so the editor works
   exactly as it does without a pipe.

If any of this fails (for example, no controlling terminal in a container), the error is
logged and the editor falls back to `process.stdin` — which is the drained pipe, so
keypresses will not arrive. Treat piping as requiring a real terminal.

## Precedence and Saving

- **Piped content wins over the file.** `initialContent` starts as the piped text, and the
  file is only read when stdin produced nothing. The file's existing content is *not*
  merged into the buffer.
- **`Ctrl+S` writes to `filepath`.** The piped text is not printed to stdout; it is saved
  to the path you passed, so the pipe is effectively an input redirection.
- **`Ctrl+Q` leaves the file alone** but still leaves a swap file behind (see
  [Crash Recovery](./basic-usage.md#crash-recovery)).
- **Options objects are mutated.** `openEditor()` writes `inputStream` into the options
  object you pass, so create a fresh object per call.

## Usage Example

`create-post.js`:

```javascript
import { openEditor } from 'cliedit';

// 'new-post.md' is where Ctrl+S writes; piped stdin seeds the buffer.
const { saved, content } = await openEditor('new-post.md');

if (saved) {
  console.log(`Saved ${content.length} characters to new-post.md`);
} else {
  console.log('Discarded.');
}
```

Run it with content from another command:

```bash
cat template.md | node create-post.js

# or from a template that another tool generates
git log -1 --pretty=%B | node create-post.js
```

Do not write `content` back to the file yourself: `Ctrl+S` already did that, and doing it
twice re-creates the file after the editor has exited.

This makes `cliedit` suitable for commit-message editors, interactive rebase helpers, or
configuration wizards that start from a default document.
