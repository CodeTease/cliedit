// src/index.ts
import { promises as fs } from 'fs';
import { CliEditor } from './editor.js';

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

// --- Public Exports ---
// Export the main class for advanced users
export { CliEditor } from './editor.js';

// Export key types for TypeScript users
export type { DocumentState, VisualRow, EditorMode } from './types.js';
export type { NormalizedRange } from './editor.selection.js';