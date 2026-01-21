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
            // Handle wide characters (simple check) if needed, 
            // but for now strict 1-char-1-cell per plan.
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

        // Optimization: If force redraw, we clear screen first? 
        // Or just iterate everything.
        // Diffing is generally better than clear screen unless everything changed.
        // If forceRedraw is true, we assume currentBuffer is invalid/empty.
        
        if (this.forceRedraw) {
             output += ANSI.CLEAR_SCREEN; // Clear entire screen
             // Reset current buffer to allow diffing to fill everything
             for(let y=0; y<this.rows; y++) {
                 for(let x=0; x<this.cols; x++) {
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
                        // Apply style. Note: style can be complex (fg + bg).
                        // If style is empty, it means RESET.
                        // Ideally we use ANSI.RESET_COLORS then apply style, 
                        // or just apply style if it overrides everything.
                        // To be safe and simple: Reset + Apply
                        // BUT that's verbose. 
                        // Let's assume 'style' passed in is the FULL set of codes needed.
                        // If style is '', we must RESET.
                        
                        if (next.style === '') {
                             output += ANSI.RESET_COLORS;
                        } else {
                             // Optimization: if strictly additive? No, just write it.
                             // But if we switch from INVERT to RED, we might need RESET in between.
                             // Safest: Always RESET before applying new style unless we are smart.
                             // Let's rely on the caller passing correct styles or RESET + Style.
                             
                             // Better approach for CLI Editor:
                             // Styles are usually mutually exclusive modes (Selection, Syntax Color).
                             // We should probably RESET if style changes, THEN apply next.
                             output += ANSI.RESET_COLORS + next.style;
                        }
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
        
        // Hide cursor during update? Already hidden in setupTerminal, 
        // but 'render' usually sets the final cursor position.
        // ScreenBuffer doesn't manage physical cursor position (that's handled after flush).
        
        if (output.length > 0) {
            process.stdout.write(output);
        }
    }
}
