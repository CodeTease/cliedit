// src/editor.selection.ts

import { CliEditor } from './editor.js';

// Defines the normalized selection range where start is always before end
export type NormalizedRange = {
    start: { x: number, y: number }, 
    end: { x: number, y: number } 
};

// Export the type of the methods object for TypeScript merging
export type TSelectionMethods = {
    startOrUpdateSelection: () => void;
    cancelSelection: () => void;
    getNormalizedSelection: () => NormalizedRange | null;
    isPositionInSelection: (logicalY: number, logicalX: number, range: NormalizedRange) => boolean;
    getSelectedText: () => string;
    deleteSelectedText: () => void;
};


/**
 * Methods related to Text Selection management.
 */

/**
 * Starts or updates the selection anchor.
 */
function startOrUpdateSelection(this: CliEditor): void {
    if (!this.selectionAnchor) {
        this.selectionAnchor = { x: this.cursorX, y: this.cursorY };
    }
    // If it exists, we just let the cursor move to update the selection end point.
}

/**
 * Cancels the current selection.
 */
function cancelSelection(this: CliEditor): void {
    this.selectionAnchor = null;
}

/**
 * Returns the selection range with 'start' always before 'end' (normalized).
 */
function getNormalizedSelection(this: CliEditor): NormalizedRange | null {
    if (!this.selectionAnchor) return null;

    const p1 = this.selectionAnchor;
    const p2 = { x: this.cursorX, y: this.cursorY };

    if (p1.y < p2.y || (p1.y === p2.y && p1.x < p2.x)) {
        return { start: p1, end: p2 };
    } else {
        return { start: p2, end: p1 };
    }
}

/**
 * Checks if a logical position (Y, X) is inside the normalized selection range.
 */
function isPositionInSelection(this: CliEditor, logicalY: number, logicalX: number, range: NormalizedRange): boolean {
    if (logicalY < range.start.y || logicalY > range.end.y) return false;

    // Check if the position is on the start line
    if (logicalY === range.start.y && logicalX < range.start.x) return false;

    // Check if the position is on the end line
    // The position is INCLUDED until it hits the end x-coordinate
    if (logicalY === range.end.y && logicalX >= range.end.x) return false;

    return true;
}

/**
 * Extracts the selected text.
 */
function getSelectedText(this: CliEditor): string {
    const range = this.getNormalizedSelection();
    if (!range) return '';

    const selectedLines: string[] = [];

    for (let y = range.start.y; y <= range.end.y; y++) {
        const line = this.lines[y] || '';

        const startX = (y === range.start.y) ? range.start.x : 0;
        let endX = (y === range.end.y) ? range.end.x : line.length;

        // Ensure we don't try to select past the actual line length
        endX = Math.min(endX, line.length);

        if (startX < endX) {
            selectedLines.push(line.substring(startX, endX));
        } else if (y === range.start.y && range.start.y === range.end.y && startX === endX) {
            // Handle case where selection is zero-width, but on the same line (empty string)
        } else if (y < range.end.y) {
            // If it's an empty line that is fully included in the selection
            selectedLines.push('');
        }
    }

    // Join the extracted lines
    return selectedLines.join('\n');
}

/**
 * Deletes the currently selected text, adjusting the cursor position.
 * Returns true if deletion occurred.
 */
function deleteSelectedText(this: CliEditor): boolean {
    const range = this.getNormalizedSelection();
    if (!range) return false;

    const { start, end } = range;
    
    // 1. Join the remaining parts:
    //    Part 1: Start line content before selection start
    const startLineContent = this.lines[start.y].substring(0, start.x);
    //    Part 2: End line content after selection end
    const endLineContent = this.lines[end.y].substring(end.x);
    
    // 2. Set the content of the start line to the joined content
    this.lines[start.y] = startLineContent + endLineContent;
    
    // 3. Remove all lines between start.y and end.y (exclusive)
    const linesToDeleteCount = end.y - start.y;
    if (linesToDeleteCount > 0) {
        this.lines.splice(start.y + 1, linesToDeleteCount);
    }

    // 4. Update cursor position (it moves to the start of the former selection)
    this.cursorY = start.y;
    this.cursorX = start.x;

    // 5. Clear selection
    this.cancelSelection();
    this.setDirty();

    // 6. Ensure we didn't accidentally make the document empty
    if (this.lines.length === 0) {
        this.lines = [''];
    }

    return true;
}

export const selectionMethods: TSelectionMethods = {
    startOrUpdateSelection,
    cancelSelection,
    getNormalizedSelection,
    isPositionInSelection,
    getSelectedText,
    deleteSelectedText,
};