# Getting Started

`cliedit` is a zero-dependency, embeddable TUI text editor for Node.js CLI applications. It is designed to be lightweight, fast, and easy to integrate into your existing tools.

## Installation

Install via npm:

```bash
npm install cliedit
```

## Hello World

Here is a minimal example of how to open the editor for a file.

1. Create a file named `hello.ts` (or `.js`):

```typescript
import { openEditor } from 'cliedit';

async function main() {
  console.log('Opening editor...');
  
  // Opens 'test.txt'. If it doesn't exist, it starts empty.
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

2. Run it (using `tsx` or `node`):

```bash
npx tsx hello.ts
```

The editor will take over the terminal. Press `Ctrl+S` to save and close, or `Ctrl+Q` to quit without saving.
