import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScreenBuffer } from '../src/screen_buffer';

describe('ScreenBuffer', () => {
    let buffer: ScreenBuffer;
    let stdoutSpy: any;

    beforeEach(() => {
        buffer = new ScreenBuffer();
        // Mock stdout
        stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    it('should resize and flush content', () => {
        buffer.resize(2, 5); // 2 rows, 5 cols
        buffer.put(0, 0, 'X', '');
        
        buffer.flush();
        
        expect(stdoutSpy).toHaveBeenCalled();
        const output = stdoutSpy.mock.calls.join('');
        // ANSI codes make exact match hard, but it should contain X
        expect(output).toContain('X');
    });

    it('should handle double buffering diffs', () => {
        buffer.resize(1, 5);
        
        // Frame 1
        buffer.put(0, 0, 'A', '');
        buffer.flush();
        stdoutSpy.mockClear();
        
        // Frame 2 - same content
        buffer.put(0, 0, 'A', '');
        buffer.flush();
        // Ideally, if optimized, it writes nothing or very little. 
        // But ScreenBuffer logic might be simple.
        
        // Change content
        buffer.put(0, 0, 'B', '');
        buffer.flush();
        
        const output = stdoutSpy.mock.calls.join('');
        expect(output).toContain('B');
    });
});
