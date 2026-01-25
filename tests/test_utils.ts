
import { CliEditor } from '../src/editor.js';
import { ScreenBuffer } from '../src/screen_buffer.js';

export class MockScreenBuffer {
    resize(rows: number, cols: number) {}
    clear() {}
    put(x: number, y: number, char: string, style: string = '') {}
    putString(x: number, y: number, text: string, style: string = '') {}
    flush() {}
}

export class MockEditor {
    lines: string[] = [''];
    cursorX: number = 0;
    cursorY: number = 0;
    selectionAnchor: { x: number, y: number } | null = null;
    rowOffset: number = 0;
    screenRows: number = 20;
    screenCols: number = 80;
    gutterWidth: number = 5;
    tabSize: number = 4;
    screenStartRow: number = 1;
    isDirty: boolean = false;
    screenBuffer: ScreenBuffer;
    searchResultMap: Map<number, Array<{ start: number; end: number }>> = new Map();
    history: any = { saveState: () => {}, undo: () => null, redo: () => null }; // Minimal history mock
    mode: string = 'edit';
    goToLineQuery: string = '';
    statusMessage: string = '';
    DEFAULT_STATUS: string = '';

    constructor() {
        this.screenBuffer = new MockScreenBuffer() as unknown as ScreenBuffer;
    }

    // Stubs
    setDirty() { this.isDirty = true; }
    saveState() {}
    render() {}
    scroll() {} 
    setStatusMessage(msg: string) { this.statusMessage = msg; }
    invalidateSyntaxCache() {}
    updateGutterWidth() {} // From rendering, might be needed if we don't mixin rendering
    
    // For renderingMethods
    getLineSyntaxColor(lineIndex: number, line: string) { return new Map(); }
    adjustCursorPosition() {} // Stub, or let mixin overwrite it
}

export function createMockEditor(mixins: any[]): CliEditor {
    const editor = new MockEditor();
    mixins.forEach(mixin => Object.assign(editor, mixin));
    return editor as unknown as CliEditor;
}
