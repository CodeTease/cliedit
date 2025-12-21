// src/editor.io.ts

import { CliEditor } from './editor.js';
import { promises as fs } from 'fs';

/**
 * Methods related to File I/O and document state management (dirty flag).
 */

/**
 * Sets the document state to 'dirty' (unsaved changes).
 */
function setDirty(this: CliEditor): void { 
    this.isDirty = true; 
}

/**
 * Saves the current document content to the file path.
 */
async function saveFile(this: CliEditor): Promise<void> {
    const content = this.lines.join('\n');
    try {
        await fs.writeFile(this.filepath, content, 'utf-8');
        await this.swapManager.clear(); // Clear swap on successful save
        this.isDirty = false; // Reset dirty flag
        this.quitConfirm = false; // Reset quit confirmation
        this.setStatusMessage(`Saved: ${this.filepath}`, 2000);
    } catch (err: any) {
        this.setStatusMessage(`Save Error: ${err.message}`);
    }
}

export const ioMethods = {
    setDirty,
    saveFile,
};