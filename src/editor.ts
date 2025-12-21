// src/editor.ts
import { promises as fs } from 'fs';
// Cập nhật 1: Import từ ./vendor/keypress.js
import keypress from './vendor/keypress.js'; 
import { ANSI, KEYS } from './constants.js';
import { HistoryManager } from './history.js';
import { DocumentState, VisualRow, EditorMode, EditorOptions } from './types.js';
import { SwapManager } from './editor.swap.js';

// --- LOCAL TS DECLARATION (FIX TS7016/TS2306) ---
// Cập nhật 2: Import type từ ./vendor/keypress.js
import type { KeypressEvent } from './vendor/keypress.js';

// Block `declare module 'keypress'` đã bị xóa

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

const DEFAULT_STATUS = 'HELP: Ctrl+S = Save | Ctrl+Q = Quit | Ctrl+W = Find | Ctrl+R = Replace | Ctrl+L = Go to Line';

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
  public tabSize: number = 4;
  public screenStartRow: number = 1;
  public visualRows: VisualRow[] = [];
  public mode: EditorMode = 'edit';
  public statusMessage: string = DEFAULT_STATUS;
  public statusTimeout: NodeJS.Timeout | null = null;
  public isMessageCustom: boolean = false;
  public quitConfirm: boolean = false;
  public readonly DEFAULT_STATUS = DEFAULT_STATUS;
  public searchQuery: string = '';
  public replaceQuery: string | null = null; // null = Find mode, string = Replace mode
  public goToLineQuery: string = ''; // For Go to Line prompt
  public searchResults: { y: number, x: number }[] = [];
  public searchResultIndex: number = -1;
  public history: HistoryManager;
  public swapManager: SwapManager;
  public isCleanedUp: boolean = false; 
  public resolvePromise: ((value: { saved: boolean; content: string }) => void) | null = null;
  public rejectPromise: ((reason?: any) => void) | null = null;
  public inputStream: any; // ReadableStream
  
  // State flag indicating the editor is in the process of closing (prevents input/render race)
  public isExiting: boolean = false;

  constructor(initialContent: string, filepath: string, options: EditorOptions = {}) {
    this.lines = initialContent.split('\n');
    if (this.lines.length === 0) {
      this.lines = [''];
    }
    this.filepath = filepath;
    this.gutterWidth = options.gutterWidth ?? 5;
    this.tabSize = options.tabSize ?? 4;
    this.inputStream = options.inputStream || process.stdin;
    this.history = new HistoryManager();
    this.saveState(true);
    
    // Initialize SwapManager
    this.swapManager = new SwapManager(this.filepath, () => this.lines.join('\n'));
  }

  // --- Lifecycle Methods ---
  
  public run(): Promise<{ saved: boolean; content: string }> {
    this.setupTerminal(); 
    this.render();
    this.swapManager.start();
    
    return new Promise((resolve, reject) => {
      
      const performCleanup = (callback?: () => void) => {
        this.swapManager.stop(); // Stop swap interval
        
        if (this.isCleanedUp) {
            if (callback) callback();
            return;
        }

        // 1. Remove listeners immediately
        this.inputStream.removeAllListeners('keypress');
        process.stdout.removeAllListeners('resize');
        
        // 2. (FIX GHOST TUI) Write exit sequence and use callback to ensure it's written 
        // before Node.js fully releases the TTY.
        process.stdout.write(
            ANSI.CLEAR_SCREEN + ANSI.MOVE_CURSOR_TOP_LEFT + ANSI.SHOW_CURSOR + ANSI.EXIT_ALTERNATE_SCREEN, 
            () => {
                // 3. Disable TTY raw mode and pause stdin after screen is cleared
                if (this.inputStream.setRawMode) {
                   this.inputStream.setRawMode(false);
                }
                this.inputStream.pause(); 
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
    // If we are using a custom inputStream (re-opened TTY), it might be a ReadStream which is TTY.
    // Check if it is TTY
    if (!this.inputStream.isTTY && !process.stdin.isTTY) {
       // If both are not TTY, we have a problem.
       // But if inputStream is our manually opened TTY, isTTY should be true.
    }
    
    if (!process.stdout.isTTY) {
      throw new Error('Editor requires a TTY environment (stdout).');
    }

    this.updateScreenSize();
    this.recalculateVisualRows();

    // Enter alternate screen and hide cursor
    process.stdout.write(ANSI.ENTER_ALTERNATE_SCREEN + ANSI.HIDE_CURSOR + ANSI.CLEAR_SCREEN);
    
    if (this.inputStream.setRawMode) {
        this.inputStream.setRawMode(true);
    }
    this.inputStream.resume();
    this.inputStream.setEncoding('utf-8');

    // Setup keypress listener
    keypress(this.inputStream);
    this.inputStream.on('keypress', this.handleKeypressEvent.bind(this)); 
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