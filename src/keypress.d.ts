declare module 'keypress' {
    import { ReadStream } from 'tty';
    
    // Định nghĩa Interface KeypressEvent
    export interface KeypressEvent {
        name?: string;
        ctrl: boolean;
        meta: boolean;
        shift: boolean;
        sequence: string;
    }

    // Định nghĩa hàm chính keypress
    function keypress(stream: ReadStream): void;

    export default keypress;
}