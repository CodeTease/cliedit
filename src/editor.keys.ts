// src/editor.keys.ts

import { CliEditor } from './editor.js';
import { KEYS } from './constants.js';
import type { KeypressEvent } from './vendor/keypress.js';

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
    
    let keyName: string | undefined = undefined;
    let edited = false; 

    // --- 1. Xử lý trường hợp key là null/undefined (Ký tự in được) ---
    if (!key) {
        if (ch && ch.length === 1 && ch >= ' ' && ch <= '~') {
            edited = this.handleEditKeys(ch);
            if (edited) {
                this.saveState(); 
                this.recalculateVisualRows(); // Phải tính toán lại sau khi gõ
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
        else if (key.name === 'tab') keyName = KEYS.TAB;
        else keyName = key.sequence; 
    }

    // --- 3. Định tuyến theo Mode ---
    if (this.mode === 'search') {
        this.handleSearchKeys(keyName || ch);
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
        edited = this.handleEditKeys(keyName || ch);
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