// src/editor.navigation.ts

import { CliEditor } from './editor.js';

/**
 * Methods related to cursor movement and viewport scrolling.
 */

/**
 * Finds the index of the visual row that currently contains the cursor.
 */
function findCurrentVisualRowIndex(this: CliEditor): number {
    const contentWidth = this.screenCols - this.gutterWidth;
    if (contentWidth <= 0) return 0;
    
    // Find the visual row index corresponding to the logical cursor position (cursorY, cursorX)
    for (let i = 0; i < this.visualRows.length; i++) {
      const row = this.visualRows[i];
      if (row.logicalY === this.cursorY) {
        // Check if cursorX falls within this visual row's content chunk
        if (this.cursorX >= row.logicalXStart && 
            this.cursorX <= row.logicalXStart + row.content.length) { 
          // Edge case: If cursorX is exactly at the start of a wrapped line (and not start of logical line), 
          // treat it as the end of the previous visual row for consistent movement.
          if (this.cursorX > 0 && this.cursorX === row.logicalXStart && i > 0) {
            return i - 1;
          }
          return i;
        }
      }
      // Optimization: if we've passed the cursor's logical line, the row must be the last one processed.
      if (row.logicalY > this.cursorY) {
        return i - 1;
      }
    }
    return Math.max(0, this.visualRows.length - 1); 
}

/**
 * Moves the cursor one position left or right (logically, wrapping lines).
 */
function moveCursorLogically(this: CliEditor, dx: number): void {
    if (dx === -1) {
      if (this.cursorX > 0) {
        this.cursorX--;
      } else if (this.cursorY > 0) {
        this.cursorY--;
        this.cursorX = this.lines[this.cursorY].length;
      }
    } else if (dx === 1) {
      const lineLength = this.lines[this.cursorY].length;
      if (this.cursorX < lineLength) {
        this.cursorX++;
      } else if (this.cursorY < this.lines.length - 1) {
        this.cursorY++;
        this.cursorX = 0;
      }
    }
}

/**
 * Moves the cursor up or down by visual rows (dy).
 */
function moveCursorVisually(this: CliEditor, dy: number): void {
    const currentVisualRow = this.findCurrentVisualRowIndex();
    const targetVisualRow = Math.max(0, Math.min(currentVisualRow + dy, this.visualRows.length - 1));

    if (currentVisualRow === targetVisualRow) return;

    const targetRow = this.visualRows[targetVisualRow];
    
    // Calculate the cursor's visual column position relative to its visual row start
    const currentVisualX = this.cursorX - (this.visualRows[currentVisualRow]?.logicalXStart || 0);
    
    this.cursorY = targetRow.logicalY;
    
    // Maintain the visual column position as closely as possible
    this.cursorX = Math.min(
      targetRow.logicalXStart + currentVisualX,
      this.lines[this.cursorY].length
    );
}

/**
 * Finds the start of the current visual line (Home key behavior).
 */
function findVisualRowStart(this: CliEditor): number {
    const visualRow = this.visualRows[this.findCurrentVisualRowIndex()];
    return visualRow.logicalXStart;
}

/**
 * Finds the end of the current visual line (End key behavior).
 */
function findVisualRowEnd(this: CliEditor): number {
    const visualRow = this.visualRows[this.findCurrentVisualRowIndex()];
    const lineLength = this.lines[visualRow.logicalY].length;
    const contentWidth = this.screenCols - this.gutterWidth;
    
    // The visual end is the start of the visual row + the maximum content width
    const visualEnd = visualRow.logicalXStart + contentWidth;

    // The actual logical X should be the minimum of the line's end and the visual end
    return Math.min(lineLength, visualEnd);
}

/**
 * Clamps the cursor position to valid coordinates and ensures it stays within line bounds.
 */
function adjustCursorPosition(this: CliEditor): void {
    // Clamp Y
    if (this.cursorY < 0) this.cursorY = 0;
    if (this.cursorY >= this.lines.length) {
      this.cursorY = Math.max(0, this.lines.length - 1);
    }
    // Clamp X
    const lineLength = this.lines[this.cursorY]?.length || 0;
    if (this.cursorX < 0) this.cursorX = 0;
    if (this.cursorX > lineLength) {
      this.cursorX = lineLength;
    }
}

/**
 * Scrolls the viewport to keep the cursor visible.
 */
function scroll(this: CliEditor): void {
    const currentVisualRow = this.findCurrentVisualRowIndex();
    
    // Scroll up
    if (currentVisualRow < this.rowOffset) {
      this.rowOffset = currentVisualRow;
    }
    // Scroll down
    if (currentVisualRow >= this.rowOffset + this.screenRows) {
      this.rowOffset = currentVisualRow - this.screenRows + 1;
    }
}

/**
 * Jumps the cursor to a specific line number (1-based).
 */
function jumpToLine(this: CliEditor, lineNumber: number): void {
    const targetY = lineNumber - 1; // Convert 1-based to 0-based index
    
    // Clamp targetY to valid range
    this.cursorY = Math.max(0, Math.min(targetY, this.lines.length - 1));
    this.cursorX = 0; // Move to start of line
    
    // Adjust scroll
    const visualRowIndex = this.findCurrentVisualRowIndex();
    this.rowOffset = Math.max(0, visualRowIndex - Math.floor(this.screenRows / 2));
    
    this.mode = 'edit';
    this.setStatusMessage(`Jumped to line ${lineNumber}`, 1000);
}

/**
 * Enters Go To Line mode.
 */
function enterGoToLineMode(this: CliEditor): void {
    this.mode = 'goto_line';
    this.goToLineQuery = '';
    this.setStatusMessage('Go to Line (ESC to cancel): ');
}

export const navigationMethods = {
    findCurrentVisualRowIndex,
    moveCursorLogically,
    moveCursorVisually,
    findVisualRowStart,
    findVisualRowEnd,
    adjustCursorPosition,
    scroll,
    jumpToLine,
    enterGoToLineMode,
    moveCursorByWord,
    matchBracket,
};

function moveCursorByWord(this: CliEditor, direction: 'left' | 'right'): void {
    const line = this.lines[this.cursorY];
    if (direction === 'left') {
        if (this.cursorX === 0) {
            if (this.cursorY > 0) {
                this.cursorY--;
                this.cursorX = this.lines[this.cursorY].length;
            }
        } else {
            // Move left until we hit a non-word char, then until we hit a word char
            // Simple logic: skip whitespace, then skip word chars
            let i = this.cursorX - 1;
            // 1. Skip spaces if we are currently on a space
            while (i > 0 && line[i] === ' ') i--;
            // 2. Skip non-spaces
            while (i > 0 && line[i - 1] !== ' ') i--;
            this.cursorX = i;
        }
    } else {
        if (this.cursorX >= line.length) {
            if (this.cursorY < this.lines.length - 1) {
                this.cursorY++;
                this.cursorX = 0;
            }
        } else {
            let i = this.cursorX;
            // 1. Skip current word chars
            while (i < line.length && line[i] !== ' ') i++;
            // 2. Skip spaces
            while (i < line.length && line[i] === ' ') i++;
            this.cursorX = i;
        }
    }
}

function matchBracket(this: CliEditor): void {
    const line = this.lines[this.cursorY];
    const char = line[this.cursorX];
    const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
    const revPairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
    
    if (pairs[char]) {
        // Find closing
        let depth = 1;
        // Search forward
        for (let y = this.cursorY; y < this.lines.length; y++) {
            const l = this.lines[y];
            const startX = (y === this.cursorY) ? this.cursorX + 1 : 0;
            for (let x = startX; x < l.length; x++) {
                if (l[x] === char) depth++;
                else if (l[x] === pairs[char]) depth--;
                
                if (depth === 0) {
                    this.cursorY = y;
                    this.cursorX = x;
                    this.scroll();
                    return;
                }
            }
        }
    } else if (revPairs[char]) {
        // Find opening
        let depth = 1;
        // Search backward
        for (let y = this.cursorY; y >= 0; y--) {
            const l = this.lines[y];
            const startX = (y === this.cursorY) ? this.cursorX - 1 : l.length - 1;
            for (let x = startX; x >= 0; x--) {
                if (l[x] === char) depth++;
                else if (l[x] === revPairs[char]) depth--;
                
                if (depth === 0) {
                    this.cursorY = y;
                    this.cursorX = x;
                    this.scroll();
                    return;
                }
            }
        }
    }
}