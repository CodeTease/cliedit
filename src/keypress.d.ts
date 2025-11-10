declare module 'keypress' {
    import { ReadStream } from 'tty';
    
    // Define the KeypressEvent Interface
    export interface KeypressEvent {
        name?: string;
        ctrl: boolean;
        meta: boolean;
        shift: boolean;
        sequence: string;
    }

    // Define the main keypress function
    function keypress(stream: ReadStream): void;

    export default keypress;
}