// src/types.ts

/**
 * Defines the necessary state for saving and restoring the document content
 * and cursor position for the History Manager (Undo/Redo).
 */
export type DocumentState = { 
    lines: string[], 
    cursorX: number, 
    cursorY: number 
};

/**
 * Defines a row as it is displayed on the terminal (after line wrapping).
 */
export interface VisualRow {
    logicalY: number;
    logicalXStart: number;
    content: string;
}

export type EditorMode = 'edit' | 'search_find' | 'search_replace' | 'search_confirm' | 'goto_line';