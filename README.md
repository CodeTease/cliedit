# cliedit

A lightweight, zero-dependency (other than `keypress`), raw-mode terminal editor component for Node.js.

`cliedit` is designed to be imported into your own CLI application to provide a full-featured, TTY-based text editing experience. It's perfect for applications that need to ask the user for multi-line input, edit configuration files, or write commit messages.

It includes line wrapping, visual navigation, undo/redo, text selection, and clipboard support.

## Features

- **Raw Mode TTY:** Takes over the terminal for a full "app-like" feel.
- **Visual Line Wrapping:** Text wraps to fit the terminal width.
- **Visual Navigation:** `Up`/`Down` arrows move by visual rows, not logical lines.
- **Undo/Redo:** `Ctrl+Z` / `Ctrl+Y` for persistent history.
- **Text Selection:** `Ctrl+Arrow` keys to select text.
- **Clipboard Support:** `Ctrl+C` (Copy), `Ctrl+X` (Cut), `Ctrl+V` (Paste) for system clipboard (macOS/Windows).
- **File I/O:** Loads from and saves to the filesystem.
- **Search:** `Ctrl+W` to find text.

## Installation
```bash
npm install cliedit
```

## Usage

The package exports an `async` function `openEditor` that returns a `Promise`. The promise resolves when the user quits the editor.
```javascript
import { openEditor } from 'cliedit';
import path from 'path';

async function getCommitMessage() {
  const tempFile = path.resolve(process.cwd(), 'COMMIT_MSG.txt');
  console.log('Opening editor for commit message...');

  try {
    const result = await openEditor(tempFile);

    // Give the terminal a moment to restore
    await new Promise(res => setTimeout(res, 50));

    if (result.saved) {
      console.log('Message saved!');
      console.log('---------------------');
      console.log(result.content);
      console.log('---------------------');
    } else {
      console.log('Editor quit without saving.');
    }
  } catch (err) {
    console.error('Editor failed to start:', err);
  }
}

getCommitMessage();
```

## Public API

`openEditor(filepath: string)`

Opens the editor for the specified file. If the file doesn't exist, it will be created upon saving.
- **Returns:** `Promise<{ saved: boolean; content: string }>`
    * `saved`: `true` if the user saved (Ctrl+S), `false` otherwise (Ctrl+Q).
    * `content`: The final content of the file as a string.

`CliEditor`

The main editor class. You can import this directly if you need to extend or instantiate the editor with custom logic.
```javascript
import { CliEditor } from 'cliedit';
```

### Types

Key types are also exported for convenience:
```javascript
import type {
  DocumentState,
  VisualRow,
  EditorMode,
  NormalizedRange,
} from 'cliedit';
```

## License

[MIT](LICENSE)