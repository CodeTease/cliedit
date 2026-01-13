// src/vendor/keypress.ts
// This is a "vendored" version of the 'keypress' library (0.2.1)
// converted to TypeScript and stripped of mouse support
// to be integrated directly into cliedit.

import { EventEmitter } from 'events';
import { StringDecoder } from 'string_decoder';

/**
 * Defines the interface for a keypress event.
 * Adapted from the editor.ts file.
 */
export interface KeypressEvent {
  name?: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  sequence: string;
  code?: string;
}

/**
 * Polyfill for `EventEmitter.listenerCount()`, for backward compatibility.
 */
let listenerCount = EventEmitter.listenerCount;
if (!listenerCount) {
  listenerCount = function (emitter: EventEmitter, event: string | symbol): number {
    return emitter.listeners(event).length;
  };
}

/**
 * Regexes used to parse ansi escape codes.
 */
const metaKeyCodeRe = /^(?:\x1b)([a-zA-Z0-9])$/;
const functionKeyCodeRe =
  /^(?:\x1b+)(O|N|\[|\[\[)(?:(\d+)(?:;(\d+))?([~^$])|(?:1;)?(\d+)?([a-zA-Z]))/;
const mouseSgrRe = /^\x1b\[<(\d+);(\d+);(\d+)([mM])/;

/**
 * Main function, accepts a Readable Stream and makes it
 * emit "keypress" events.
 */
export default function keypress(stream: NodeJS.ReadStream): void {
  if (isEmittingKeypress(stream)) return;

  // Attach decoder to the stream to monitor data
  (stream as any)._keypressDecoder = new StringDecoder('utf8');

  function onData(b: Buffer): void {
    if (listenerCount(stream, 'keypress') > 0) {
      const r = (stream as any)._keypressDecoder.write(b);
      if (r) emitKey(stream, r);
    } else {
      // No one is listening, remove listener
      stream.removeListener('data', onData);
      stream.on('newListener', onNewListener);
    }
  }

  function onNewListener(event: string | symbol): void {
    if (event === 'keypress') {
      stream.on('data', onData);
      stream.removeListener('newListener', onNewListener);
    }
  }

  if (listenerCount(stream, 'keypress') > 0) {
    stream.on('data', onData);
  } else {
    stream.on('newListener', onNewListener);
  }
}

/**
 * Checks if the stream has already emitted the "keypress" event.
 */
function isEmittingKeypress(stream: NodeJS.ReadStream): boolean {
  let rtn = !!(stream as any)._keypressDecoder;
  if (!rtn) {
    // XXX: For older node versions, we want to remove existing
    // "data" and "newListener" listeners because they won't
    // include extensions from this module (like "mousepress" which was removed).
    stream.listeners('data').slice(0).forEach(function (l) {
      if (l.name === 'onData' && /emitKey/.test(l.toString())) {
        // FIX TS2769: Cast 'l' to a valid listener type
        stream.removeListener('data', l as (...args: any[]) => void);
      }
    });
    stream.listeners('newListener').slice(0).forEach(function (l) {
      if (l.name === 'onNewListener' && /keypress/.test(l.toString())) {
        // FIX TS2769: Cast 'l' to a valid listener type
        stream.removeListener('newListener', l as (...args: any[]) => void);
      }
    });
  }
  return rtn;
}

/**
 * The code below is taken from node-core's `readline.js` module
 * and has been converted to TypeScript.
 */

function emitKey(stream: NodeJS.ReadStream, s: string): void {
  let ch: string | undefined;
  const key: KeypressEvent = {
    name: undefined,
    ctrl: false,
    meta: false,
    shift: false,
    sequence: s,
  };
  let parts: RegExpExecArray | null;

  // Warning: The `Buffer.isBuffer(s)` block has been removed.
  // Reason: `onData` always calls `emitKey` with a string (result from StringDecoder).
  // The recursive block (paste) also calls with a string.
  // Therefore, `s` is always a string.

  if (s === '\r') {
    // carriage return
    key.name = 'return';
  } else if (s === '\n') {
    // enter, should have been linefeed
    key.name = 'enter';
  } else if (s === '\t') {
    // tab
    key.name = 'tab';
  } else if (
    s === '\b' ||
    s === '\x7f' ||
    s === '\x1b\x7f' ||
    s === '\x1b\b'
  ) {
    // backspace or ctrl+h
    key.name = 'backspace';
    key.meta = s.charAt(0) === '\x1b';
  } else if (s === '\x1b' || s === '\x1b\x1b') {
    // escape key
    key.name = 'escape';
    key.meta = s.length === 2;
  } else if (s === ' ' || s === '\x1b ') {
    key.name = 'space';
    key.meta = s.length === 2;
  } else if (s <= '\x1a') {
    // ctrl+letter
    key.name = String.fromCharCode(s.charCodeAt(0) + 'a'.charCodeAt(0) - 1);
    key.ctrl = true;
  } else if (s.length === 1 && s >= 'a' && s <= 'z') {
    // lowercase letter
    key.name = s;
  } else if (s.length === 1 && s >= 'A' && s <= 'Z') {
    // shift+letter
    key.name = s.toLowerCase();
    key.shift = true;
  } else if ((parts = metaKeyCodeRe.exec(s))) {
    // meta+character key
    key.name = parts[1].toLowerCase();
    key.meta = true;
    key.shift = /^[A-Z]$/.test(parts[1]);
  
  // ***** START BUG FIX *****
  // The original library failed to handle any standard printable
  // characters (numbers, symbols) that weren't a-z or A-Z.
  } else if (s.length === 1 && s >= ' ' && s <= '~') {
    // Standard printable character (digits, symbols, etc.)
    key.name = s;
    // We can infer shift status for common symbols
    key.shift = '!@#$%^&*()_+{}|:"<>?~'.includes(s);
  // ***** END BUG FIX *****

  } else if ((parts = functionKeyCodeRe.exec(s))) {
    // ansi escape sequence

    // Reassemble key code, ignoring leading \x1b,
    // modifier bitflag, and any meaningless "1;" strings
    const code =
      (parts[1] || '') +
      (parts[2] || '') +
      (parts[4] || '') +
      (parts[6] || '');
      
    // FIX TS2362: Convert (parts[...]) to number using parseInt
    const modifier = parseInt(parts[3] || parts[5] || '1', 10) - 1;

    // Parse modifier keys
    key.ctrl = !!(modifier & 4);
    key.meta = !!(modifier & 10);
    key.shift = !!(modifier & 1);
    key.code = code;

    // Parse the key itself
    switch (code) {
      /* xterm/gnome ESC O letter */
      case 'OP': key.name = 'f1'; break;
      case 'OQ': key.name = 'f2'; break;
      case 'OR': key.name = 'f3'; break;
      case 'OS': key.name = 'f4'; break;
      /* xterm/rxvt ESC [ number ~ */
      case '[11~': key.name = 'f1'; break;
      case '[12~': key.name = 'f2'; break;
      case '[13~': key.name = 'f3'; break;
      case '[14~': key.name = 'f4'; break;
      /* from Cygwin and used in libuv */
      case '[[A': key.name = 'f1'; break;
      case '[[B': key.name = 'f2'; break;
      case '[[C': key.name = 'f3'; break;
      case '[[D': key.name = 'f4'; break;
      case '[[E': key.name = 'f5'; break;
      /* common */
      case '[15~': key.name = 'f5'; break;
      case '[17~': key.name = 'f6'; break;
      case '[18~': key.name = 'f7'; break;
      case '[19~': key.name = 'f8'; break;
      case '[20~': key.name = 'f9'; break;
      case '[21~': key.name = 'f10'; break;
      case '[23~': key.name = 'f11'; break;
      case '[24~': key.name = 'f12'; break;
      /* xterm ESC [ letter */
      case '[A': key.name = 'up'; break;
      case '[B': key.name = 'down'; break;
      case '[C': key.name = 'right'; break;
      case '[D': key.name = 'left'; break;
      case '[E': key.name = 'clear'; break;
      case '[F': key.name = 'end'; break;
      case '[H': key.name = 'home'; break;
      /* xterm/gnome ESC O letter */
      case 'OA': key.name = 'up'; break;
      case 'OB': key.name = 'down'; break;
      case 'OC': key.name = 'right'; break;
      case 'OD': key.name = 'left'; break;
      case 'OE': key.name = 'clear'; break;
      case 'OF': key.name = 'end'; break;
      case 'OH': key.name = 'home'; break;
      /* xterm/rxvt ESC [ number ~ */
      case '[1~': key.name = 'home'; break;
      case '[2~': key.name = 'insert'; break;
      case '[3~': key.name = 'delete'; break;
      case '[4~': key.name = 'end'; break;
      case '[5~': key.name = 'pageup'; break;
      case '[6~': key.name = 'pagedown'; break;
      /* putty */
      case '[[5~': key.name = 'pageup'; break;
      case '[[6~': key.name = 'pagedown'; break;
      /* rxvt */
      case '[7~': key.name = 'home'; break;
      case '[8~': key.name = 'end'; break;
      /* rxvt keys with modifiers */
      case '[a': key.name = 'up'; key.shift = true; break;
      case '[b': key.name = 'down'; key.shift = true; break;
      case '[c': key.name = 'right'; key.shift = true; break;
      case '[d': key.name = 'left'; key.shift = true; break;
      case '[e': key.name = 'clear'; key.shift = true; break;
      case '[2$': key.name = 'insert'; key.shift = true; break;
      case '[3$': key.name = 'delete'; key.shift = true; break;
      case '[5$': key.name = 'pageup'; key.shift = true; break;
      case '[6$': key.name = 'pagedown'; key.shift = true; break;
      case '[7$': key.name = 'home'; key.shift = true; break;
      case '[8$': key.name = 'end'; key.shift = true; break;
      case 'Oa': key.name = 'up'; key.ctrl = true; break;
      case 'Ob': key.name = 'down'; key.ctrl = true; break;
      case 'Oc': key.name = 'right'; key.ctrl = true; break;
      case 'Od': key.name = 'left'; key.ctrl = true; break;
      case 'Oe': key.name = 'clear'; key.ctrl = true; break;
      case '[2^': key.name = 'insert'; key.ctrl = true; break;
      case '[3^': key.name = 'delete'; key.ctrl = true; break;
      case '[5^': key.name = 'pageup'; key.ctrl = true; break;
      case '[6^': key.name = 'pagedown'; key.ctrl = true; break;
      case '[7^': key.name = 'home'; key.ctrl = true; break;
      case '[8^': key.name = 'end'; key.ctrl = true; break;
      /* misc. */
      case '[Z': key.name = 'tab'; key.shift = true; break;
      default: key.name = 'undefined'; break;
    }
  } else if (s.length > 1 && s[0] !== '\x1b') {
    // Received a string longer than one character.
    // Could be a paste, since it's not a control sequence.
    for (const c of s) {
      emitKey(stream, c);
    }
    return;
  }

  // Mouse handling (SGR 1006)
  if ((parts = mouseSgrRe.exec(s))) {
    // SGR Mode: \x1b[< b; x; y M/m
    // b: button code
    // x, y: coordinates (1-based)
    // M/m: Press/Release

    const b = parseInt(parts[1], 10);
    const x = parseInt(parts[2], 10);
    const y = parseInt(parts[3], 10);
    const type = parts[4]; // M=press, m=release

    key.name = 'mouse';
    key.ctrl = false;
    key.meta = false;
    key.shift = false;
    
    // Check for Scroll (Button 64 = Up, 65 = Down)
    if (b === 64) {
        key.name = 'scrollup';
        key.code = 'scrollup';
    } else if (b === 65) {
        key.name = 'scrolldown';
        key.code = 'scrolldown';
    } 
    // We can handle click here if needed (b=0 left, b=1 middle, b=2 right)
    // but for now only scroll is requested.
  }

  // Don't emit key if name is not found
  if (key.name === undefined) {
    return; // key = undefined;
  }

  if (s.length === 1) {
    ch = s;
  }

  if (key || ch) {
    stream.emit('keypress', ch, key);
  }
}