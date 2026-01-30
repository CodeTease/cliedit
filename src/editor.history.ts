// src/editor.history.ts

import { CliEditor } from './editor.js';
import { DocumentState } from './types.js';

/**
 * Methods related to Undo/Redo operations.
 */

/**
 * Gets the current document state (content and cursor position).
 */
function getCurrentState(this: CliEditor): DocumentState {
    return {
      // Use JSON to deep clone the lines array
      lines: JSON.parse(JSON.stringify(this.lines)), 
      cursorX: this.cursorX,
      cursorY: this.cursorY,
    };
}

/**
 * Saves the current state to the history manager.
 */
function saveState(this: CliEditor, _initial: boolean = false): void {
    // Only save if content is different from the last state, 
    // but ALWAYS save the initial state.
    this.history.saveState(this.getCurrentState());
}

/**
 * Loads a document state from the history manager.
 */
function loadState(this: CliEditor, state: DocumentState): void {
    this.lines = state.lines;
    this.cursorX = state.cursorX;
    this.cursorY = state.cursorY;
    this.adjustCursorPosition();
}

/**
 * Performs an undo operation.
 */
function undo(this: CliEditor): void {
    const state = this.history.undo(this.getCurrentState());
    if (state) {
        this.loadState(state);
        this.setDirty();
        this.invalidateSyntaxCache();
        this.setStatusMessage('Undo successful');
    }
    else {
        this.setStatusMessage('Already at oldest change');
    }
}

/**
 * Performs a redo operation.
 */
function redo(this: CliEditor): void {
    const state = this.history.redo(this.getCurrentState());
    if (state) {
        this.loadState(state);
        this.setDirty();
        this.invalidateSyntaxCache();
        this.setStatusMessage('Redo successful');
    }
    else {
        this.setStatusMessage('Already at newest change');
    }
}

export const historyMethods = {
    getCurrentState,
    saveState,
    loadState,
    undo,
    redo,
};