// src/editor.syntax.ts
import { CliEditor } from './editor.js';
import { parseLineSyntax } from './syntax.common.js';

/**
 * Single-pass character scanner to generate a color map for a line.
 * Implements "Poor Man's Syntax Highlighting" focusing on Brackets and Quotes.
 */
function getLineSyntaxColor(
    this: CliEditor,
    lineIndex: number,
    lineContent: string,
): Map<number, string> {
    // Check cache first
    if (this.syntaxCache.has(lineIndex)) {
        return this.syntaxCache.get(lineIndex)!;
    }

    // Highlighting runs asynchronously: the first render returns an empty map so
    // the frame is not blocked, and the worker replies trigger a repaint.
    if (this.syntaxWorker) {
        this.syntaxWorker.postMessage({ lineIndex, content: lineContent });

        // The empty map doubles as a "request in flight" marker so render() does
        // not re-post the same line every frame. The worker reply overwrites it.
        // Lines edited since the request are covered by invalidateSyntaxCache().
        const empty = new Map<number, string>();
        this.syntaxCache.set(lineIndex, empty);
        return empty;
    } else {
        // Fallback for tests or no-worker env: Synchronous
        const map = parseLineSyntax(lineContent);
        this.syntaxCache.set(lineIndex, map);
        return map;
    }
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
    invalidateSyntaxCache,
};
