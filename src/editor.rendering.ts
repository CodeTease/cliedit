// src/editor.rendering.ts

import { CliEditor } from './editor.js';
import { ANSI } from './constants.js';

/**
 * Core methods for rendering the document content, status bar, and cursor.
 */

/**
 * Recalculates the entire visual layout of the document based on screen width (line wrapping).
 */
function recalculateVisualRows(this: CliEditor): void {
    this.visualRows = [];
    // Calculate content width excluding gutter
    const contentWidth = Math.max(1, this.screenCols - this.gutterWidth);

    for (let y = 0; y < this.lines.length; y++) {
      const line = this.lines[y];
      if (line.length === 0) {
        // Handle empty line case
        this.visualRows.push({ logicalY: y, logicalXStart: 0, content: '' });
      } else {
        let x = 0;
        // Chunk the line content based on contentWidth
        while (x < line.length) {
          const chunk = line.substring(x, x + contentWidth);
          this.visualRows.push({ logicalY: y, logicalXStart: x, content: chunk });
          x += contentWidth;
        }
      }
    }
}

/**
 * The main rendering loop.
 */
function render(this: CliEditor): void {
    this.adjustCursorPosition();
    this.scroll();

    let buffer = ANSI.MOVE_CURSOR_TOP_LEFT;
    
    const currentVisualRowIndex = this.findCurrentVisualRowIndex();
    const cursorVisualRow = this.visualRows[currentVisualRowIndex];
    const cursorVisualX = cursorVisualRow ? (this.cursorX - cursorVisualRow.logicalXStart) : 0;
    
    // Determine where the physical cursor should be placed
    const displayX = cursorVisualX + this.gutterWidth;
    const displayY = this.screenStartRow + (currentVisualRowIndex - this.rowOffset); 
    
    const selectionRange = this.getNormalizedSelection();

    // Scrollbar calculations
    const totalLines = this.visualRows.length;
    const showScrollbar = totalLines > this.screenRows;
    const thumbHeight = showScrollbar ? Math.max(1, Math.floor((this.screenRows / totalLines) * this.screenRows)) : 0;
    const thumbStart = showScrollbar ? Math.floor((this.rowOffset / totalLines) * this.screenRows) : 0;

    // Draw visual rows
    for (let y = 0; y < this.screenRows; y++) {
      const visualRowIndex = y + this.rowOffset;
      // Move to start of the row
      buffer += `\x1b[${this.screenStartRow + y};1H`; 
      
      if (visualRowIndex >= this.visualRows.length) {
        // Draw Tilde for lines past file end
        buffer += `~ ${ANSI.CLEAR_LINE}`;
      } else {
        const row = this.visualRows[visualRowIndex];
        
        // 1. Draw Gutter (Line Number)
        const lineNumber = (row.logicalXStart === 0) 
          ? `${row.logicalY + 1}`.padStart(this.gutterWidth - 2, ' ') + ' | '
          : ' '.padStart(this.gutterWidth - 2, ' ') + ' | ';
        buffer += lineNumber;

        let lineContent = row.content;
        
        // Retrieve syntax color map for the full logical line
        // We pass the full line content because the scanner needs context
        const syntaxColorMap = this.getLineSyntaxColor(row.logicalY, this.lines[row.logicalY]);

        // 2. Draw Content (Character by Character for selection/cursor)
        for (let i = 0; i < lineContent.length; i++) {
            const char = lineContent[i];
            const logicalX = row.logicalXStart + i;
            const logicalY = row.logicalY;
            
            const isCursorPosition = (visualRowIndex === currentVisualRowIndex && i === cursorVisualX);
            const isSelected = selectionRange && this.isPositionInSelection(logicalY, logicalX, selectionRange);
            
            // Highlight search result under cursor
            // Check if this character is part of ANY search result
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

            // Check if this character is part of the CURRENTLY SELECTED search result
            const isCurrentSearchResult = (
                this.searchResultIndex !== -1 &&
                this.searchResults[this.searchResultIndex]?.y === logicalY &&
                logicalX >= this.searchResults[this.searchResultIndex]?.x &&
                logicalX < (this.searchResults[this.searchResultIndex]?.x + this.searchQuery.length)
            );

            // Syntax highlight color
            const syntaxColor = syntaxColorMap.get(logicalX);

            if (isSelected) {
                buffer += ANSI.INVERT_COLORS + char + ANSI.RESET_COLORS;
            } else if (isCursorPosition) {
                 // Cursor is a single inverted character if not already covered by selection
                 buffer += ANSI.INVERT_COLORS + char + ANSI.RESET_COLORS;
            } else if (isCurrentSearchResult) {
                // Selected Match: Invert + Underline (if supported) or just Invert
                buffer += ANSI.INVERT_COLORS + '\x1b[4m' + char + ANSI.RESET_COLORS;
            } else if (isGlobalSearchResult) {
                // Global Match: Invert only
                buffer += ANSI.INVERT_COLORS + char + ANSI.RESET_COLORS;
            } else if (syntaxColor) {
                // Apply syntax color
                buffer += syntaxColor + char + ANSI.RESET_COLORS;
            }
            else {
                buffer += char;
            }
        }
        
        // 3. Handle Cursor at the absolute end of the line (drawing an inverted space)
        const isCursorAtEndOfVisualLine = (visualRowIndex === currentVisualRowIndex && cursorVisualX === lineContent.length);
        
        if (isCursorAtEndOfVisualLine) {
            // If the cursor is at the end of the line/chunk, draw the inverted space
            buffer += ANSI.INVERT_COLORS + ' ' + ANSI.RESET_COLORS;
        }

        buffer += `${ANSI.CLEAR_LINE}`;
      }

      // Draw Scrollbar (Phase 2)
      if (showScrollbar) {
          const isThumb = y >= thumbStart && y < thumbStart + thumbHeight;
          const scrollChar = isThumb ? '┃' : '│'; 
          // Move to last column and draw
          buffer += `\x1b[${this.screenStartRow + y};${this.screenCols}H${ANSI.RESET_COLORS}${scrollChar}`;
      }
    }

    // Draw status bar
    buffer += `\x1b[${this.screenRows + this.screenStartRow};1H`;
    buffer += this.renderStatusBar();
    
    // Set physical cursor position (ensure cursor is visible on screen)
    if (displayY >= this.screenStartRow && displayY < this.screenRows + this.screenStartRow) {
         buffer += `\x1b[${displayY};${displayX + 1}H`;
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
            const visualRowIndex = this.findCurrentVisualRowIndex();
            const visualRow = this.visualRows[visualRowIndex];
            const visualX = visualRow ? (this.cursorX - visualRow.logicalXStart) : 0;
            
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
    recalculateVisualRows,
    render,
    setStatusMessage,
    renderStatusBar,
};