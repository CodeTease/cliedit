
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockEditor } from './test_utils.js';
import { navigationMethods } from '../src/editor.navigation.js';
import { renderingMethods } from '../src/editor.rendering.js';
import { CliEditor } from '../src/editor.js';

describe('Editor Navigation', () => {
    let editor: CliEditor;

    beforeEach(() => {
        editor = createMockEditor([navigationMethods, renderingMethods]);
        editor.lines = ['Line 1', 'Line 2', 'Line 3'];
        editor.screenCols = 10; // Small width to force wrapping if needed
        editor.gutterWidth = 2; // Effective content width = 8
        editor.cursorX = 0;
        editor.cursorY = 0;
        editor.rowOffset = 0;
        editor.screenRows = 5;
    });

    describe('moveCursorLogically', () => {
        it('should move right within line', () => {
            editor.moveCursorLogically(1);
            expect(editor.cursorX).toBe(1);
            expect(editor.cursorY).toBe(0);
        });

        it('should wrap to next line when moving right at end of line', () => {
            editor.cursorX = 6; // 'Line 1' length is 6.
            editor.moveCursorLogically(1);
            expect(editor.cursorX).toBe(0);
            expect(editor.cursorY).toBe(1);
        });

        it('should move left within line', () => {
            editor.cursorX = 1;
            editor.moveCursorLogically(-1);
            expect(editor.cursorX).toBe(0);
        });

        it('should wrap to previous line when moving left at start of line', () => {
            editor.cursorY = 1;
            editor.cursorX = 0;
            editor.moveCursorLogically(-1);
            expect(editor.cursorY).toBe(0);
            expect(editor.cursorX).toBe(6); // 'Line 1' length
        });
    });

    describe('moveCursorVisually', () => {
        // Content Width = 10 - 2 = 8.
        // Line 1: 'Line 1' (6 chars) -> 1 visual row.
        // Line 2: 'Line 2' (6 chars) -> 1 visual row.
        
        it('should move down visually', () => {
            editor.moveCursorVisually(1);
            expect(editor.cursorY).toBe(1);
            expect(editor.cursorX).toBe(0);
        });

        it('should move up visually', () => {
            editor.cursorY = 1;
            editor.moveCursorVisually(-1);
            expect(editor.cursorY).toBe(0);
            expect(editor.cursorX).toBe(0);
        });

        it('should handle wrapping logic in visual movement', () => {
            // Make a long line
            // Width 8.
            // '1234567890' -> 
            // Row 1: '12345678'
            // Row 2: '90'
            editor.lines = ['1234567890', 'Next'];
            editor.cursorY = 0;
            editor.cursorX = 0;
            
            // Move down 1 visual row (should be same logical line, wrapped part)
            editor.moveCursorVisually(1);
            expect(editor.cursorY).toBe(0);
            expect(editor.cursorX).toBe(8); // Start of 2nd chunk
            
            // Move down again (should be next logical line)
            editor.moveCursorVisually(1);
            expect(editor.cursorY).toBe(1);
            expect(editor.cursorX).toBe(0); // Matches visual offset 0
        });
        
        it('should maintain visual X offset', () => {
            // Width 8
            editor.lines = ['1234567890', '1234567890'];
            editor.cursorY = 0;
            editor.cursorX = 2; // Visual X = 2
            
            // Move down to wrapped part
            editor.moveCursorVisually(1);
            expect(editor.cursorY).toBe(0);
            // Chunk starts at 8. We want visual X=2. So logical X = 8+2 = 10.
            // But line length is 10. Max index is 10 (after last char).
            expect(editor.cursorX).toBe(10);
            
            // Move down to next line
            editor.moveCursorVisually(1);
            expect(editor.cursorY).toBe(1);
            expect(editor.cursorX).toBe(2);
        });
    });

    describe('moveCursorByWord', () => {
        beforeEach(() => {
            editor.lines = ['Word1 Word2', 'Word3'];
        });

        it('should move right by word', () => {
            // 'W|ord1 Word2'
            editor.cursorX = 0;
            editor.moveCursorByWord('right');
            // Should jump to start of next word or end of current? 
            // Logic: while !space, then while space.
            // 'Word1 ' -> moves to 'W' of Word2?
            // Let's trace:
            // i=0 ('W'). !space loop -> i becomes 5 (space after Word1).
            // space loop -> i becomes 6 ('W' of Word2).
            expect(editor.cursorX).toBe(6);
        });
        
        it('should move left by word', () => {
             editor.cursorX = 6; // 'W' of Word2
             editor.moveCursorByWord('left');
             // i=5 (space).
             // while space -> i=5.
             // while !space -> i=0.
             expect(editor.cursorX).toBe(0);
        });
    });

    describe('jumpToLine', () => {
        it('should jump to line and adjust scroll', () => {
            editor.lines = Array(10).fill('Line');
            editor.screenRows = 3;
            editor.jumpToLine(5);
            
            expect(editor.cursorY).toBe(4); // 0-based
            expect(editor.cursorX).toBe(0);
            
            // Scroll adjustment:
            // Visual Row Index of line 5 is 4 (if no wrapping).
            // rowOffset = max(0, 4 - floor(3/2)) = 4 - 1 = 3.
            expect(editor.rowOffset).toBe(3);
        });
    });
});
