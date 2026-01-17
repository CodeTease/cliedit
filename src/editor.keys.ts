// src/editor.keys.ts

import { CliEditor } from './editor.js';
import { KEYS } from './constants.js';

const PAIR_MAP: Record<string, string> = {
    '(': ')',
    '[': ']',
    '{': '}',
    "'": "'",
    '"': '"',
};
import type { KeypressEvent } from './vendor/keypress.js';

// (FIX TS2339 & TS2724) Export all function types for merging
export type TKeyHandlingMethods = {
    handleKeypressEvent: (ch: string, key: KeypressEvent) => void;
    handleEditKeys: (key: string) => boolean;
    handleSearchKeys: (key: string) => void;
    handleSearchConfirmKeys: (key: string) => void;
    handleGoToLineKeys: (key: string) => void;
    handleCtrlQ: () => void;
    handleCopy: () => Promise<void>;
    handleCharacterKey: (ch: string) => void;
    cutSelection: () => Promise<void>; 
    handleSave: () => Promise<void>; 
    handleAltArrows: (keyName: string) => void;
};

/**
 * Main router for standardized keypress events from the 'keypress' library.
 */
function handleKeypressEvent(this: CliEditor, ch: string, key: KeypressEvent): void {
    // CRASH FIX: If the editor is already closing, ignore all input.
    if (this.isExiting) {
        return;
    }
    
    let keyName: string | undefined = undefined;
    let edited = false; 

    // --- 1. Xử lý trường hợp key là null/undefined (Ký tự in được) ---
    if (!key) {
        if (ch && ch.length === 1 && ch >= ' ' && ch <= '~') {
            if (this.mode === 'search_find' || this.mode === 'search_replace') {
                this.handleSearchKeys(ch);
            } else if (this.mode === 'goto_line') {
                this.handleGoToLineKeys(ch);
            } else if (this.mode === 'edit') {
                edited = this.handleEditKeys(ch);
                if (edited) {
                    this.saveState(); 
                    this.recalculateVisualRows(); // Phải tính toán lại sau khi gõ
                }
            } else if (this.mode === 'search_confirm') {
                this.handleSearchConfirmKeys(ch);
            }
            this.render();
            return;
        }
        return; 
    }
    
    // --- 2. Từ đây, 'key' object là đảm bảo có (phím đặc biệt hoặc Ctrl/Meta) ---

    // 2.1. Ánh xạ Control sequences (Ctrl+Arrow cho selection)
    if (key.ctrl) {
        if (key.name === 'up') keyName = KEYS.CTRL_ARROW_UP;
        else if (key.name === 'down') keyName = KEYS.CTRL_ARROW_DOWN;
        else if (key.name === 'left') keyName = KEYS.CTRL_ARROW_LEFT;
        else if (key.name === 'right') keyName = KEYS.CTRL_ARROW_RIGHT;
        else keyName = key.sequence; 
    } else {
        // 2.2. Ánh xạ phím tiêu chuẩn (Arrow, Home, End, Enter, Tab)
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
        else if (key.name === 'tab') keyName = key.shift ? KEYS.SHIFT_TAB : KEYS.TAB;
        else if (key.meta && key.name === 'left') keyName = 'ALT_LEFT';
        else if (key.meta && key.name === 'right') keyName = 'ALT_RIGHT';
        else if (key.meta && key.name === 'up') keyName = KEYS.ALT_UP;
        else if (key.meta && key.name === 'down') keyName = KEYS.ALT_DOWN;
        // Handle Mouse Scroll events explicitly
        else if (key.name === 'scrollup') keyName = 'SCROLL_UP';
        else if (key.name === 'scrolldown') keyName = 'SCROLL_DOWN';
        else keyName = key.sequence; 
    }

    // --- 3. Định tuyến theo Mode ---
    if (this.mode === 'search_find' || this.mode === 'search_replace') {
        this.handleSearchKeys(keyName || ch);
    } else if (this.mode === 'search_confirm') {
        this.handleSearchConfirmKeys(keyName || ch);
    } else if (this.mode === 'goto_line') {
        this.handleGoToLineKeys(keyName || ch);
    } else {
        // 4. Xử lý phím lựa chọn (Ctrl+Arrow) - Navigation
        switch (keyName) {
            case KEYS.CTRL_ARROW_UP:
            case KEYS.CTRL_ARROW_DOWN:
            case KEYS.CTRL_ARROW_LEFT:
            case KEYS.CTRL_ARROW_RIGHT:
                this.startOrUpdateSelection();
                if (keyName === KEYS.CTRL_ARROW_UP) this.moveCursorVisually(-1);
                else if (keyName === KEYS.CTRL_ARROW_DOWN) this.moveCursorVisually(1);
                else if (keyName === KEYS.CTRL_ARROW_LEFT) this.moveCursorLogically(-1);
                else if (keyName === KEYS.CTRL_ARROW_RIGHT) this.moveCursorLogically(1);
                this.render();
                return;
        }

        // 5. Xử lý tất cả các phím lệnh/chỉnh sửa khác
        if (keyName === 'SCROLL_UP') {
            const scrollAmount = 3;
            this.rowOffset = Math.max(0, this.rowOffset - scrollAmount);
            
            // Adjust cursor if it falls out of view (below the viewport)
            // Actually if we scroll UP, the viewport moves UP. The cursor might be BELOW the viewport.
            // Wait, scroll UP means viewing lines ABOVE. Viewport index decreases.
            // Cursor (if previously in view) might now be >= rowOffset + screenRows.
            
            // We need to ensure cursor is within [rowOffset, rowOffset + screenRows - 1]
            // But verify after setting rowOffset.
            const currentVisualRow = this.findCurrentVisualRowIndex();
            const bottomEdge = this.rowOffset + this.screenRows - 1;
            
            if (currentVisualRow > bottomEdge) {
                 const targetRow = this.visualRows[bottomEdge];
                 this.cursorY = targetRow.logicalY;
                 this.cursorX = targetRow.logicalXStart;
            } else if (currentVisualRow < this.rowOffset) {
                 // Should not happen when scrolling up (moving viewport up), unless cursor was already above?
                 // If we scroll up, rowOffset decreases. Current row stays same. 
                 // So current row > new rowOffset.
                 // It might be > bottomEdge.
            }
            // However, to be safe against 'scroll' method resetting it:
            // The 'scroll' method checks:
            // if (currentVisualRow < this.rowOffset) -> this.rowOffset = currentVisualRow
            // if (currentVisualRow >= this.rowOffset + this.screenRows) -> this.rowOffset = ...
            
            // So we MUST move cursor inside the new viewport.
            
            if (currentVisualRow > bottomEdge) {
                const targetRow = this.visualRows[bottomEdge];
                this.cursorY = targetRow.logicalY;
                this.cursorX = targetRow.logicalXStart;
            }

        } else if (keyName === 'SCROLL_DOWN') {
            const scrollAmount = 3;
            const maxOffset = Math.max(0, this.visualRows.length - this.screenRows);
            this.rowOffset = Math.min(maxOffset, this.rowOffset + scrollAmount);
            
            // Scroll DOWN means viewport index increases.
            // Cursor might be ABOVE the new viewport (currentVisualRow < rowOffset).
            const currentVisualRow = this.findCurrentVisualRowIndex();
            
            if (currentVisualRow < this.rowOffset) {
                const targetRow = this.visualRows[this.rowOffset];
                this.cursorY = targetRow.logicalY;
                this.cursorX = targetRow.logicalXStart;
            }
        } else {
            edited = this.handleEditKeys(keyName || ch);
        }
    }

    // 6. Cập nhật Trạng thái và Render
    if (edited) {
        this.saveState(); // <-- Chỉ gọi khi gõ phím, xóa, v.v.
        this.recalculateVisualRows(); // Tính toán lại layout
    }

    if (!this.isExiting) {
        this.render(); // Render cuối cùng (với visual rows đã được cập nhật nếu cần)
    }
}

function handleAltArrows(this: CliEditor, keyName: string): void {
     this.clearSearchResults(); // Clear highlights on smart navigation
     if (keyName === 'ALT_LEFT') this.moveCursorByWord('left');
     else if (keyName === 'ALT_RIGHT') this.moveCursorByWord('right');
}

/**
 * Handles all command keys in 'edit' mode.
 * Returns true if content was modified.
 */
function handleEditKeys(this: CliEditor, key: string): boolean {
    // Cancel selection on normal navigation
    const isNavigation = [
        KEYS.ARROW_UP, KEYS.ARROW_DOWN, KEYS.ARROW_LEFT, KEYS.ARROW_RIGHT,
        KEYS.HOME, KEYS.END, KEYS.PAGE_UP, KEYS.PAGE_DOWN
    ].includes(key);

    if (isNavigation) {
        this.cancelSelection();
        this.clearSearchResults(); // Clear highlights on navigation
        if (this.isMessageCustom) {
            this.setStatusMessage(this.DEFAULT_STATUS, 0);
        }
    }
    
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
        
        // --- Navigation (Non-Selection) ---
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
            this.clearSearchResults();
            this.insertNewLine();
            return true;
        case KEYS.BACKSPACE:
            this.clearSearchResults();
            // Handle auto-pair deletion
            const line = this.lines[this.cursorY] || '';
            const charBefore = line[this.cursorX - 1];
            const charAfter = line[this.cursorX];
            if (
                !this.selectionAnchor &&
                charBefore && charAfter &&
                PAIR_MAP[charBefore] === charAfter
            ) {
                // Delete both characters of the pair
                this.lines[this.cursorY] = line.slice(0, this.cursorX - 1) + line.slice(this.cursorX + 1);
                this.cursorX--; // Move cursor back
                this.setDirty();
            } else {
                if (this.selectionAnchor) this.deleteSelectedText();
                else this.deleteBackward();
            }
            return true;
        case KEYS.DELETE:
            this.clearSearchResults();
            if (this.selectionAnchor) this.deleteSelectedText();
            else this.deleteForward();
            return true;
        case KEYS.TAB:
            this.clearSearchResults();
            if (this.selectionAnchor) {
                this.indentSelection();
                return false; // Manually saved state
            } else {
                this.insertSoftTab();
                return true;
            }
        case KEYS.SHIFT_TAB:
            this.clearSearchResults();
            this.outdentSelection();
            return false; // Manually saved state
        case KEYS.ALT_UP:
            this.clearSearchResults();
            this.moveLines(-1);
            return false; // Manually saved state
        case KEYS.ALT_DOWN:
            this.clearSearchResults();
            this.moveLines(1);
            return false; // Manually saved state
        case KEYS.CTRL_D:
            this.clearSearchResults();
            this.duplicateLineOrSelection();
            return false; // Manually saved state

        // --- Search & History ---
        case KEYS.CTRL_W:
            this.enterFindMode();
            return false;
        case KEYS.CTRL_R:
            this.enterReplaceMode();
            return false;
        case KEYS.CTRL_L:
            this.enterGoToLineMode();
            return false;
        case KEYS.CTRL_G:
            this.findNext();
            return false;
        
        // --- Smart Navigation ---
        case 'ALT_LEFT':
            this.moveCursorByWord('left');
            return false;
        case 'ALT_RIGHT':
            this.moveCursorByWord('right');
            return false;
        case KEYS.CTRL_M: // Or any key for Bracket Match. Ctrl+M is technically Enter in some terms but if available...
            // Let's use Ctrl+B (Bracket) if not taken? Ctrl+B is often bold, but here it's CLI.
            // Or just check if key is match bracket key.
            // Let's try to map a specific key or use Meta.
            // For now, let's use Ctrl+B?
            this.matchBracket();
            return false;
            
        // ***** SỬA LỖI VISUAL *****
        // Sau khi undo/redo, chúng ta PHẢI tính toán lại visual rows
        case KEYS.CTRL_Z:
            this.undo();
            this.recalculateVisualRows(); // <-- THÊM DÒNG NÀY
            return false; 
        case KEYS.CTRL_Y:
            this.redo();
            this.recalculateVisualRows(); // <-- THÊM DÒNG NÀY
            return false; 

        // --- Clipboard ---
        case KEYS.CTRL_K: // Cut Line (Traditional)
            this.cutLine();
            return true;
        case KEYS.CTRL_U: // Paste Line (Traditional)
            this.pasteLine();
            return true;
        case KEYS.CTRL_X: // Cut Selection
            this.cutSelection(); 
            return true;
        case KEYS.CTRL_V: // Paste Selection
            this.pasteSelection();
            return true;

        // Xử lý Ký tự in được
        default:
            if (key.length === 1 && key >= ' ' && key <= '~') {
                this.clearSearchResults();
                this.handleCharacterKey(key);
                return true; 
            }
            return false; 
    }
}

/**
 * Handles insertion of a character, deleting selection first if it exists.
 */
function handleCharacterKey(this: CliEditor, ch: string): void {
    const line = this.lines[this.cursorY] || '';
    const charAfter = line[this.cursorX];

    // If user types a closing character and it's what we expect, just move the cursor.
    if (
        !this.selectionAnchor &&
        (ch === ')' || ch === ']' || ch === '}' || ch === "'" || ch === '"') &&
        charAfter === ch
    ) {
        this.cursorX++;
        return;
    }

    const closeChar = PAIR_MAP[ch];
    if (closeChar) {
        this.handleAutoPair(ch, closeChar);
    } else {
        if (this.selectionAnchor) {
            this.deleteSelectedText();
        }
        this.insertCharacter(ch);
        this.setDirty();
    }
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
 * Handles Search Mode input keys (for 'search_find' and 'search_replace').
 */
function handleSearchKeys(this: CliEditor, key: string): void {
    const cancelSearch = () => {
        this.mode = 'edit';
        this.searchQuery = '';
        this.replaceQuery = null;
        this.searchResults = [];
        this.searchResultIndex = -1;
        this.setStatusMessage('Cancelled');
    };

    switch (key) {
        case KEYS.ENTER:
            if (this.mode === 'search_find') {
                if (this.replaceQuery === null) { 
                    // Find-Only Flow: Execute search and find first
                    this.executeSearch();
                    this.mode = 'edit';
                    this.findNext();
                } else { 
                    // Replace Flow: Transition to get replace string
                    this.mode = 'search_replace';
                    this.setStatusMessage('Replace with: ');
                }
            } else if (this.mode === 'search_replace') {
                // Replace Flow: We have both strings, execute and find first
                this.executeSearch();
                this.mode = 'edit';
                this.findNext();
            }
            break;
        case KEYS.ESCAPE:
        case KEYS.CTRL_C:
        case KEYS.CTRL_Q:
            cancelSearch();
            break;
        case KEYS.BACKSPACE:
            if (this.mode === 'search_find') {
                this.searchQuery = this.searchQuery.slice(0, -1);
            } else {
                this.replaceQuery = this.replaceQuery!.slice(0, -1);
            }
            break;
        default:
            if (key.length === 1 && key >= ' ' && key <= '~') {
                if (this.mode === 'search_find') {
                    this.searchQuery += key;
                } else {
                    this.replaceQuery += key;
                }
            }
    }
    
    // Update status bar message live (if not cancelling)
    if (this.mode === 'search_find') {
        this.setStatusMessage((this.replaceQuery === null ? 'Find: ' : 'Find: ') + this.searchQuery);
    } else if (this.mode === 'search_replace') {
        this.setStatusMessage('Replace with: ' + this.replaceQuery);
    }
}

/**
 * Handles keypresses during the (y/n/a/q) confirmation step.
 */
function handleSearchConfirmKeys(this: CliEditor, key: string): void {
    switch (key.toLowerCase()) {
        case 'y': // Yes
            this.replaceCurrentAndFindNext();
            break;
        case 'n': // No
            this.findNext();
            break;
        case 'a': // All
            this.replaceAll();
            break;
        case 'q': // Quit
        case KEYS.ESCAPE:
        case KEYS.CTRL_C:
        case KEYS.CTRL_Q:
            this.mode = 'edit';
            this.searchResults = [];
            this.searchResultIndex = -1;
            this.setStatusMessage('Replace cancelled');
            break;
    }
}

/**
 * Handles keypresses during the 'Go to Line' prompt.
 */
function handleGoToLineKeys(this: CliEditor, key: string): void {
    const cancel = () => {
        this.mode = 'edit';
        this.goToLineQuery = '';
        this.setStatusMessage('Cancelled');
    };

    switch (key) {
        case KEYS.ENTER:
            const lineNumber = parseInt(this.goToLineQuery, 10);
            if (!isNaN(lineNumber) && lineNumber > 0) {
                this.jumpToLine(lineNumber);
            } else {
                this.mode = 'edit';
                this.setStatusMessage('Invalid line number');
            }
            this.goToLineQuery = '';
            break;
        case KEYS.ESCAPE:
        case KEYS.CTRL_C:
        case KEYS.CTRL_Q:
            cancel();
            break;
        case KEYS.BACKSPACE:
            this.goToLineQuery = this.goToLineQuery.slice(0, -1);
            this.setStatusMessage('Go to Line: ' + this.goToLineQuery);
            break;
        default:
            // Only accept digits
            if (key.length === 1 && key >= '0' && key <= '9') {
                this.goToLineQuery += key;
                this.setStatusMessage('Go to Line: ' + this.goToLineQuery);
            }
    }
}


export const keyHandlingMethods: TKeyHandlingMethods = {
    handleKeypressEvent,
    handleEditKeys,
    handleSearchKeys,
    handleSearchConfirmKeys,
    handleGoToLineKeys,
    handleCtrlQ,
    handleCopy,
    handleCharacterKey,
    cutSelection,
    handleSave,
    handleAltArrows,
};