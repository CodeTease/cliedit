// src/editor.rendering.ts

import { CliEditor } from './editor.js';
import { ANSI } from './constants.js';

/**
 * Core methods for rendering the document content, status bar, and cursor.
 */

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
 * 
 * @param visualY The global visual row index (0-based).
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
    this.adjustCursorPosition();
    this.scroll();

    let buffer = ANSI.MOVE_CURSOR_TOP_LEFT;
    
    // Calculate current visual cursor position
    const currentVisualRowIndex = this.findCurrentVisualRowIndex();
    
    // We need to calculate the cursor's visual X on the fly
    const contentWidth = Math.max(1, this.screenCols - this.gutterWidth);
    
    // Find the starting logical line and offset based on rowOffset (which is visual)
    const startPos = this.getLogicalFromVisual(this.rowOffset);
    let logicalY = startPos.logicalY;
    // visualOffsetInLine is how many *visual rows* into the logical line we are.
    // e.g. if line wraps to 3 rows, and we are at offset 1, we start rendering from the 2nd chunk.
    let visualOffsetInLine = startPos.visualYOffset;

    let visualRowsRendered = 0;
    
    const selectionRange = this.getNormalizedSelection();

    // Scrollbar calculations (Approximation for performance)
    // Calculating exact total visual lines is O(N), expensive for scrollbar every frame.
    // Workaround: Use logical lines for scrollbar scaling?
    // User plan: "Chấp nhận scrollbar chỉ hiển thị tương đối theo Logical Lines"
    // BUT rowOffset is visual. Mixing units is bad.
    // Let's try to estimate total visual lines = lines.length * (average width / screen width)?
    // For now, let's use logical mapping for scrollbar or just O(N) if file is small.
    // Given the prompt "High Risk", let's assume we skip precise scrollbar or do a quick estimate.
    // Let's use logical line ratio for scrollbar thumb position.
    
    const totalLines = this.lines.length;
    // Map rowOffset (visual) back to logical for scrollbar positioning
    const startLogicalY = startPos.logicalY; 
    const showScrollbar = totalLines > this.screenRows; // Approximate check
    const thumbHeight = showScrollbar ? Math.max(1, Math.floor((this.screenRows / totalLines) * this.screenRows)) : 0;
    const thumbStart = showScrollbar ? Math.floor((startLogicalY / totalLines) * this.screenRows) : 0;

    // Render Loop
    while (visualRowsRendered < this.screenRows) {
        // Stop if we run out of content
        if (logicalY >= this.lines.length) {
            // Fill remaining screen with tildes
            buffer += `\x1b[${this.screenStartRow + visualRowsRendered};1H`; 
            buffer += `~ ${ANSI.CLEAR_LINE}`;
            visualRowsRendered++;
            continue;
        }

        const line = this.lines[logicalY];
        const lineVisualHeight = this.getLineVisualHeight(logicalY);

        // Render chunks for this logical line starting from visualOffsetInLine
        for (let v = visualOffsetInLine; v < lineVisualHeight && visualRowsRendered < this.screenRows; v++) {
            buffer += `\x1b[${this.screenStartRow + visualRowsRendered};1H`; 
            
            // Calculate slice of string
            const chunkStart = v * contentWidth;
            const chunkEnd = Math.min(chunkStart + contentWidth, line.length);
            // Handle empty line case
            const chunk = (line.length === 0 && v === 0) ? '' : line.substring(chunkStart, chunkEnd);
            
            // 1. Draw Gutter
            // Only draw number on the first visual row of the logical line
            const lineNumber = (v === 0) 
              ? `${logicalY + 1}`.padStart(this.gutterWidth - 2, ' ') + ' | '
              : ' '.padStart(this.gutterWidth - 2, ' ') + ' | ';
            buffer += lineNumber;

            // 2. Syntax Highlighting & Char Rendering
            const syntaxColorMap = this.getLineSyntaxColor(logicalY, line);
            
            for (let i = 0; i < chunk.length; i++) {
                const char = chunk[i];
                const logicalX = chunkStart + i;
                
                // Check Cursor
                // Cursor is at logicalY, this.cursorX.
                // Is this visual row the one containing the cursor?
                const isCursorRow = (logicalY === this.cursorY) && 
                                    (logicalX >= chunkStart && logicalX < chunkStart + contentWidth);
                
                // The visual cursor is at (cursorX - chunkStart) inside this chunk.
                const isCursorPosition = (logicalY === this.cursorY) && (logicalX === this.cursorX);

                const isSelected = selectionRange && this.isPositionInSelection(logicalY, logicalX, selectionRange);
                
                // Highlight search result
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

                const syntaxColor = syntaxColorMap.get(logicalX);

                if (isSelected) {
                    buffer += ANSI.INVERT_COLORS + char + ANSI.RESET_COLORS;
                } else if (isCursorPosition) {
                     buffer += ANSI.INVERT_COLORS + char + ANSI.RESET_COLORS;
                } else if (isCurrentSearchResult) {
                    buffer += ANSI.INVERT_COLORS + '\x1b[4m' + char + ANSI.RESET_COLORS;
                } else if (isGlobalSearchResult) {
                    buffer += ANSI.INVERT_COLORS + char + ANSI.RESET_COLORS;
                } else if (syntaxColor) {
                    buffer += syntaxColor + char + ANSI.RESET_COLORS;
                }
                else {
                    buffer += char;
                }
            }

            // Handle Cursor at End of Line
            // If cursor is at the very end of the line, and this is the last chunk of the line
            if (logicalY === this.cursorY && this.cursorX === line.length) {
                // Check if this chunk is the last one
                if (chunkEnd === line.length) {
                     buffer += ANSI.INVERT_COLORS + ' ' + ANSI.RESET_COLORS;
                }
            }
            
            buffer += `${ANSI.CLEAR_LINE}`;
            
            // Draw Scrollbar (using calculated thumb)
            if (showScrollbar) {
                const isThumb = visualRowsRendered >= thumbStart && visualRowsRendered < thumbStart + thumbHeight;
                const scrollChar = isThumb ? '┃' : '│'; 
                buffer += `\x1b[${this.screenStartRow + visualRowsRendered};${this.screenCols}H${ANSI.RESET_COLORS}${scrollChar}`;
            }

            visualRowsRendered++;
        }

        // Move to next logical line
        logicalY++;
        visualOffsetInLine = 0; // Reset offset for next line
    }

    // Draw status bar
    buffer += `\x1b[${this.screenRows + this.screenStartRow};1H`;
    buffer += this.renderStatusBar();
    
    // Set physical cursor position (ensure cursor is visible on screen)
    // We need to calculate where the cursor IS on the screen relative to rowOffset
    // We already know cursorY/cursorX.
    // Calculate global visual index of cursor
    const cursorGlobalVisualRow = this.findCurrentVisualRowIndex(); // O(N) scan potentially
    
    // Screen Y = (CursorGlobalVisual - RowOffset)
    const relativeVisualRow = cursorGlobalVisualRow - this.rowOffset;
    
    if (relativeVisualRow >= 0 && relativeVisualRow < this.screenRows) {
        // Calculate visual X
        const line = this.lines[this.cursorY] || '';
        const cx = this.cursorX;
        // visual X is column in the wrapping
        const visualXInChunk = cx % contentWidth;
        
        const displayY = this.screenStartRow + relativeVisualRow;
        const displayX = visualXInChunk + this.gutterWidth + 1;
        buffer += `\x1b[${displayY};${displayX}H`;
    }

    process.stdout.write(buffer);
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
        if (!this.isCleanedUp) this.renderStatusBar();
      }, timeoutMs);
    }
    if (!this.isCleanedUp) this.renderStatusBar();
}

/**
 * Generates the status bar content (bottom two lines).
 */
function renderStatusBar(this: CliEditor): string {
    let status = '';
    const contentWidth = this.screenCols;
    
    // --- Line 1: Mode, File Status, Position ---
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
            // The (y/n/a/q) prompt is set via setStatusMessage
            status = this.statusMessage; 
            break;
        case 'edit':
        default:
            // Calculate visual coordinates for display
            // Note: findCurrentVisualRowIndex is expensive now? Yes O(N).
            // But we need it for correct cursor positioning anyway.
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
    
    status = status.padEnd(contentWidth);
    let buffer = `${ANSI.INVERT_COLORS}${status}${ANSI.RESET_COLORS}`;
    
    // --- Line 2: Message/Help line ---
    buffer += `\x1b[${this.screenRows + this.screenStartRow + 1};1H`; 
    
    // Show prompt message if in search mode, otherwise show default help
    const message = (this.mode === 'edit' ? this.DEFAULT_STATUS : this.statusMessage).padEnd(contentWidth);
    buffer += `${message}${ANSI.CLEAR_LINE}`;
    
    return buffer;
}

export const renderingMethods = {
    getLineVisualHeight,
    getLogicalFromVisual,
    render,
    setStatusMessage,
    renderStatusBar,
};