import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager } from '../src/history';
import { DocumentState } from '../src/types';

describe('HistoryManager', () => {
    let history: HistoryManager;

    beforeEach(() => {
        history = new HistoryManager(5);
    });

    const createState = (text: string): DocumentState => ({
        lines: [text],
        cursorX: 0,
        cursorY: 0
    });

    it('should save state and undo', () => {
        const state1 = createState('state1');
        history.saveState(state1);
        
        const currentState = createState('current');
        const previous = history.undo(currentState);
        
        expect(previous).toEqual(state1);
    });

    it('should redo', () => {
        const state1 = createState('state1');
        history.saveState(state1);
        
        const currentState = createState('state2');
        history.undo(currentState);
        
        const redone = history.redo(state1); // passing what we are at now (state1)
        expect(redone).toEqual(currentState);
    });

    it('should limit history size', () => {
        for(let i=0; i<10; i++) {
            history.saveState(createState(`state${i}`));
        }
        // Size is 5.
        // History should contain state5, state6, state7, state8, state9.
        
        // Undo 5 times should work.
        let current = createState('current');
        for(let i=0; i<5; i++) {
            const prev = history.undo(current);
            expect(prev).toBeDefined();
            current = prev!;
        }
        
        // 6th undo should return null
        expect(history.undo(current)).toBeNull();
    });
});
