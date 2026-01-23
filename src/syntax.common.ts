import { ANSI } from './constants.js';

// Syntax colors
export const COLOR_BRACKET_1 = ANSI.YELLOW;
export const COLOR_STRING = ANSI.GREEN;

// State constants
const STATE_NORMAL = 0;
const STATE_IN_STRING_SINGLE = 1; // '
const STATE_IN_STRING_DOUBLE = 2; // "

/**
 * Pure function to parse a line and return a syntax color map.
 */
export function parseLineSyntax(lineContent: string): Map<number, string> {
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
                colorMap.set(i, COLOR_BRACKET_1);
            }
        } else if (state === STATE_IN_STRING_DOUBLE) {
            colorMap.set(i, COLOR_STRING);
            if (char === '"') {
                let backslashCount = 0;
                for (let j = i - 1; j >= 0; j--) {
                    if (lineContent[j] === '\\') backslashCount++;
                    else break;
                }
                if (backslashCount % 2 === 0) {
                    state = STATE_NORMAL;
                }
            }
        } else if (state === STATE_IN_STRING_SINGLE) {
            colorMap.set(i, COLOR_STRING);
            if (char === "'") {
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
    return colorMap;
}
