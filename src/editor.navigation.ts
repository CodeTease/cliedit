// src/editor.navigation.ts

import { CliEditor } from './editor.js';

/**
 * Methods related to cursor movement and viewport scrolling.
 */

/**
 * Finds the index of the visual row that currently contains the cursor.
 * Uses math to calculate position based on line lengths and screen width.
 */
function findCurrentVisualRowIndex(this: CliEditor): number {
    const contentWidth = Math.max(1, this.screenCols - this.gutterWidth);
    
    let visualRowIndex = 0;
    
    // Sum visual height of all lines before current cursorY
    for (let i = 0; i < this.cursorY; i++) {
        visualRowIndex += this.getLineVisualHeight(i);
    }
    
    // Add visual offset within current line
    // e.g. if cursorX is 250 and width is 100, we are on the 3rd row (index 2) of this line.
    visualRowIndex += Math.floor(this.cursorX / contentWidth);
    
    return visualRowIndex;
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
    
    // Prevent moving out of bounds (top)
    if (dy < 0 && currentVisualRow === 0) return;
    
    // Calculate total visual rows (O(N) - expensive but necessary for bounds check at bottom)
    // Optimization: If dy > 0, we can check as we go. But for now, let's keep it safe.
    // Or just let getLogicalFromVisual handle out of bounds.
    
    const targetVisualRow = Math.max(0, currentVisualRow + dy);
    
    // Determine logical position of target visual row
    const targetPos = this.getLogicalFromVisual(targetVisualRow);
    
    // If we went past the end, clamp to end
    if (targetPos.logicalY > this.lines.length - 1) {
        this.cursorY = this.lines.length - 1;
        this.cursorX = this.lines[this.cursorY].length;
        return;
    }

    this.cursorY = targetPos.logicalY;
    
    const contentWidth = Math.max(1, this.screenCols - this.gutterWidth);
    
    // We want to maintain visual X (column on screen)
    // Current visual X offset in the row
    const currentVisualXOffset = this.cursorX % contentWidth;
    
    // Target logical X start for that visual row chunk
    const targetChunkStart = targetPos.visualYOffset * contentWidth;
    
    // New cursor X
    this.cursorX = targetChunkStart + currentVisualXOffset;
    
    // Clamp to line length
    const lineLength = this.lines[this.cursorY].length;
    if (this.cursorX > lineLength) {
        this.cursorX = lineLength;
    }
}

/**
 * Finds the start of the current visual line (Home key behavior).
 */
function findVisualRowStart(this: CliEditor): number {
    const contentWidth = Math.max(1, this.screenCols - this.gutterWidth);
    const chunkIndex = Math.floor(this.cursorX / contentWidth);
    return chunkIndex * contentWidth;
}

/**
 * Finds the end of the current visual line (End key behavior).
 */
function findVisualRowEnd(this: CliEditor): number {
    const contentWidth = Math.max(1, this.screenCols - this.gutterWidth);
    const chunkIndex = Math.floor(this.cursorX / contentWidth);
    const lineLength = this.lines[this.cursorY].length;
    
    const chunkStart = chunkIndex * contentWidth;
    const chunkEnd = chunkStart + contentWidth;
    
    return Math.min(lineLength, chunkEnd);
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

function moveCursorByWord(this: CliEditor, direction: 'left' | 'right'): void {
    const line = this.lines[this.cursorY];
    if (direction === 'left') {
        if (this.cursorX === 0) {
            if (this.cursorY > 0) {
                this.cursorY--;
                this.cursorX = this.lines[this.cursorY].length;
            }
        } else {
            let i = this.cursorX - 1;
            while (i > 0 && line[i] === ' ') i--;
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
            while (i < line.length && line[i] !== ' ') i++;
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
        let depth = 1;
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
        let depth = 1;
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