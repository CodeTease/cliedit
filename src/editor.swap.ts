// src/editor.swap.ts

import { promises as fs } from 'fs';
import * as path from 'path';

export class SwapManager {
    private filepath: string;
    private swapPath: string;
    private intervalId: NodeJS.Timeout | null = null;
    private contentGetter: () => string;
    private lastSavedContent: string = '';
    private intervalMs: number = 2000; // 2 seconds

    constructor(filepath: string, contentGetter: () => string) {
        this.filepath = filepath;
        // If filepath is empty (e.g. untitled/piped), we can't really make a relative swap file easily.
        // We will default to a temp file or current dir if filepath is empty.
        // For now, let's assume if filepath is provided, we use it.
        if (!filepath) {
            this.swapPath = path.resolve('.untitled.swp');
        } else {
            const dir = path.dirname(filepath);
            const file = path.basename(filepath);
            this.swapPath = path.join(dir, '.' + file + '.swp');
        }
        this.contentGetter = contentGetter;
    }

    public start(): void {
        if (this.intervalId) return;
        this.intervalId = setInterval(() => this.saveSwap(), this.intervalMs);
    }

    public stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    // Explicitly update swap (can be called on keypress if we want instant-ish updates)
    public async update(): Promise<void> {
        await this.saveSwap();
    }

    private async saveSwap(): Promise<void> {
        const currentContent = this.contentGetter();
        // Optimization: Don't write if nothing changed since last swap save
        if (currentContent === this.lastSavedContent) return;

        try {
            await fs.writeFile(this.swapPath, currentContent, 'utf-8');
            this.lastSavedContent = currentContent;
        } catch {
            // Silently ignore swap errors to not disrupt user flow
        }
    }

    public async clear(): Promise<void> {
        this.stop();
        try {
            await fs.unlink(this.swapPath);
        } catch (err) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((err as any).code !== 'ENOENT') {
                // ignore
            }
        }
    }

    public static getSwapPath(filepath: string): string {
        if (!filepath) return path.resolve('.untitled.swp');
        const dir = path.dirname(filepath);
        const file = path.basename(filepath);
        return path.join(dir, '.' + file + '.swp');
    }

    public static async check(filepath: string): Promise<boolean> {
         const swapPath = SwapManager.getSwapPath(filepath);
         try {
             await fs.access(swapPath);
             return true;
         } catch {
             return false;
         }
    }

    public static async read(filepath: string): Promise<string> {
         const swapPath = SwapManager.getSwapPath(filepath);
         return fs.readFile(swapPath, 'utf-8');
    }
}
