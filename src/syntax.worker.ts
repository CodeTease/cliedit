
import { parentPort } from 'worker_threads';
import { parseLineSyntax } from './syntax.common.js';

if (parentPort) {
    parentPort.on('message', (msg: { lineIndex: number; content: string }) => {
        const { lineIndex, content } = msg;
        const colorMap = parseLineSyntax(content);
        
        // Map is transferable/cloneable in Node.js worker_threads
        parentPort?.postMessage({ lineIndex, colorMap });
    });
}
