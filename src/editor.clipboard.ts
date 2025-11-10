// src/editor.clipboard.ts

import { platform } from 'os';
import { exec } from 'child_process';
import { CliEditor } from './editor.js';

/**
 * Methods related to system clipboard interaction (Copy/Paste/Cut).
 */

// --- Helper Functions (Clipboard Access) ---

function setClipboard(this: CliEditor, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let command: string;
      switch (platform()) {
        case 'darwin': command = 'pbcopy'; break;
        case 'win32': command = 'clip'; break;
        default:
          this.setStatusMessage('Clipboard only supported on macOS/Windows for now');
          return resolve();
      }
      const process = exec(command, (error) => {
        if (error) {
          this.setStatusMessage(`Clipboard error: ${error.message}`);
          return reject(error);
        }
        this.setStatusMessage('Text copied to clipboard', 1000);
        resolve();
      });
      if (process.stdin) {
        process.stdin.write(text);
        process.stdin.end();
      }
    });
}

function getClipboard(this: CliEditor): Promise<string> {
    return new Promise((resolve, reject) => {
      let command: string;
      switch (platform()) {
        case 'darwin': command = 'pbpaste'; break;
        case 'win32': command = 'powershell -command "Get-Clipboard"'; break;
        default:
          this.setStatusMessage('Clipboard only supported on macOS/Windows for now');
          return resolve('');
      }
      exec(command, (error, stdout) => {
        if (error) {
          this.setStatusMessage(`Paste error: ${error.message}`);
          return reject(error);
        }
        resolve(stdout); 
      });
    });
}

// --- Clipboard Actions ---

/**
 * Cuts the current line and copies it to the clipboard.
 * Falls back to line-based behavior if no selection.
 */
async function cutLine(this: CliEditor): Promise<void> {
    if (this.lines.length > 1 || (this.lines.length === 1 && this.lines[0] !== '')) {
      const lineToCut = this.lines[this.cursorY];
      await this.setClipboard(lineToCut);
      
      this.lines.splice(this.cursorY, 1);
      
      if (this.cursorY >= this.lines.length) {
        this.cursorY = Math.max(0, this.lines.length - 1);
      }
      if (this.lines.length === 0) {
        this.lines = [''];
      }
      this.cursorX = 0;
      this.setDirty();
      this.setStatusMessage('Line cut to clipboard', 1000);
    }
}

/**
 * Pastes the clipboard content at the cursor position.
 * Handles single-line and multi-line pastes.
 */
async function pasteLine(this: CliEditor): Promise<void> {
    try {
      const textToPaste = await this.getClipboard();
      if (!textToPaste) return;
      
      const pasteLines = textToPaste.split(/\r?\n/);
      
      if (this.selectionAnchor) {
        this.deleteSelectedText(); 
      }
      
      this.insertContentAtCursor(pasteLines);

    } catch (error: any) {
      this.setStatusMessage(`Paste failed: ${error.message}`);
    }
}

/**
 * Cuts the current selection to the clipboard. Returns a promise.
 * Renamed to avoid collision with command handler in editor.keys.ts
 */
async function cutSelectionAsync(this: CliEditor): Promise<void> {
    if (!this.selectionAnchor) {
        await this.cutLine(); 
    } else {
        const textToCut = this.getSelectedText();
        await this.setClipboard(textToCut);
        this.deleteSelectedText();
        this.setDirty();
        this.setStatusMessage('Selection cut!', 1000);
    }
}

/**
 * Pastes clipboard content at the cursor position.
 * Always deletes selection if one exists.
 */
async function pasteSelection(this: CliEditor): Promise<void> {
    await this.pasteLine();
}


export const clipboardMethods = {
    setClipboard,
    getClipboard,
    cutLine,
    pasteLine,
    cutSelectionAsync, // Renamed
    pasteSelection,
};