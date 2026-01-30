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

export type EditorMode = 'edit' | 'search_find' | 'search_replace' | 'search_confirm' | 'goto_line';

export interface EditorOptions {
    tabSize?: number;
    gutterWidth?: number;
    inputStream?: NodeJS.ReadStream; // stream.Readable
}