
// src/editor.syntax.ts
import { CliEditor } from './editor.js';
import { parseLineSyntax } from './syntax.common.js';

/**
 * Single-pass character scanner to generate a color map for a line.
 * Implements "Poor Man's Syntax Highlighting" focusing on Brackets and Quotes.
 */
function getLineSyntaxColor(this: CliEditor, lineIndex: number, lineContent: string): Map<number, string> {
    // Check cache first
    if (this.syntaxCache.has(lineIndex)) {
        return this.syntaxCache.get(lineIndex)!;
    }

    // Request async syntax highlight
    // But for the FIRST render, we return empty map to not block.
    // We send message to worker.
    
    // However, if we don't have a worker yet (or if worker is disabled), we might want to fallback?
    // Assuming worker is always available as per plan.
    
    if (this.syntaxWorker) {
        this.syntaxWorker.postMessage({ lineIndex, content: lineContent });
        
        // Mark as "pending" in cache to avoid spamming the worker?
        // Let's use an empty map as pending state.
        // But if we cache empty map, we won't re-request?
        // We need a way to know if it's pending.
        // Let's NOT cache the empty map.
        // But render() calls this every frame.
        // If we don't cache, we spam postMessage.
        // So we cache an empty map, but we need to know it's a "temporary" empty map.
        // For simplicity: Cache the empty map. When worker replies, it overwrites.
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
    invalidateSyntaxCache
};
