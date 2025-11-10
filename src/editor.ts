// src/editor.ts
import { promises as fs } from 'fs';
import keypress from 'keypress'; 
import { ANSI, KEYS } from './constants.js';
import { HistoryManager } from './history.js';
import { DocumentState, VisualRow, EditorMode } from './types.js';

// --- LOCAL TS DECLARATION (FIX TS7016/TS2306) ---
// Declaring the keypress module here solves implicit any type errors
declare module 'keypress' {
    export interface KeypressEvent {
        name?: string;
        ctrl: boolean;
        meta: boolean;
        shift: boolean;
        sequence: string;
    }
}
import type { KeypressEvent } from 'keypress';

// Import all functional modules
import { editingMethods } from './editor.editing.js';
import { clipboardMethods } from './editor.clipboard.js';
import { navigationMethods } from './editor.navigation.js';
import { renderingMethods } from './editor.rendering.js';
import { searchMethods } from './editor.search.js';
import { historyMethods } from './editor.history.js';
import { ioMethods } from './editor.io.js';
import { keyHandlingMethods, TKeyHandlingMethods } from './editor.keys.js'; 
import { selectionMethods, TSelectionMethods, NormalizedRange } from './editor.selection.js'; 

// --- Interface Merging (For TypeScript) ---
type TEditingMethods = typeof editingMethods;
type TClipboardMethods = typeof clipboardMethods;
type TNavigationMethods = typeof navigationMethods;
type TRenderingMethods = typeof renderingMethods;
type TSearchMethods = typeof searchMethods;
type THistoryMethods = typeof historyMethods;
type TIOMethods = typeof ioMethods;

export interface CliEditor extends 
  TEditingMethods,
  TClipboardMethods,
  TNavigationMethods,
  TRenderingMethods,
  TSearchMethods,
  THistoryMethods,
  TIOMethods,
  TKeyHandlingMethods,
  TSelectionMethods {}

const DEFAULT_STATUS = 'HELP: Ctrl+S = Save & Quit | Ctrl+Q = Quit | Ctrl+C = Copy All | Ctrl+Arrow = Select';

/**
 * Main editor class managing application state, TTY interaction, and rendering.
 */
export class CliEditor {
  // --- State Properties ---
  public lines: string[];
  public filepath: string;
  public isDirty: boolean = false;
  public cursorX: number = 0;
  public cursorY: number = 0;
  public selectionAnchor: { x: number, y: number } | null = null;
  public rowOffset: number = 0;
  public screenRows: number = 0;
  public screenCols: number = 0;
  public gutterWidth: number = 5;
  public screenStartRow: number = 1;
  public visualRows: VisualRow[] = [];
  public mode: EditorMode = 'edit';
  public statusMessage: string = DEFAULT_STATUS;
  public statusTimeout: NodeJS.Timeout | null = null;
  public isMessageCustom: boolean = false;
  public quitConfirm: boolean = false;
  public readonly DEFAULT_STATUS = DEFAULT_STATUS;
  public searchQuery: string = '';
  public searchResults: { y: number, x: number }[] = [];
  public searchResultIndex: number = -1;
  public history: HistoryManager;
  public isCleanedUp: boolean = false; 
  public resolvePromise: ((value: { saved: boolean; content: string }) => void) | null = null;
  public rejectPromise: ((reason?: any) => void) | null = null;
  
  // State flag indicating the editor is in the process of closing (prevents input/render race)
  public isExiting: boolean = false;

  constructor(initialContent: string, filepath: string) {
    this.lines = initialContent.split('\n');
    if (this.lines.length === 0) {
      this.lines = [''];
    }
    this.filepath = filepath;
    this.history = new HistoryManager();
    this.saveState(true);
  }

  // --- Lifecycle Methods ---
  
  public run(): Promise<{ saved: boolean; content: string }> {
    this.setupTerminal(); 
    this.render();
    
    return new Promise((resolve, reject) => {
      
      const performCleanup = (callback?: () => void) => {
        if (this.isCleanedUp) {
            if (callback) callback();
            return;
        }

        // 1. Remove listeners immediately
        process.stdin.removeAllListeners('keypress');
        process.stdout.removeAllListeners('resize');
        
        // 2. (FIX GHOST TUI) Write exit sequence and use callback to ensure it's written 
        // before Node.js fully releases the TTY.
        process.stdout.write(
            ANSI.CLEAR_SCREEN + ANSI.MOVE_CURSOR_TOP_LEFT + ANSI.SHOW_CURSOR + ANSI.EXIT_ALTERNATE_SCREEN, 
            () => {
                // 3. Disable TTY raw mode and pause stdin after screen is cleared
                process.stdin.setRawMode(false);
                process.stdin.pause(); 
                this.isCleanedUp = true;
                if (callback) callback();
            }
        );
      };

      this.resolvePromise = (value) => {
        performCleanup(() => resolve(value));
      };
      
      this.rejectPromise = (reason) => {
        performCleanup(() => reject(reason));
      };
    });
  }

  private setupTerminal(): void {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      throw new Error('Editor requires a TTY environment.');
    }

    this.updateScreenSize();
    this.recalculateVisualRows();

    // Enter alternate screen and hide cursor
    process.stdout.write(ANSI.ENTER_ALTERNATE_SCREEN + ANSI.HIDE_CURSOR + ANSI.CLEAR_SCREEN);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf-8');

    // Setup keypress listener
    keypress(process.stdin);
    process.stdin.on('keypress', this.handleKeypressEvent.bind(this)); 
    process.stdout.on('resize', this.handleResize.bind(this));
  }

  private handleResize(this: CliEditor): void {
    this.updateScreenSize();
    this.recalculateVisualRows();
    this.render();
  }

  private updateScreenSize(this: CliEditor): void {
    this.screenRows = process.stdout.rows - 2; 
    this.screenCols = process.stdout.columns;
    this.screenStartRow = 1; 
  }
}


// --- "Mixin" magic: Assigning all methods to the prototype ---

Object.assign(CliEditor.prototype, editingMethods);
Object.assign(CliEditor.prototype, clipboardMethods);
Object.assign(CliEditor.prototype, navigationMethods);
Object.assign(CliEditor.prototype, renderingMethods);
Object.assign(CliEditor.prototype, searchMethods);
Object.assign(CliEditor.prototype, historyMethods);
Object.assign(CliEditor.prototype, ioMethods);
Object.assign(CliEditor.prototype, keyHandlingMethods);
Object.assign(CliEditor.prototype, selectionMethods);