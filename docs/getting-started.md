# Getting Started

`cliedit` is a zero-runtime-dependency, embeddable TUI text editor for Node.js CLI
applications. It renders in the alternate screen, edits a buffer that wraps to the terminal
width, and resolves a promise when the user saves or quits.

## Requirements

- Node.js with TTY support. CI and the publish workflow use Node.js 22.
- A terminal that is the process's `stdout`; `openEditor()` rejects when it is not.

## Installation

```bash
npm install cliedit
```

The package is ESM only (`"type": "module"`) and ships `dist/` plus type declarations.

## Hello World

Create `hello.ts`:

```typescript
import { openEditor } from 'cliedit';

async function main() {
  console.log('Opening editor...');

  // Opens 'test.txt'. If it does not exist, the buffer starts empty
  // and Ctrl+S creates the file.
  const result = await openEditor('test.txt');

  if (result.saved) {
    console.log('File saved!');
    console.log('Content:', result.content);
  } else {
    console.log('Editor closed without saving.');
  }
}

main().catch(console.error);
```

Run it with `tsx` or `node` (Node 22 can run TypeScript directly with
`node --experimental-strip-types`):

```bash
npx tsx hello.ts
```

The editor takes over the terminal:

- `Ctrl+S` writes the buffer to `test.txt` and exits with `saved: true`.
- `Ctrl+Q` exits with `saved: false`; on a dirty buffer it needs a second `Ctrl+Q`
  (the prompt is not drawn, so it looks like the first one was ignored).
- `Ctrl+W` / `Ctrl+R` find and replace, `Ctrl+L` jumps to a line.
- The second status-bar row shows the available commands, or the active search/go-to-line
  prompt while one of those modes is open.

Leaving a session without saving leaves a `.test.txt.swp` next to the file; the next
`openEditor('test.txt')` recovers it. See [Crash Recovery](./guide/basic-usage.md#crash-recovery).

## Next Steps

- [Basic Usage](./guide/basic-usage.md) — options, return value, swap files.
- [Piping & Stdin](./guide/piping.md) — pre-fill the buffer from a pipe.
- [Keyboard Shortcuts](./guide/shortcuts.md) — the full key map.
