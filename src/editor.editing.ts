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
    this.invalidateSyntaxCache();
    this.recalculateVisualRows();
}

/**
 * Inserts a single character at the cursor position.
 */
function insertCharacter(this: CliEditor, char: string): void {
    const line = this.lines[this.cursorY] || '';
    this.lines[this.cursorY] = line.slice(0, this.cursorX) + char + line.slice(this.cursorX);
    this.cursorX += char.length;
    this.invalidateSyntaxCache();
}

/**
 * Inserts a soft tab (using configured tabSize).
 */
function insertSoftTab(this: CliEditor): void { 
    const spaces = ' '.repeat(this.tabSize || 4);
    this.insertCharacter(spaces); 
    // invalidation handled in insertCharacter
}

/**
 * Inserts a new line, splitting the current line at the cursor position.
 * Implements auto-indent.
 */
function insertNewLine(this: CliEditor): void {
    const line = this.lines[this.cursorY] || '';
    
    // Find indentation of the current line
    const match = line.match(/^(\s*)/);
    const indent = match ? match[1] : '';
    
    const remainder = line.slice(this.cursorX);
    this.lines[this.cursorY] = line.slice(0, this.cursorX);
    
    // Add new line with the same indentation + remainder
    this.lines.splice(this.cursorY + 1, 0, indent + remainder);
    
    this.cursorY++;
    this.cursorX = indent.length; // Move cursor to end of indent
    this.setDirty();
    this.invalidateSyntaxCache();
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
    this.invalidateSyntaxCache();
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
    this.invalidateSyntaxCache();
}

/**
 * Handles auto-pairing of brackets and quotes.
 * If text is selected, it wraps the selection.
 * Otherwise, it inserts the pair and places the cursor in the middle.
 * @param openChar The opening character that was typed (e.g., '(', '[', '{').
 * @param closeChar The corresponding closing character (e.g., ')', ']', '}').
 */
function handleAutoPair(this: CliEditor, openChar: string, closeChar: string): void {
    if (this.selectionAnchor) {
        // There is a selection, so we need to wrap it.
        const selection = this.getNormalizedSelection();
        if (!selection) return; // Should not happen if anchor exists, but good practice

        const selectedText = this.getSelectedText();
        
        // The deleteSelectedText() function automatically moves the cursor to the start
        // of the selection, so we don't need to set it manually.
        this.deleteSelectedText();
        
        // Wrap the original selected text
        const wrappedText = openChar + selectedText + closeChar;
        this.insertContentAtCursor(wrappedText.split('\n'));
        // The selection is already cancelled by deleteSelectedText().
        
    } else {
        // No selection, just insert the opening and closing characters
        this.insertCharacter(openChar + closeChar);
        // Move cursor back one position to be in between the pair
        this.cursorX--;
    }
    this.setDirty();
}

/**
 * Indents the selected lines (Block Indentation).
 */
function indentSelection(this: CliEditor): void {
    this.saveState(); // Save state before modification for Undo
    const selection = this.getNormalizedSelection();
    if (!selection) return;

    for (let i = selection.start.y; i <= selection.end.y; i++) {
        const line = this.lines[i];
        this.lines[i] = ' '.repeat(this.tabSize) + line;
    }
    
    // Adjust selection anchors
    if (this.selectionAnchor) {
        this.selectionAnchor.x += this.tabSize;
        this.cursorX += this.tabSize;
    }
    
    this.setDirty();
    this.invalidateSyntaxCache();
    this.recalculateVisualRows();
}

/**
 * Outdents the selected lines (Block Outdent).
 */
function outdentSelection(this: CliEditor): void {
    this.saveState(); // Save state before modification for Undo
    // If no selection, try to outdent current line
    let startY = this.cursorY;
    let endY = this.cursorY;
    
    if (this.selectionAnchor) {
        const selection = this.getNormalizedSelection();
        if (selection) {
            startY = selection.start.y;
            endY = selection.end.y;
        }
    }
    
    let changed = false;
    for (let i = startY; i <= endY; i++) {
        const line = this.lines[i];
        // Remove up to tabSize spaces
        const match = line.match(/^(\s+)/);
        if (match) {
             const spaces = match[1].length;
             const toRemove = Math.min(spaces, this.tabSize);
             this.lines[i] = line.slice(toRemove);
             changed = true;
        }
    }
    
    if (changed) {
         if (this.selectionAnchor) {
             // Approximation: shift anchor and cursor left
             this.selectionAnchor.x = Math.max(0, this.selectionAnchor.x - this.tabSize);
             this.cursorX = Math.max(0, this.cursorX - this.tabSize);
         } else {
             this.cursorX = Math.max(0, this.cursorX - this.tabSize);
         }
         this.setDirty();
         this.invalidateSyntaxCache();
         this.recalculateVisualRows();
    }
}

/**
 * Moves the current line or selection up or down.
 * @param direction -1 for Up, 1 for Down
 */
function moveLines(this: CliEditor, direction: -1 | 1): void {
    this.saveState(); // Save state before modification for Undo
    let startY = this.cursorY;
    let endY = this.cursorY;
    
    if (this.selectionAnchor) {
        const selection = this.getNormalizedSelection();
        if (selection) {
            startY = selection.start.y;
            endY = selection.end.y;
        }
    }
    
    // Boundary checks
    if (direction === -1 && startY === 0) return; // Top
    if (direction === 1 && endY >= this.lines.length - 1) return; // Bottom
    
    // Extract lines to move
    const count = endY - startY + 1;
    const linesToMove = this.lines.splice(startY, count);
    
    // Insert at new position
    const newStart = startY + direction;
    this.lines.splice(newStart, 0, ...linesToMove);
    
    // Update selection/cursor
    this.cursorY += direction;
    if (this.selectionAnchor) {
        this.selectionAnchor.y += direction;
    }
    
    this.setDirty();
    this.recalculateVisualRows();
}

/**
 * Duplicates the current line or selection.
 */
function duplicateLineOrSelection(this: CliEditor): void {
    this.saveState(); // Save state before modification for Undo
    if (this.selectionAnchor) {
        const selection = this.getNormalizedSelection();
        if (!selection) return;
        
        const text = this.getSelectedText();
        
        // We need to move cursor to end of selection.
        // Normalized selection end:
        this.cursorX = selection.end.x;
        this.cursorY = selection.end.y;
        
        const contentLines = text.split('\n');
        this.insertContentAtCursor(contentLines);
        
    } else {
        // Single line duplication
        const line = this.lines[this.cursorY];
        this.lines.splice(this.cursorY + 1, 0, line);
        this.cursorY++; // Move down to the new line
        // CursorX stays same? Usually yes.
    }
    
    this.setDirty();
    this.recalculateVisualRows();
}


export const editingMethods = {
    insertContentAtCursor,
    insertCharacter,
    insertSoftTab,
    insertNewLine,
    deleteBackward,
    deleteForward,
    handleAutoPair,
    indentSelection,
    outdentSelection,
    moveLines,
    duplicateLineOrSelection,
};