// src/editor.rendering.ts

import { CliEditor } from './editor.js';
import { ANSI } from './constants.js';

/**
 * Core methods for rendering the document content, status bar, and cursor.
 */

/**
 * Updates the gutter width dynamically based on the total number of lines.
 * Ensures that line numbers (e.g., "10000") don't overflow into the content.
 */
function updateGutterWidth(this: CliEditor): void {
    const lineCount = this.lines.length;
    // Calculate required width: Number of digits + 3 characters for padding/separator (" | ")
    // Example: 10000 lines -> 5 digits + 3 = width 8.
    // Minimum width is kept at 5 (default).
    const requiredWidth = lineCount.toString().length + 3;
    
    // Update the editor's gutter width state
    this.gutterWidth = Math.max(5, requiredWidth);
}

/**
 * Calculates how many visual rows a logical line occupies.
 * @param lineIndex The index of the logical line.
 */
function getLineVisualHeight(this: CliEditor, lineIndex: number): number {
    const line = this.lines[lineIndex];
    if (line === undefined) return 1;
    // Empty line takes 1 row
    if (line.length === 0) return 1;
    
    const contentWidth = Math.max(1, this.screenCols - this.gutterWidth);
    return Math.ceil(line.length / contentWidth);
}

/**
 * Maps a global visual row index to its corresponding logical line and offset.
 * Note: This is O(N) where N is the number of logical lines.
 * Optimization: For very large files, this would need a tree structure.
 * * @param visualY The global visual row index (0-based).
 * @returns Object containing logicalY and the visual offset within that line.
 */
function getLogicalFromVisual(this: CliEditor, visualY: number): { logicalY: number; visualYOffset: number } {
    let currentVisualY = 0;
    
    for (let i = 0; i < this.lines.length; i++) {
        const height = this.getLineVisualHeight(i);
        if (currentVisualY + height > visualY) {
            return {
                logicalY: i,
                visualYOffset: visualY - currentVisualY
            };
        }
        currentVisualY += height;
    }
    
    // If out of bounds, return the last line's end
    return { 
        logicalY: this.lines.length - 1, 
        visualYOffset: Math.max(0, this.getLineVisualHeight(this.lines.length - 1) - 1)
    };
}

/**
 * The main rendering loop.
 */
function render(this: CliEditor): void {
    // 1. Dynamic Gutter Update
    // We update this every frame to handle cases where lines are added/removed.
    // This fixes the "Gutter Overflow" issue on large files.
    this.updateGutterWidth();

    this.adjustCursorPosition();
    this.scroll();

    // Clear buffer for next frame logic (conceptually)
    // Actually ScreenBuffer.clear() fills with spaces, which is what we want for empty areas.
    this.screenBuffer.clear();
    
    // Recalculate content width with the NEW gutter width
    const contentWidth = Math.max(1, this.screenCols - this.gutterWidth);
    
    // Find the starting logical line and offset based on rowOffset (which is visual)
    const startPos = this.getLogicalFromVisual(this.rowOffset);
    let logicalY = startPos.logicalY;
    let visualOffsetInLine = startPos.visualYOffset;

    let visualRowsRendered = 0;
    
    const selectionRange = this.getNormalizedSelection();

    // Scrollbar calculations
    const totalLines = this.lines.length;
    // const startLogicalY = startPos.logicalY; // Unused variable
    const showScrollbar = totalLines > this.screenRows; 
    const thumbHeight = showScrollbar ? Math.max(1, Math.floor((this.screenRows / totalLines) * this.screenRows)) : 0;
    const thumbStart = showScrollbar ? Math.floor((startPos.logicalY / totalLines) * this.screenRows) : 0;

    // Render Loop
    while (visualRowsRendered < this.screenRows) {
        const screenY = this.screenStartRow + visualRowsRendered - 1; // 0-based Y for ScreenBuffer

        // Stop if we run out of content
        if (logicalY >= this.lines.length) {
            this.screenBuffer.put(0, screenY, '~', ANSI.CYAN); 
            visualRowsRendered++;
            continue;
        }

        const line = this.lines[logicalY];
        const lineVisualHeight = this.getLineVisualHeight(logicalY);

        // Render chunks for this logical line starting from visualOffsetInLine
        for (let v = visualOffsetInLine; v < lineVisualHeight && visualRowsRendered < this.screenRows; v++) {
            const currentScreenY = this.screenStartRow + visualRowsRendered - 1; // 0-based index for buffer

            // Calculate slice of string
            const chunkStart = v * contentWidth;
            const chunkEnd = Math.min(chunkStart + contentWidth, line.length);
            // Handle empty line case
            const chunk = (line.length === 0 && v === 0) ? '' : line.substring(chunkStart, chunkEnd);
            
            // 1. Draw Gutter
            // Ensure padding logic uses the current gutterWidth
            const gutterStr = (v === 0) 
              ? `${logicalY + 1}`.padStart(this.gutterWidth - 2, ' ') + ' | '
              : ' '.padStart(this.gutterWidth - 2, ' ') + ' | ';
            
            this.screenBuffer.putString(0, currentScreenY, gutterStr, ANSI.DIM); 

            // 2. Syntax Highlighting & Char Rendering
            const syntaxColorMap = this.getLineSyntaxColor(logicalY, line);
            
            for (let i = 0; i < chunk.length; i++) {
                const char = chunk[i];
                const logicalX = chunkStart + i;
                const bufferX = this.gutterWidth + i;
                
                const isCursorPosition = (logicalY === this.cursorY) && (logicalX === this.cursorX);
                const isSelected = selectionRange && this.isPositionInSelection(logicalY, logicalX, selectionRange);
                
                // Search Highlight Logic
                let isGlobalSearchResult = false;
                if (this.searchResultMap.has(logicalY)) {
                    const matches = this.searchResultMap.get(logicalY)!;
                    for (const match of matches) {
                        if (logicalX >= match.start && logicalX < match.end) {
                            isGlobalSearchResult = true;
                            break;
                        }
                    }
                }

                const isCurrentSearchResult = (
                    this.searchResultIndex !== -1 &&
                    this.searchResults[this.searchResultIndex]?.y === logicalY &&
                    logicalX >= this.searchResults[this.searchResultIndex]?.x &&
                    logicalX < (this.searchResults[this.searchResultIndex]?.x + this.searchQuery.length)
                );

                const syntaxColor = syntaxColorMap.get(logicalX) || '';

                // Determine Style
                let style = '';
                if (isSelected) {
                    style = ANSI.INVERT_COLORS;
                } else if (isCursorPosition) {
                    style = ANSI.INVERT_COLORS;
                } else if (isCurrentSearchResult) {
                    style = ANSI.INVERT_COLORS + '\x1b[4m'; // Invert + Underline
                } else if (isGlobalSearchResult) {
                    style = ANSI.INVERT_COLORS;
                } else if (syntaxColor) {
                    style = syntaxColor;
                }
                
                this.screenBuffer.put(bufferX, currentScreenY, char, style);
            }

            // Handle Cursor at End of Line
            if (logicalY === this.cursorY && this.cursorX === line.length && chunkEnd === line.length) {
                // Determine X position for the space
                const spaceX = this.gutterWidth + (line.length - chunkStart);
                this.screenBuffer.put(spaceX, currentScreenY, ' ', ANSI.INVERT_COLORS);
            }
            
            // Draw Scrollbar
            if (showScrollbar) {
                const isThumb = visualRowsRendered >= thumbStart && visualRowsRendered < thumbStart + thumbHeight;
                const scrollChar = isThumb ? '┃' : '│'; 
                // Rightmost column: this.screenCols - 1 (0-based)
                this.screenBuffer.put(this.screenCols - 1, currentScreenY, scrollChar, ANSI.RESET_COLORS);
            }

            visualRowsRendered++;
        }

        // Move to next logical line
        logicalY++;
        visualOffsetInLine = 0; 
    }

    // Draw Status Bar
    this.renderStatusBarToBuffer();
    
    // Flush Screen Buffer
    this.screenBuffer.flush();
    
    // Set physical cursor position (ensure cursor is visible on screen)
    
    const cursorGlobalVisualRow = this.findCurrentVisualRowIndex(); 
    const relativeVisualRow = cursorGlobalVisualRow - this.rowOffset;
    
    if (relativeVisualRow >= 0 && relativeVisualRow < this.screenRows) {
        const cx = this.cursorX;
        const visualXInChunk = cx % contentWidth;
        
        const displayY = this.screenStartRow + relativeVisualRow;
        const displayX = visualXInChunk + this.gutterWidth + 1;
        process.stdout.write(`\x1b[${displayY};${displayX}H`);
    }
}

/**
 * Sets the status message and handles the timeout for custom messages.
 */
function setStatusMessage(this: CliEditor, message: string, timeoutMs: number = 3000): void {
    this.statusMessage = message;
    this.isMessageCustom = message !== this.DEFAULT_STATUS;
    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
      this.statusTimeout = null;
    }
    if (message !== this.DEFAULT_STATUS && timeoutMs > 0) {
      this.statusTimeout = setTimeout(() => {
        this.statusMessage = this.DEFAULT_STATUS;
        this.isMessageCustom = false;
        this.statusTimeout = null;
        if (!this.isCleanedUp) {
            this.renderStatusBarToBuffer();
            this.screenBuffer.flush();
        }
      }, timeoutMs);
    }
    if (!this.isCleanedUp) {
        this.renderStatusBarToBuffer(); // Just update buffer
        this.screenBuffer.flush(); // And flush? Yes, immediate update.
    }
}

/**
 * Renders the status bar content directly to the ScreenBuffer.
 */
function renderStatusBarToBuffer(this: CliEditor): void {
    const contentWidth = this.screenCols;
    const startY = this.screenRows + this.screenStartRow - 1; // 0-based Y
    
    let status = '';
    // --- Line 1 ---
    switch (this.mode) {
        case 'search_find':
            status = (this.replaceQuery === null ? 'Find: ' : 'Find: ') + this.searchQuery;
            break;
        case 'search_replace':
            status = 'Replace with: ' + this.replaceQuery;
            break;
        case 'goto_line':
            status = 'Go to Line: ' + this.goToLineQuery;
            break;
        case 'search_confirm':
            status = this.statusMessage; 
            break;
        case 'edit':
        default: {
            const visualRowIndex = this.findCurrentVisualRowIndex();
            const contentWidthVal = Math.max(1, this.screenCols - this.gutterWidth);
            const visualX = this.cursorX % contentWidthVal;
            const fileStatus = this.isDirty ? `* ${this.filepath}` : this.filepath;
            const pos = `Ln ${this.cursorY + 1}, Col ${this.cursorX + 1} (View: ${visualRowIndex + 1},${visualX + 1})`;
            const statusLeft = `[${fileStatus}]`.padEnd(Math.floor(contentWidth * 0.5));
            const statusRight = pos.padStart(Math.floor(contentWidth * 0.5));
            status = statusLeft + statusRight;
            break;
        }
    }
    
    // Pad and put line 1
    status = status.padEnd(contentWidth);
    this.screenBuffer.putString(0, startY, status, ANSI.INVERT_COLORS);

    // --- Line 2 ---
    const message = (this.mode === 'edit' ? this.DEFAULT_STATUS : this.statusMessage).padEnd(contentWidth);
    this.screenBuffer.putString(0, startY + 1, message, '');
}


/**
 * Deprecated string-based status bar render, kept for interface compatibility if needed, 
 * but logic is now in renderStatusBarToBuffer. 
 * We can stub it or redirect it.
 */
function renderStatusBar(this: CliEditor): string {
    // This is no longer used by render(), but might be called by legacy code if any?
    // The Mixin requires it to exist.
    return ''; 
}

export const renderingMethods = {
    updateGutterWidth, // Export the new method
    getLineVisualHeight,
    getLogicalFromVisual,
    render,
    setStatusMessage,
    renderStatusBar,
    renderStatusBarToBuffer,
};