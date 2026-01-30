# cliedit

A lightweight, zero-dependency, raw-mode terminal editor component for Node.js.

`cliedit` is designed to be imported into your own CLI application to provide a full-featured, TTY-based text editing experience. It's perfect for applications that need to ask the user for multi-line input, edit configuration files, or write commit messages.

It includes line wrapping, visual navigation, smart auto-indentation, undo/redo, text selection, Find/Replace, and cross-platform clipboard support.

A **CodeTease** project.

## Features

- **Raw Mode TTY:** Takes over the terminal for a full "app-like" feel.
- **Visual Line Wrapping:** Text wraps to fit the terminal width.
- **Visual Navigation:** `Up`/`Down` arrows move by visual rows, not logical lines.
- **Undo/Redo:** `Ctrl+Z` / `Ctrl+Y` for persistent history.
- **Text Selection:** `Ctrl+Arrow` keys to select text.
- **Clipboard Support:** `Ctrl+C` (Copy), `Ctrl+X` (Cut), `Ctrl+V` (Paste) for system clipboard (macOS, Windows, **and Linux** via `xclip`).
- **Syntax Highlighting:** Lightweight highlighting for Brackets `()` `[]` `{}` and Strings `""` `''`.
- **File I/O:** Loads from and saves to the filesystem.
- **Search & Replace:** `Ctrl+W` to find text, `Ctrl+R` to find and replace interactively.
- **Go to Line:** `Ctrl+L` to quickly jump to a specific line number.
- **Smart Auto-Indentation:** Automatically preserves indentation level when pressing Enter.
- **Block Indentation:** Use `Tab` / `Shift+Tab` to indent or outdent selected blocks of text.
- **Smart Navigation:** `Alt + Left/Right` to jump by words, `Ctrl + M` to jump between matching brackets.
- **Line Moving:** `Alt + Up/Down` to move the current line or selection up and down.
- **Line Duplication:** `Ctrl+D` to duplicate the current line or selection.
- **Piping Support:** Works with standard Unix pipes (e.g. `cat file.txt | cliedit`).
- **Crash Recovery:** Automatically saves changes to a hidden swap file (e.g. `.filename.swp`) to prevent data loss.

### Architecture Improvements

`cliedit` employs a optimization strategy to handle large files efficiently while maintaining a responsive UI:

*   **Math-Only Viewport:** Rendering is stateless. The editor calculates visual wrapping on the fly (Virtual Scrolling) rather than storing a massive state array, significantly reducing memory usage for large documents.
*   **Screen Buffer Diffing:** A double-buffering system compares the current and next frame to send only the changed characters to the terminal, minimizing I/O and eliminating flicker.
*   **Worker Threads:** Syntax highlighting runs asynchronously in a background Worker Thread, preventing UI freezes during rendering of complex lines.
*   **Recommended Limits:** Good for files up to 50k lines (perfect for configs, scripts, and logs).

## Installation
```shell
npm install cliedit
```

## Usage

The package exports an `async` function `openEditor` that returns a `Promise`. The promise resolves when the user quits the editor.

```typescript
import { openEditor } from 'cliedit';
import path from 'path';

async function getCommitMessage() {
  const tempFile = path.resolve(process.cwd(), 'COMMIT_MSG.txt');
  
  // Example with custom options
  const options = {
    tabSize: 2,
    gutterWidth: 3
  };

  try {
    const result = await openEditor(tempFile, options);

    if (result.saved) {
      console.log('Message saved:', result.content);
    } else {
      console.log('Editor quit without saving.');
    }
  } catch (err) {
    console.error('Editor failed:', err);
  }
}

getCommitMessage();
```

### Piping Support

`cliedit` supports standard input piping. When used in a pipeline, it reads the input content, then re-opens the TTY to allow interactive editing.

```shell
# Edit a file using cat
cat README.md | node my-app.js

# Edit the output of a command
git diff | node my-app.js
```

## Public API

`openEditor(filepath: string, options?: EditorOptions)`

Opens the editor for the specified file.

- **filepath**: Path to the file to edit.
- **options**: (Optional) Configuration object.
    - `tabSize`: Number of spaces for a tab (default: 4).
    - `gutterWidth`: Width of the line number gutter (default: 5).

  - **Returns:** `Promise<{ saved: boolean; content: string }>`
      * `saved`: `true` if the user saved (Ctrl+S), `false` otherwise (Ctrl+Q).
      * `content`: The final content of the file as a string.

### Crash Recovery

`cliedit` includes a built-in safety mechanism. It periodically saves the current content to a hidden swap file (e.g., `.myfile.txt.swp`) in the same directory. 

If the process crashes or is terminated abruptly, the next time you open the file, `cliedit` will detect the swap file and automatically recover the unsaved content, displaying a `RECOVERED FROM SWAP FILE` message.

  - **Returns:** `Promise<{ saved: boolean; content: string }>`
      * `saved`: `true` if the user saved (Ctrl+S), `false` otherwise (Ctrl+Q).
      * `content`: The final content of the file as a string.

`CliEditor`

The main editor class. You can import this directly if you need to extend or instantiate the editor with custom logic.

```typescript
import { CliEditor } from 'cliedit';
```

### Types

Key types are also exported for convenience:

```typescript
import type {
  DocumentState,
  EditorMode,
  NormalizedRange,
} from 'cliedit';
```

## Acknowledgements

Please see the [ACKNOWLEDGEMENTS.md](ACKNOWLEDGEMENTS.md) file for important copyright information regarding the vendored `keypress` component.

## License

[MIT](LICENSE)