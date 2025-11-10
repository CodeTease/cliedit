// src/editor.keys.ts

import { CliEditor } from './editor.js';
import { KEYS } from './constants.js';
import type { KeypressEvent } from 'keypress';

// Local module declaration for keypress to satisfy TS imports
declare module 'keypress' {
    export interface KeypressEvent {
        name?: string;
        ctrl: boolean;
        meta: boolean;
        shift: boolean;
        sequence: string;
    }
}

// (FIX TS2339 & TS2724) Export all function types for merging
export type TKeyHandlingMethods = {
    handleKeypressEvent: (ch: string, key: KeypressEvent) => void;
    handleEditKeys: (key: string) => boolean;
    handleSearchKeys: (key: string) => void;
    handleCtrlQ: () => void;
    handleCopy: () => Promise<void>;
    handleCharacterKey: (ch: string) => void;
    cutSelection: () => Promise<void>; 
    handleSave: () => Promise<void>; 
};

/**
 * Main router for standardized keypress events from the 'keypress' library.
 */
function handleKeypressEvent(this: CliEditor, ch: string, key: KeypressEvent): void {
    // CRASH FIX: If the editor is already closing, ignore all input.
    if (this.isExiting) {
        return;
    }

    // CRASH FIX: Handle case where 'key' is undefined (a normal character key)
    if (!key) {
        if (ch && ch >= ' ' && ch <= '~') {
            this.handleCharacterKey(ch);
            this.recalculateVisualRows();
            this.render();
        }
        return; 
    }
    
    // --- From here, 'key' object is guaranteed to exist ---

    let keyName: string | undefined = undefined;
    let edited = false; 

    // 1. Map Control sequences (Ctrl+Arrow for selection)
    if (key.ctrl) {
        if (key.name === 'up') keyName = KEYS.CTRL_ARROW_UP;
        else if (key.name === 'down') keyName = KEYS.CTRL_ARROW_DOWN;
        else if (key.name === 'left') keyName = KEYS.CTRL_ARROW_LEFT;
        else if (key.name === 'right') keyName = KEYS.CTRL_ARROW_RIGHT;
        else keyName = key.sequence; // Use sequence for Ctrl+S, Ctrl+C, etc.
    } else {
        // 2. (FIXED) Map standard navigation keys (Arrow, Home, End)
        if (key.name === 'up') keyName = KEYS.ARROW_UP;
        else if (key.name === 'down') keyName = KEYS.ARROW_DOWN;
        else if (key.name === 'left') keyName = KEYS.ARROW_LEFT;
        else if (key.name === 'right') keyName = KEYS.ARROW_RIGHT;
        else if (key.name === 'home') keyName = KEYS.HOME;
        else if (key.name === 'end') keyName = KEYS.END;
        else if (key.name === 'pageup') keyName = KEYS.PAGE_UP;
        else if (key.name === 'pagedown') keyName = KEYS.PAGE_DOWN;
        else if (key.name === 'delete') keyName = KEYS.DELETE;
        else if (key.name === 'backspace') keyName = KEYS.BACKSPACE;
        else if (key.name === 'return') keyName = KEYS.ENTER;
        else if (key.name === 'tab') keyName = KEYS.TAB;
        else keyName = key.sequence; // Fallback
    }

    // 3. (FIXED) Handle printable characters immediately
    // This was the source of the "no typing" bug.
    // We must check for characters *before* routing to handleEditKeys.
    if (keyName && keyName.length === 1 && keyName >= ' ' && keyName <= '~' && !key.ctrl && !key.meta) {
        this.handleCharacterKey(keyName);
        this.recalculateVisualRows();
        this.render();
        return;
    }

    // 4. Mode Routing (If it's not a character, it's a command)
    if (this.mode === 'search') {
        this.handleSearchKeys(keyName || ch);
    } else {
        // 5. Handle Selection Keys (Ctrl+Arrow)
        switch (keyName) {
            case KEYS.CTRL_ARROW_UP:
                this.startOrUpdateSelection();
                this.moveCursorVisually(-1);
                this.render();
                return;
            case KEYS.CTRL_ARROW_DOWN:
                this.startOrUpdateSelection();
                this.moveCursorVisually(1);
                this.render();
                return;
            case KEYS.CTRL_ARROW_LEFT:
                this.startOrUpdateSelection();
                this.moveCursorLogically(-1);
                this.render();
                return;
            case KEYS.CTRL_ARROW_RIGHT:
                this.startOrUpdateSelection();
                this.moveCursorLogically(1);
                this.render();
                return;
        }

        // 6. Handle all other command keys (Editing/Commands)
        edited = this.handleEditKeys(keyName || ch);
    }

    // 7. State Update and Render
    if (edited) {
        this.saveState();
        this.recalculateVisualRows();
    }

    if (!this.isExiting) {
        this.render();
    }
}

/**
 * Handles all command keys in 'edit' mode.
 * Returns true if content was modified.
 */
function handleEditKeys(this: CliEditor, key: string): boolean {
    // (FIXED) Removed the guard clause that was blocking typing.
    // if (key.length === 1 && key >= ' ' && key <= '~') {
    //     return false;
    // }

    // Cancel selection on normal navigation
    const isNavigation = [
        KEYS.ARROW_UP, KEYS.ARROW_DOWN, KEYS.ARROW_LEFT, KEYS.ARROW_RIGHT,
        KEYS.HOME, KEYS.END, KEYS.PAGE_UP, KEYS.PAGE_DOWN
    ].includes(key);

    if (isNavigation) {
        this.cancelSelection();
        if (this.isMessageCustom) {
            this.setStatusMessage(this.DEFAULT_STATUS, 0);
        }
    }
    
    // Commands that return Promises must be wrapped in a sync call here
    switch (key) {
        // --- Exit / Save ---
        case KEYS.CTRL_Q:
            this.handleCtrlQ();
            return false;
        case KEYS.CTRL_S:
            this.handleSave();
            return false;
        case KEYS.CTRL_C:
            this.handleCopy();
            return false;
        
        // --- Navigation ---
        case KEYS.ARROW_UP:
            this.moveCursorVisually(-1);
            return false;
        case KEYS.ARROW_DOWN:
            this.moveCursorVisually(1);
            return false;
        case KEYS.ARROW_LEFT:
            this.moveCursorLogically(-1);
            return false;
        case KEYS.ARROW_RIGHT:
            this.moveCursorLogically(1);
            return false;
        case KEYS.HOME:
            this.cursorX = this.findVisualRowStart();
            return false;
        case KEYS.END:
            this.cursorX = this.findVisualRowEnd();
            return false;
        case KEYS.PAGE_UP:
            this.moveCursorVisually(-this.screenRows);
            return false;
        case KEYS.PAGE_DOWN:
            this.moveCursorVisually(this.screenRows);
            return false;

        // --- Editing ---
        case KEYS.ENTER:
            this.insertNewLine();
            return true;
        case KEYS.BACKSPACE:
            if (this.selectionAnchor) this.deleteSelectedText();
            else this.deleteBackward();
            return true;
        case KEYS.DELETE:
            if (this.selectionAnchor) this.deleteSelectedText();
            else this.deleteForward();
            return true;
        case KEYS.TAB:
            this.insertSoftTab();
            return true;

        // --- Search & History ---
        case KEYS.CTRL_W:
            this.enterSearchMode();
            return false;
        case KEYS.CTRL_G:
            this.findNext();
            return false;
        case KEYS.CTRL_Z:
            this.undo();
            return true; 
        case KEYS.CTRL_Y:
            this.redo();
            return true; 

        // --- Clipboard ---
        case KEYS.CTRL_K: // Cut Line (Traditional)
            this.cutLine();
            return true;
        case KEYS.CTRL_U: // Paste Line (Traditional)
            this.pasteLine();
            return true;
        case KEYS.CTRL_X: // Cut Selection
            this.cutSelection(); // Synchronous wrapper for cutSelectionAsync
            return true;
        case KEYS.CTRL_V: // Paste Selection
            this.pasteSelection();
            return true;

        default:
            return false;
    }
}

/**
 * Handles insertion of a character, deleting selection first if it exists.
 */
function handleCharacterKey(this: CliEditor, ch: string): void {
    if (this.selectionAnchor) {
        this.deleteSelectedText();
    }
    this.insertCharacter(ch);
    this.setDirty();
}

/**
 * Handles Ctrl+Q (Quit) sequence.
 */
function handleCtrlQ(this: CliEditor): void {
    if (this.isDirty && !this.quitConfirm) {
        this.quitConfirm = true;
        this.setStatusMessage('Warning: Unsaved changes! Press Ctrl+Q again to quit.');
        setTimeout(() => { this.quitConfirm = false; }, 3000);
        return;
    }
    this.isExiting = true; 
    this.resolvePromise?.({ saved: false, content: this.lines.join('\n') });
}

/**
 * Handles Ctrl+C (Copy Selection or All) sequence.
 */
async function handleCopy(this: CliEditor): Promise<void> {
    let textToCopy = '';
    if (this.selectionAnchor) {
        textToCopy = this.getSelectedText();
        this.setStatusMessage('Selection copied!', 1000);
    } else {
        // Copy entire file content if nothing is selected (clean copy)
        textToCopy = this.lines.join('\n');
        this.setStatusMessage('Copied all text!', 1000);
    }
    await this.setClipboard(textToCopy);
}

/**
 * Handles synchronous call for cutting selection (used by Ctrl+X).
 */
async function cutSelection(this: CliEditor): Promise<void> {
    await this.cutSelectionAsync();
}

/**
 * Helper function to handle the final save and exit sequence (used by Ctrl+S).
 */
async function handleSave(this: CliEditor): Promise<void> {
    await this.saveFile(); // Save file (sets isDirty=false)
    
    // Only resolve if not already exiting 
    if (!this.isExiting) { 
        this.isExiting = true;
        this.resolvePromise?.({ saved: true, content: this.lines.join('\n') });
    }
}


/**
 * Handles Search Mode input keys.
 */
function handleSearchKeys(this: CliEditor, key: string): void {
    switch (key) {
        case KEYS.ENTER:
            this.executeSearch();
            this.mode = 'edit';
            this.findNext();
            break;
        case KEYS.ESCAPE:
        case KEYS.CTRL_C:
        case KEYS.CTRL_Q:
            this.mode = 'edit';
            this.searchQuery = '';
            this.setStatusMessage('Search cancelled');
            break;
        case KEYS.BACKSPACE:
            this.searchQuery = this.searchQuery.slice(0, -1);
            break;
        default:
            if (key.length === 1 && key >= ' ' && key <= '~') {
                this.searchQuery += key;
            }
    }
}


export const keyHandlingMethods: TKeyHandlingMethods = {
    handleKeypressEvent,
    handleEditKeys,
    handleSearchKeys,
    handleCtrlQ,
    handleCopy,
    handleCharacterKey,
    cutSelection,
    handleSave,
};