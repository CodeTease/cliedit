// src/demo.ts
// This file is for development/demo purposes only.
// It is run via `npm run demo` and is NOT part of the main library bundle.

import { promises as fs } from 'fs';
import path from 'path';
import { openEditor } from '../dist/index.js'; // Import the public API

/**
 * Demo runner function.
 */
async function runDemo() {
  const demoFile = path.resolve(process.cwd(), 'cliedit-demo.txt');

  const demoContent = [
    '// Welcome to cliedit (Stable Build)!',
    '// All critical TS and TTY bugs are now FIXED.',
    '',
    '// FEATURES:',
    '// 1. Line Wrapping & Visual Navigation (Up/Down moves visually).',
    '// 2. Persistent History (Undo/Redo: Ctrl+Z/Y).',
    '// 3. File I/O & Dirty flag (*).',
    '// 4. Text Selection (Use Ctrl+Arrow).',
    '',
    '// COMMANDS:',
    '// - Ctrl+Arrow: Select Text',
    '// - Ctrl+C: Copy (Selection or All)',
    '// - Ctrl+X: Cut Selection (or Cut Line if no selection)',
    '// - Ctrl+Q: Quit (with safety check)',
    '// - Ctrl+S: Save and Quit',
    '',
    'This is a very long line designed to test line wrapping. If you use Ctrl+Arrow keys, you should see the selection highlight correctly even across wrapped lines. This functionality is now stable.',
    'Final line for testing purposes.',
  ].join('\n');

  try {
    // Create demo file
    await fs.writeFile(demoFile, demoContent, 'utf-8');
    console.log(`Demo file created: ${demoFile}`);
    console.log('--- Opening editor... ---');

    // Run editor
    const result = await openEditor(demoFile);

    // (FIX GHOST TUI) Add a buffer after the editor resolves
    // to give the terminal time to transition screens.
    await new Promise(res => setTimeout(res, 50));

    // Output result
    console.log('\n--- Editor Closed ---');
    if (result.saved) {
      console.log('Saved! New content:');
      console.log('---------------------');
      console.log(result.content);
      console.log('---------------------');
    } else {
      console.log('Quit without saving.');
    }
  } catch (error) {
    // Clean up TTY output if a critical error occurred
    await new Promise(res => setTimeout(res, 50));
    console.error('\n--- A critical error occurred ---');
    console.error(error);
  }
}

// This code runs when using `npm run demo`
if (process.env.NODE_ENV === 'development') {
  runDemo();
}