// src/editor.ts
/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */

import keypress from './vendor/keypress.js'; 
import { ANSI } from './constants.js';
import { HistoryManager } from './history.js';
import { EditorMode, EditorOptions } from './types.js';
import { SwapManager } from './editor.swap.js';
import { ScreenBuffer } from './screen_buffer.js';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import all functional modules
import { editingMethods } from './editor.editing.js';
import { clipboardMethods } from './editor.clipboard.js';
import { navigationMethods } from './editor.navigation.js';
import { renderingMethods } from './editor.rendering.js';
import { searchMethods } from './editor.search.js';
import { historyMethods } from './editor.history.js';
import { ioMethods } from './editor.io.js';
import { keyHandlingMethods, TKeyHandlingMethods } from './editor.keys.js'; 
import { selectionMethods, TSelectionMethods } from './editor.selection.js'; 
import { syntaxMethods } from './editor.syntax.js';

// --- Interface Merging (For TypeScript) ---
type TEditingMethods = typeof editingMethods;
type TClipboardMethods = typeof clipboardMethods;
type TNavigationMethods = typeof navigationMethods;
type TRenderingMethods = typeof renderingMethods;
type TSearchMethods = typeof searchMethods;
type THistoryMethods = typeof historyMethods;
type TIOMethods = typeof ioMethods;
type TSyntaxMethods = typeof syntaxMethods;

export interface CliEditor extends 
  TEditingMethods,
  TClipboardMethods,
  TNavigationMethods,
  TRenderingMethods,
  TSearchMethods,
  THistoryMethods,
  TIOMethods,
  TKeyHandlingMethods,
  TSelectionMethods,
  TSyntaxMethods {}

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
  // Map<lineNumber, Array<{ start, end }>> for fast rendering lookup
  public searchResultMap: Map<number, Array<{ start: number; end: number }>> = new Map();
  public searchResultIndex: number = -1;
  public syntaxCache: Map<number, Map<number, string>> = new Map();
  public syntaxWorker: Worker | null = null;
  public history: HistoryManager;
  public swapManager: SwapManager;
  public screenBuffer: ScreenBuffer;
  public isCleanedUp: boolean = false; 
  public resolvePromise: ((value: { saved: boolean; content: string }) => void) | null = null;
  public rejectPromise: ((reason?: unknown) => void) | null = null;
  public inputStream: NodeJS.ReadStream; // ReadableStream
  
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
    this.screenBuffer = new ScreenBuffer();
    this.saveState(true);
    
    // Initialize SwapManager
    this.swapManager = new SwapManager(this.filepath, () => this.lines.join('\n'));
    
    // Initialize Worker
    try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        // Assuming compiled code is in dist/ and syntax.worker.js is there.
        const workerPath = join(__dirname, 'syntax.worker.js');
        this.syntaxWorker = new Worker(workerPath);
        this.syntaxWorker.on('message', this.handleWorkerMessage.bind(this));
    } catch {
        // Fallback or log error
        // console.error("Failed to load worker", e);
    }
  }

  private handleWorkerMessage(msg: { lineIndex: number; colorMap: Map<number, string> }): void {
      const { lineIndex, colorMap } = msg;
      this.syntaxCache.set(lineIndex, colorMap);
      
      // Trigger Partial Render?
      // For simplicity, just render. The screen buffer diffing handles optimization.
      // But we only need to render IF the line is currently visible?
      // Checking visibility is optimization.
      // Let's just render.
      if (!this.isCleanedUp) {
          this.render();
      }
  }

  // --- Lifecycle Methods ---
  
  public run(): Promise<{ saved: boolean; content: string }> {
    this.setupTerminal(); 
    this.render();
    this.swapManager.start();
    
    return new Promise((resolve, reject) => {
      
      const performCleanup = (callback?: () => void) => {
        this.swapManager.stop(); // Stop swap interval
        this.syntaxWorker?.terminate();

        if (this.isCleanedUp) {
            if (callback) callback();
            return;
        }

        // 1. Remove listeners immediately
        this.inputStream.removeAllListeners('keypress');
        process.stdout.removeAllListeners('resize');
        
        // 2. (FIX GHOST TUI) Write exit sequence and use callback to ensure it's written 
        // before Node.js fully releases the TTY.
        // Disable mouse tracking (1000 and 1006)
        process.stdout.write(
            ANSI.CLEAR_SCREEN + ANSI.MOVE_CURSOR_TOP_LEFT + ANSI.SHOW_CURSOR + ANSI.EXIT_ALTERNATE_SCREEN + '\x1b[?1000l' + '\x1b[?1006l', 
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
    this.screenBuffer.resize(this.screenRows + 2, this.screenCols); // +2 for Status Bar space if needed? 
    // screenRows = stdout.rows - 2. 
    // ScreenBuffer should cover the FULL terminal size (rows, cols) to handle status bar rendering too.
    // So pass process.stdout.rows.
    this.screenBuffer.resize(process.stdout.rows, process.stdout.columns);

    // Enter alternate screen and hide cursor + Enable SGR Mouse (1006) and Button Event (1000)
    process.stdout.write(ANSI.ENTER_ALTERNATE_SCREEN + ANSI.HIDE_CURSOR + ANSI.CLEAR_SCREEN + '\x1b[?1000h' + '\x1b[?1006h');
    
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
    this.screenBuffer.resize(process.stdout.rows, process.stdout.columns);
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
Object.assign(CliEditor.prototype, syntaxMethods);