
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockEditor } from './test_utils.js';
import { selectionMethods } from '../src/editor.selection.js';
import { CliEditor } from '../src/editor.js';

describe('Editor Selection', () => {
    let editor: CliEditor;

    beforeEach(() => {
        editor = createMockEditor([selectionMethods]);
        editor.lines = ['Line 1', 'Line 2', 'Line 3'];
        editor.cursorX = 0;
        editor.cursorY = 0;
    });

    it('should start selection', () => {
        editor.cursorX = 2;
        editor.cursorY = 0;
        editor.startOrUpdateSelection();
        
        expect(editor.selectionAnchor).toEqual({ x: 2, y: 0 });
    });

    it('should not update anchor if already set', () => {
        editor.startOrUpdateSelection(); // Set anchor at 0,0
        
        editor.cursorX = 5;
        editor.startOrUpdateSelection();
        
        expect(editor.selectionAnchor).toEqual({ x: 0, y: 0 });
    });

    it('should cancel selection', () => {
        editor.startOrUpdateSelection();
        expect(editor.selectionAnchor).not.toBeNull();
        
        editor.cancelSelection();
        expect(editor.selectionAnchor).toBeNull();
    });

    describe('getNormalizedSelection', () => {
        it('should return null if no selection', () => {
            expect(editor.getNormalizedSelection()).toBeNull();
        });

        it('should return range with start before end (same line)', () => {
            editor.cursorX = 2;
            editor.startOrUpdateSelection(); // Anchor at 2,0
            
            editor.cursorX = 5;
            // Current at 5,0
            
            const range = editor.getNormalizedSelection();
            expect(range).toEqual({
                start: { x: 2, y: 0 },
                end: { x: 5, y: 0 }
            });
        });

        it('should return normalized range when cursor is before anchor (same line)', () => {
            editor.cursorX = 5;
            editor.startOrUpdateSelection(); // Anchor at 5,0
            
            editor.cursorX = 2;
            // Current at 2,0
            
            const range = editor.getNormalizedSelection();
            expect(range).toEqual({
                start: { x: 2, y: 0 },
                end: { x: 5, y: 0 }
            });
        });

        it('should return normalized range (multi-line)', () => {
            editor.cursorY = 2;
            editor.cursorX = 1;
            editor.startOrUpdateSelection(); // Anchor at 1,2
            
            editor.cursorY = 0;
            editor.cursorX = 3;
            // Current at 3,0
            
            const range = editor.getNormalizedSelection();
            expect(range).toEqual({
                start: { x: 3, y: 0 },
                end: { x: 1, y: 2 }
            });
        });
    });

    describe('isPositionInSelection', () => {
        beforeEach(() => {
            // Select from Line 1 (x=2) to Line 2 (x=3)
            // Line 1: 'Line 1' (length 6)
            // Line 2: 'Line 2' (length 6)
            editor.cursorY = 0;
            editor.cursorX = 2;
            editor.startOrUpdateSelection();
            
            editor.cursorY = 1;
            editor.cursorX = 3;
        });

        it('should identify positions inside selection', () => {
            const range = editor.getNormalizedSelection()!;
            
            // On start line, after start x
            expect(editor.isPositionInSelection(0, 3, range)).toBe(true);
            
            // On end line, before end x
            expect(editor.isPositionInSelection(1, 2, range)).toBe(true);
        });

        it('should identify positions outside selection', () => {
            const range = editor.getNormalizedSelection()!;
            
            // On start line, before start x
            expect(editor.isPositionInSelection(0, 1, range)).toBe(false);
            
            // On end line, after end x (inclusive check? check logic)
            // Logic: if (logicalY === range.end.y && logicalX >= range.end.x) return false;
            expect(editor.isPositionInSelection(1, 3, range)).toBe(false);
            expect(editor.isPositionInSelection(1, 4, range)).toBe(false);
            
            // Outside lines
            expect(editor.isPositionInSelection(2, 0, range)).toBe(false);
        });
    });

    describe('getSelectedText', () => {
        it('should get text for single line selection', () => {
            // 'Line 1'
            editor.cursorX = 1;
            editor.startOrUpdateSelection();
            editor.cursorX = 4;
            // Select 'ine'
            
            expect(editor.getSelectedText()).toBe('ine');
        });

        it('should get text for multi-line selection', () => {
            // 'Line 1'
            // 'Line 2'
            editor.cursorY = 0;
            editor.cursorX = 5; // '1'
            editor.startOrUpdateSelection();
            
            editor.cursorY = 1;
            editor.cursorX = 4; // 'Line'
            
            // Select '1\nLine'
            expect(editor.getSelectedText()).toBe('1\nLine');
        });
    });

    describe('deleteSelectedText', () => {
        it('should delete selected text and join lines', () => {
            // 'Line 1'
            // 'Line 2'
            // 'Line 3'
            
            editor.cursorY = 0;
            editor.cursorX = 5; // Start at '1'
            editor.startOrUpdateSelection();
            
            editor.cursorY = 1;
            editor.cursorX = 4; // End before ' 2'
            // Selection: '1\nLine'
            
            const deleted = editor.deleteSelectedText();
            expect(deleted).toBe(true);
            
            // Expected: 'Line  2' (space from Line 2 remains)
            // 'Line 3'
            expect(editor.lines[0]).toBe('Line  2');
            expect(editor.lines[1]).toBe('Line 3');
            expect(editor.lines.length).toBe(2);
            
            // Cursor should be at start of deleted section (0, 5)
            expect(editor.cursorY).toBe(0);
            expect(editor.cursorX).toBe(5);
            expect(editor.selectionAnchor).toBeNull();
            expect(editor.isDirty).toBe(true);
        });
    });
});
