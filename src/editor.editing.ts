// src/editor.editing.ts

import { CliEditor } from './editor.js';

/**
 * Core methods for editing the document content (insert, delete, split/join lines).
 */

/**
 * Inserts content (potentially multi-line) at the current cursor position.
 * Note: This function ASSUMES the selection has already been deleted.
 * @param contentLines An array of strings to insert.
 */
function insertContentAtCursor(this: CliEditor, contentLines: string[]): void {
    const pasteLength = contentLines.length;

    if (pasteLength === 1) {
        const line = this.lines[this.cursorY] || '';
        this.lines[this.cursorY] = line.slice(0, this.cursorX) + contentLines[0] + line.slice(this.cursorX);
        this.cursorX += contentLines[0].length;
    } else {
        // Multi-line paste logic
        const line = this.lines[this.cursorY] || '';
        const remainder = line.slice(this.cursorX);
        
        // 1. Update current line with the first part of the paste
        this.lines[this.cursorY] = line.slice(0, this.cursorX) + contentLines[0];
        
        const linesToInsert = contentLines.slice(1, -1);
        const lastPasteLine = contentLines[contentLines.length - 1];
        
        // 2. Insert middle lines
        if (linesToInsert.length > 0) {
          this.lines.splice(this.cursorY + 1, 0, ...linesToInsert);
        }

        // 3. Insert last line and append remainder
        this.lines.splice(this.cursorY + 1 + linesToInsert.length, 0, lastPasteLine + remainder);
        
        // 4. Update cursor position
        this.cursorY += pasteLength - 1;
        this.cursorX = lastPasteLine.length;
    }
    this.setDirty();
    this.recalculateVisualRows();
}

/**
 * Inserts a single character at the cursor position.
 */
function insertCharacter(this: CliEditor, char: string): void {
    const line = this.lines[this.cursorY] || '';
    this.lines[this.cursorY] = line.slice(0, this.cursorX) + char + line.slice(this.cursorX);
    this.cursorX += char.length;
}

/**
 * Inserts a soft tab (4 spaces).
 */
function insertSoftTab(this: CliEditor): void { 
    this.insertCharacter('    '); 
}

/**
 * Inserts a new line, splitting the current line at the cursor position.
 */
function insertNewLine(this: CliEditor): void {
    const line = this.lines[this.cursorY] || '';
    const remainder = line.slice(this.cursorX);
    this.lines[this.cursorY] = line.slice(0, this.cursorX);
    this.lines.splice(this.cursorY + 1, 0, remainder);
    this.cursorY++;
    this.cursorX = 0;
    this.setDirty();
}

/**
 * Deletes the character before the cursor, or joins the current line with the previous one.
 */
function deleteBackward(this: CliEditor): void {
    if (this.cursorX > 0) {
      const line = this.lines[this.cursorY] || '';
      this.lines[this.cursorY] = line.slice(0, this.cursorX - 1) + line.slice(this.cursorX);
      this.cursorX--;
    } else if (this.cursorY > 0) {
      const currentLine = this.lines[this.cursorY];
      const previousLine = this.lines[this.cursorY - 1];
      this.cursorX = previousLine.length;
      this.lines[this.cursorY - 1] = previousLine + currentLine;
      this.lines.splice(this.cursorY, 1);
      this.cursorY--;
    }
    if (this.lines.length === 0) {
        this.lines = ['']; this.cursorY = 0; this.cursorX = 0;
    }
    this.setDirty();
}

/**
 * Deletes the character after the cursor, or joins the current line with the next one.
 */
function deleteForward(this: CliEditor): void {
    const line = this.lines[this.cursorY] || '';
    if (this.cursorX < line.length) {
      this.lines[this.cursorY] = line.slice(0, this.cursorX) + line.slice(this.cursorX + 1);
    } else if (this.cursorY < this.lines.length - 1) {
      const nextLine = this.lines[this.cursorY + 1];
      this.lines[this.cursorY] = line + nextLine;
      this.lines.splice(this.cursorY + 1, 1);
    }
    if (this.lines.length === 0) {
        this.lines = ['']; this.cursorY = 0; this.cursorX = 0;
    }
    this.setDirty();
}

export const editingMethods = {
    insertContentAtCursor,
    insertCharacter,
    insertSoftTab,
    insertNewLine,
    deleteBackward,
    deleteForward,
};