// src/editor.search.ts

import { CliEditor } from './editor.js';

/**
 * Methods related to Find/Search/Replace functionality.
 */

/**
 * Enters Find mode.
 */
function enterFindMode(this: CliEditor): void {
    this.mode = 'search_find';
    this.searchQuery = '';
    this.replaceQuery = null; // Mark as Find-Only
    this.searchResults = [];
    this.searchResultIndex = -1;
    this.setStatusMessage('Find (ESC to cancel): ');
}

/**
 * Enters Replace mode (starting with the "Find" prompt).
 */
function enterReplaceMode(this: CliEditor): void {
    this.mode = 'search_find';
    this.searchQuery = '';
    this.replaceQuery = ''; // Mark as Replace flow
    this.searchResults = [];
    this.searchResultIndex = -1;
    this.setStatusMessage('Find (for Replace): ');
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
    if (this.replaceQuery === null) { // Find-only flow
        this.setStatusMessage(`Found ${this.searchResults.length} results for "${this.searchQuery}"`);
    }
}

/**
 * Jumps to the next search result.
 */
function findNext(this: CliEditor): void {
    if (this.searchQuery === '') {
        this.enterFindMode();
        return;
    }
    // Execute search if results are not yet populated
    if (this.searchResults.length === 0 && this.searchResultIndex === -1) {
        this.executeSearch();
    }
    if (this.searchResults.length === 0) {
        this.setStatusMessage('No results found');
        this.mode = 'edit';
        return;
    }

    this.searchResultIndex++;
    
    if (this.searchResultIndex >= this.searchResults.length) {
        this.setStatusMessage('End of file reached. Starting from top.');
        this.searchResultIndex = 0;
    }
    
    const result = this.searchResults[this.searchResultIndex];
    this.jumpToResult(result);

    if (this.replaceQuery !== null) {
        // Replace flow: Enter confirmation step
        this.mode = 'search_confirm';
        this.setStatusMessage(`Replace "${this.searchQuery}"? (y/n/a/q)`);
    } else {
        // Find-only flow: Go back to edit
        this.mode = 'edit';
    }
}

/**
 * Replaces the current highlighted search result and finds the next one.
 */
function replaceCurrentAndFindNext(this: CliEditor): void {
    if (this.searchResultIndex === -1 || !this.searchResults[this.searchResultIndex]) {
        this.findNext();
        return;
    }
    
    const result = this.searchResults[this.searchResultIndex];
    const line = this.lines[result.y];
    
    const before = line.substring(0, result.x);
    const after = line.substring(result.x + this.searchQuery.length);
    
    // Use replaceQuery (it's guaranteed to be a string here, not null)
    this.lines[result.y] = before + this.replaceQuery! + after;
    this.setDirty();

    // Store current position to find the *next* match after this one
    const replacedResultY = result.y;
    const replacedResultX = result.x;

    // We MUST re-execute search as all indices may have changed
    this.executeSearch();
    this.recalculateVisualRows();

    // Find the next result *after* the one we just replaced
    let nextIndex = -1;
    for (let i = 0; i < this.searchResults.length; i++) {
        const res = this.searchResults[i];
        if (res.y > replacedResultY || (res.y === replacedResultY && res.x > replacedResultX)) {
            nextIndex = i;
            break;
        }
    }

    if (nextIndex === -1) {
        this.setStatusMessage('No more results');
        this.mode = 'edit';
        this.searchResultIndex = -1; // Reset search
        return;
    }

    // Found the next one
    this.searchResultIndex = nextIndex;
    this.jumpToResult(this.searchResults[this.searchResultIndex]);
    this.mode = 'search_confirm'; // Stay in confirm mode
    this.setStatusMessage(`Replace "${this.searchQuery}"? (y/n/a/q)`);
}

/**
 * Replaces all occurrences of the search query.
 */
function replaceAll(this: CliEditor): void {
    if (this.searchResults.length === 0) {
        this.executeSearch();
    }
    if (this.searchResults.length === 0) {
        this.setStatusMessage('No results found');
        this.mode = 'edit';
        return;
    }

    let count = 0;
    // Iterate backwards to ensure indices remain valid during replacement
    for (let i = this.searchResults.length - 1; i >= 0; i--) {
        const result = this.searchResults[i];
        const line = this.lines[result.y];
        
        const before = line.substring(0, result.x);
        const after = line.substring(result.x + this.searchQuery.length);
        
        this.lines[result.y] = before + this.replaceQuery! + after;
        count++;
    }
    
    this.setDirty();
    this.recalculateVisualRows();
    this.mode = 'edit';
    this.searchResults = [];
    this.searchResultIndex = -1;
    this.setStatusMessage(`Replaced ${count} occurrences.`);
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
    enterFindMode,
    enterReplaceMode,
    executeSearch,
    findNext,
    replaceCurrentAndFindNext,
    replaceAll,
    jumpToResult,
};