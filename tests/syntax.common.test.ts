import { describe, it, expect } from 'vitest';
import { parseLineSyntax, COLOR_STRING, COLOR_BRACKET_1 } from '../src/syntax.common';

describe('syntax.common', () => {
    it('should identify double quotes strings', () => {
        const line = 'const s = "hello world";';
        const map = parseLineSyntax(line);
        // " is at 10, ; at 23.
        // "hello world" is 10 to 22.
        expect(map.get(10)).toBe(COLOR_STRING);
        expect(map.get(11)).toBe(COLOR_STRING);
        expect(map.get(22)).toBe(COLOR_STRING);
        // 9 is space, should be undefined
        expect(map.get(9)).toBeUndefined();
    });

    it('should identify single quotes strings', () => {
        const line = "const s = 'hello';";
        const map = parseLineSyntax(line);
        expect(map.get(10)).toBe(COLOR_STRING);
        expect(map.get(16)).toBe(COLOR_STRING);
    });

    it('should identify brackets', () => {
        const line = 'function() {}';
        const map = parseLineSyntax(line);
        expect(map.get(8)).toBe(COLOR_BRACKET_1); // (
        expect(map.get(9)).toBe(COLOR_BRACKET_1); // )
        expect(map.get(11)).toBe(COLOR_BRACKET_1); // {
        expect(map.get(12)).toBe(COLOR_BRACKET_1); // }
    });

    it('should handle escaped quotes', () => {
        const line = '"quote \\" inside"';
        const map = parseLineSyntax(line);
        expect(map.get(0)).toBe(COLOR_STRING);
        expect(map.get(line.length - 1)).toBe(COLOR_STRING);
        // The escaped quote should be string color
        expect(map.get(8)).toBe(COLOR_STRING);
    });
});
