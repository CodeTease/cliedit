// src/editor.search.ts

import { CliEditor } from './editor.js';

/**
 * Methods related to Find/Search functionality.
 */

/**
 * Enters search mode.
 */
function enterSearchMode(this: CliEditor): void {
    this.mode = 'search';
    this.searchQuery = '';
    this.searchResults = [];
    this.searchResultIndex = -1;
    this.setStatusMessage('Search (ESC/Ctrl+Q/C to cancel, ENTER to find): ');
}

/**
 * Executes the search and populates results.
 */
function executeSearch(this: CliEditor): void {
    this.searchResults = [];
    if (this.searchQuery === '') return;
    for (let y = 0; y < this.lines.length; y++) {
      const line = this.lines[y];
      let index = -1;
      while ((index = line.indexOf(this.searchQuery, index + 1)) !== -1) {
        this.searchResults.push({ y, x: index });
      }
    }
    this.searchResultIndex = -1;
    this.setStatusMessage(`Found ${this.searchResults.length} results for "${this.searchQuery}"`);
}

/**
 * Jumps to the next search result.
 */
function findNext(this: CliEditor): void {
    if (this.searchResults.length === 0) {
      this.setStatusMessage('No search results');
      return;
    }
    this.searchResultIndex = (this.searchResultIndex + 1) % this.searchResults.length;
    this.jumpToResult(this.searchResults[this.searchResultIndex]);
}

/**
 * Moves cursor and adjusts scroll offset to make the result visible.
 */
function jumpToResult(this: CliEditor, result: { y: number, x: number }): void {
    this.cursorY = result.y;
    this.cursorX = result.x;
    const visualRowIndex = this.findCurrentVisualRowIndex();
    
    // Calculate new scroll offset to center the result visually
    this.rowOffset = Math.max(0, visualRowIndex - Math.floor(this.screenRows / 2));
}

export const searchMethods = {
    enterSearchMode,
    executeSearch,
    findNext,
    jumpToResult,
};