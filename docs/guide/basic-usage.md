# Basic Usage

The primary entry point for `cliedit` is the `openEditor` function.

## The `openEditor` Function

```typescript
import { openEditor } from 'cliedit';

const result = await openEditor(filepath, options);
```

### Parameters

- `filepath` (string): The path to the file you want to edit. If the file does not exist, it will be created upon saving.
- `options` (optional): Configuration object for the editor instance.

### Options (`EditorOptions`)

You can customize the editor behavior via the options object:

- **`tabSize`** (number, default: 4): The number of spaces a tab character represents.
- **`gutterWidth`** (number, default: 5): The initial width of the line number gutter. The editor automatically expands this if line numbers exceed the width.

Example:

```typescript
await openEditor('config.json', { 
    tabSize: 2,
    gutterWidth: 3 
});
```

## Handling the Result

The function returns a `Promise` that resolves to an object:

```typescript
{
    saved: boolean;   // true if the user saved (Ctrl+S), false if cancelled (Ctrl+Q)
    content: string;  // The final content of the editor buffer
}
```

This allows your application to decide what to do next. For example, a git commit tool might abort the commit if `saved` is false or `content` is empty.

## Crash Recovery

`cliedit` includes a robust crash recovery system managed by `SwapManager`.

- **Mechanism:** While editing, a hidden swap file (e.g., `.filename.swp`) is created in the same directory.
- **Auto-Save:** Changes are written to the swap file every 2 seconds if the content has changed.
- **Recovery:** If the editor crashes or is killed unexpectedly, the swap file remains. The next time you run `openEditor` on that file, it detects the swap file and automatically recovers the unsaved content, displaying a `RECOVERED FROM SWAP FILE` message.
- **Cleanup:** On a successful exit (Save or Quit), the swap file is automatically deleted.
