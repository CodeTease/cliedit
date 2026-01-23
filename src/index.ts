// src/index.ts
import { promises as fs } from 'fs';
import { CliEditor } from './editor.js';
import { EditorOptions } from './types.js';
import { SwapManager } from './editor.swap.js';

/**
 * Public API function: Opens the editor.
 * Reads the file and initializes CliEditor.
 */
export async function openEditor(filepath: string, options?: EditorOptions): Promise<{ saved: boolean; content: string }> {
  // 0. Handle Piping (Stdin)
  let pipedContent = '';
  if (!process.stdin.isTTY) {
      try {
          const chunks = [];
          for await (const chunk of process.stdin) {
              chunks.push(chunk);
          }
          pipedContent = Buffer.concat(chunks).toString('utf-8');
          
          // CRITICAL: Re-open TTY for user input!
          // We need to bypass the consumed stdin and open the actual terminal device.
          const ttyPath = process.platform === 'win32' ? 'CONIN$' : '/dev/tty';
          const ttyFd = await fs.open(ttyPath, 'r');
          
          // Let's rely on the fact that we can construct a new ReadStream.
          const { ReadStream } = await import('tty');
          const ttyReadStream = new ReadStream(ttyFd.fd);
          
          
          if (options) {
             (options as any).inputStream = ttyReadStream;
          } else {
             options = { inputStream: ttyReadStream } as any;
          }
      } catch (e) {
          console.error('Failed to read from stdin or open TTY:', e);
      }
  }

  // Check for swap file (only if filepath provided)
  if (filepath && await SwapManager.check(filepath)) {
      console.log(`\x1b[33mWarning: Swap file detected for ${filepath}. Recovering content...\x1b[0m`);
      await new Promise(r => setTimeout(r, 1500));
      
      const swapContent = await SwapManager.read(filepath);
      const editor = new CliEditor(swapContent, filepath, options);
      editor.isDirty = true; // Mark as dirty manually to avoid potential mixin issues
      editor.statusMessage = 'RECOVERED FROM SWAP FILE';
      return editor.run();
  }

  let initialContent = pipedContent; // Default to piped content
  
  if (filepath && !initialContent) {
      try {
        initialContent = await fs.readFile(filepath, 'utf-8');
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          throw err;
        }
      }
  }

  // 3. Initialize and run editor
  const editor = new CliEditor(initialContent, filepath, options);
  return editor.run();
}

// --- Public Exports ---
// Export the main class for advanced users
export { CliEditor } from './editor.js';

// Export key types for TypeScript users
export type { DocumentState, EditorMode } from './types.js';
export type { NormalizedRange } from './editor.selection.js';