import { ANSI } from './constants.js';

interface Cell {
    char: string;
    style: string;
}

export class ScreenBuffer {
    private rows: number = 0;
    private cols: number = 0;
    private currentBuffer: Cell[][] = [];
    private nextBuffer: Cell[][] = [];
    private forceRedraw: boolean = true;

    constructor() {}

    public resize(rows: number, cols: number): void {
        this.rows = rows;
        this.cols = cols;
        this.currentBuffer = this.createBuffer(rows, cols);
        this.nextBuffer = this.createBuffer(rows, cols);
        this.forceRedraw = true;
    }

    private createBuffer(rows: number, cols: number): Cell[][] {
        const buffer: Cell[][] = [];
        for (let y = 0; y < rows; y++) {
            const row: Cell[] = [];
            for (let x = 0; x < cols; x++) {
                row.push({ char: ' ', style: '' });
            }
            buffer.push(row);
        }
        return buffer;
    }

    public clear(): void {
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                this.nextBuffer[y][x] = { char: ' ', style: '' };
            }
        }
    }

    public put(x: number, y: number, char: string, style: string = ''): void {
        if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
            // One character occupies exactly one cell; wide (CJK) glyphs are not
            // measured and will overflow the cell they are drawn into.
            this.nextBuffer[y][x] = { char, style };
        }
    }

    public putString(x: number, y: number, text: string, style: string = ''): void {
        for (let i = 0; i < text.length; i++) {
            this.put(x + i, y, text[i], style);
        }
    }

    public flush(): void {
        let output = '';
        let lastStyle = '';
        let lastY = -1;
        let lastX = -1;

        // After a resize the current buffer no longer describes the screen, so
        // the full grid must be repainted.
        if (this.forceRedraw) {
            output += ANSI.CLEAR_SCREEN; // Clear entire screen
            // Reset current buffer to allow diffing to fill everything
            for (let y = 0; y < this.rows; y++) {
                for (let x = 0; x < this.cols; x++) {
                    this.currentBuffer[y][x] = { char: '', style: 'INVALID' };
                }
            }
            this.forceRedraw = false;
        }

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const next = this.nextBuffer[y][x];
                const curr = this.currentBuffer[y][x];

                if (next.char !== curr.char || next.style !== curr.style) {
                    // 1. Move Cursor if needed
                    if (y !== lastY || x !== lastX + 1) {
                        output += `\x1b[${y + 1};${x + 1}H`;
                    }

                    // 2. Set Style if needed
                    if (next.style !== lastStyle) {
                        // Each cell in nextBuffer carries its complete style, so
                        // RESET before applying it. Styles are treated as mutually
                        // exclusive modes (selection, syntax colour, search).
                        output += ANSI.RESET_COLORS + next.style;
                        lastStyle = next.style;
                    }

                    // 3. Write Char
                    output += next.char;

                    // 4. Update State
                    this.currentBuffer[y][x] = { ...next };
                    lastY = y;
                    lastX = x;
                }
            }
        }

        // Reset style at the end of flush to be safe
        if (lastStyle !== '') {
            output += ANSI.RESET_COLORS;
        }

        // ScreenBuffer does not position the physical cursor; render() does that
        // after flush() so the cursor lands on the document cursor.

        if (output.length > 0) {
            process.stdout.write(output);
        }
    }
}
