// src/history.ts

import { DocumentState } from './types.js';

/**
 * Manages the undo/redo history stack for the editor.
 */
export class HistoryManager {
  private undoHistory: DocumentState[] = [];
  private redoHistory: DocumentState[] = [];
  private readonly historyLimit: number;

  constructor(historyLimit: number = 100) {
    this.historyLimit = historyLimit;
  }

  /**
   * Saves the current state to the undo history.
   * This clears the redo history.
   */
  public saveState(state: DocumentState): void {
    // Clear redo history on new action
    this.redoHistory = [];

    // Add to undo history
    this.undoHistory.push(state);

    // Maintain history limit
    if (this.undoHistory.length > this.historyLimit) {
      this.undoHistory.shift();
    }
  }

  /**
   * Performs an undo operation.
   * @param currentState The state *before* undoing, to save to redo stack.
   * @returns The state to restore (DocumentState) or null if no history.
   */
  public undo(currentState: DocumentState): DocumentState | null {
    const previousState = this.undoHistory.pop();
    if (!previousState) {
      return null; // Nothing to undo
    }

    // Save current state to redo stack
    this.redoHistory.push(currentState);
    return previousState;
  }

  /**
   * Performs a redo operation.
   * @param currentState The state *before* redoing, to save to undo stack.
   * @returns The state to restore (DocumentState) or null if no history.
   */
  public redo(currentState: DocumentState): DocumentState | null {
    const nextState = this.redoHistory.pop();
    if (!nextState) {
      return null; // Nothing to redo
    }

    // Save current (undone) state back to undo stack
    this.undoHistory.push(currentState);
    return nextState;
  }

  public clear(): void {
    this.undoHistory = [];
    this.redoHistory = [];
  }
}