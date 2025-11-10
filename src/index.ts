// src/index.ts
import { promises as fs } from 'fs';
import { CliEditor } from './editor.js';
import path from 'path'; 

/**
 * Public API function: Opens the editor.
 * Reads the file and initializes CliEditor.
 */
export async function openEditor(filepath: string): Promise<{ saved: boolean; content: string }> {
  let initialContent = '';
  try {
    // 1. Read file
    initialContent = await fs.readFile(filepath, 'utf-8');
  } catch (err: any) {
    // 2. If file does not exist (ENOENT), treat it as a new file
    if (err.code !== 'ENOENT') {
      throw err; // Throw error if not 'File not found'
    }
  }

  // 3. Initialize and run editor
  const editor = new CliEditor(initialContent, filepath);
  return editor.run();
}


// --- DEMO RUNNER ---
// This code runs when using `npm run start:demo`

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

if (process.env.NODE_ENV === 'development') {
  runDemo();
}