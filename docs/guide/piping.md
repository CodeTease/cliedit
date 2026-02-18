# Piping Support

One of `cliedit`'s most powerful features is its ability to accept piped input (stdin) while still functioning as an interactive text editor.

This allows you to create CLI workflows where data is processed by one tool and then immediately edited by the user.

## How It Works

Normally, a TUI application requires `stdin` to be a TTY (teletypewriter) to receive keyboard input. However, when you pipe data into a process (e.g., `echo "hello" | my-app`), `stdin` is connected to that pipe, not the keyboard.

`cliedit` handles this gracefully:

1.  **Detects Non-TTY Stdin:** It checks `!process.stdin.isTTY`.
2.  **Reads Content:** It consumes all data from the pipe until the stream ends. This becomes the initial content of the editor.
3.  **Re-opens TTY:** Crucially, it then manually opens the terminal device (`/dev/tty` on Unix/Linux/macOS, or `CONIN$` on Windows) as a new input stream.
4.  **Interactive Mode:** The editor uses this new stream to listen for keypresses, allowing full interactivity.

## Usage Example

Imagine a tool that grabs a template and lets you edit it before saving:

```bash
# cat template.txt | node create-post.js
```

Inside `create-post.js`:

```typescript
import { openEditor } from 'cliedit';

// If data is piped, openEditor reads it automatically!
const { saved, content } = await openEditor('new-post.md');

if (saved) {
  // Save the edited content to the file
  await fs.writeFile('new-post.md', content);
}
```

This makes `cliedit` suitable for tools like `git commit` editors, interactive rebase helpers, or configuration wizards that start with defaults.
