
// src/editor.syntax.ts
import { CliEditor } from './editor.js';
import { ANSI } from './constants.js';

// Syntax colors
const COLOR_BRACKET_1 = ANSI.YELLOW;
const COLOR_STRING = ANSI.GREEN;

// State constants
const STATE_NORMAL = 0;
const STATE_IN_STRING_SINGLE = 1; // '
const STATE_IN_STRING_DOUBLE = 2; // "

/**
 * Single-pass character scanner to generate a color map for a line.
 * Implements "Poor Man's Syntax Highlighting" focusing on Brackets and Quotes.
 */
function getLineSyntaxColor(this: CliEditor, lineIndex: number, lineContent: string): Map<number, string> {
    // Check cache first
    if (this.syntaxCache.has(lineIndex)) {
        return this.syntaxCache.get(lineIndex)!;
    }

    const colorMap = new Map<number, string>();
    let state = STATE_NORMAL;
    
    for (let i = 0; i < lineContent.length; i++) {
        const char = lineContent[i];
        
        if (state === STATE_NORMAL) {
            if (char === '"') {
                state = STATE_IN_STRING_DOUBLE;
                colorMap.set(i, COLOR_STRING);
            } else if (char === "'") {
                state = STATE_IN_STRING_SINGLE;
                colorMap.set(i, COLOR_STRING);
            } else if ('()[]{}'.includes(char)) {
                // Alternate bracket colors for fun, or just use one
                colorMap.set(i, COLOR_BRACKET_1);
            }
        } else if (state === STATE_IN_STRING_DOUBLE) {
            colorMap.set(i, COLOR_STRING);
            if (char === '"') {
                // Check if escaped
                let backslashCount = 0;
                for (let j = i - 1; j >= 0; j--) {
                    if (lineContent[j] === '\\') backslashCount++;
                    else break;
                }
                // Even backslashes => not escaped (e.g., \\" is literal backslash then quote)
                // Odd backslashes => escaped (e.g., \" is literal quote)
                if (backslashCount % 2 === 0) {
                    state = STATE_NORMAL;
                }
            }
        } else if (state === STATE_IN_STRING_SINGLE) {
            colorMap.set(i, COLOR_STRING);
            if (char === "'") {
                // Check if escaped
                let backslashCount = 0;
                for (let j = i - 1; j >= 0; j--) {
                    if (lineContent[j] === '\\') backslashCount++;
                    else break;
                }
                if (backslashCount % 2 === 0) {
                    state = STATE_NORMAL;
                }
            }
        }
    }

    this.syntaxCache.set(lineIndex, colorMap);
    return colorMap;
}

/**
 * Invalidates the syntax highlighting cache.
 * Clears the entire cache to be safe and simple ("Poor Man's" approach).
 */
function invalidateSyntaxCache(this: CliEditor): void {
    this.syntaxCache.clear();
}

export const syntaxMethods = {
    getLineSyntaxColor,
    invalidateSyntaxCache
};
