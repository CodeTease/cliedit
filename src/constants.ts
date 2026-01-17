// src/constants.ts

/**
 * ANSI escape codes for terminal manipulation.
 */
export const ANSI = {
  CLEAR_SCREEN: '\x1b[2J', // Clear entire screen
  CLEAR_LINE: '\x1b[K', // Clear from cursor to end of line
  MOVE_CURSOR_TOP_LEFT: '\x1b[H', // Move cursor to top-left (1;1)
  HIDE_CURSOR: '\x1b[?25l', // Hide cursor
  SHOW_CURSOR: '\x1b[?25h', // Show cursor
  INVERT_COLORS: '\x1b[7m', // Invert background/foreground colors
  RESET_COLORS: '\x1b[0m', // Reset colors
  ENTER_ALTERNATE_SCREEN: '\x1b[?1049h', // Enter alternate screen
  EXIT_ALTERNATE_SCREEN: '\x1b[?1049l', // Exit alternate screen
  
  // Syntax Highlighting Colors
  YELLOW: '\x1b[33m',
  CYAN: '\x1b[36m',
  GREEN: '\x1b[32m',
};

/**
 * Key definitions for special keypresses (using Ctrl+ keys for reliable detection).
 */
export const KEYS = {
  // Control Sequences
  CTRL_C: '\x03', // Copy/Quit (contextual)
  CTRL_Q: '\x11', // Quit
  CTRL_S: '\x13', // Save
  CTRL_W: '\x17', // Find (Where is)
  CTRL_R: '\x12', // Replace
  CTRL_G: '\x07', // Go to next
  CTRL_L: '\x0c', // Go to Line (L)
  CTRL_Z: '\x1a', // Undo
  CTRL_Y: '\x19', // Redo
  CTRL_K: '\x0b', // Cut/Kill line
  CTRL_U: '\x15', // Paste/Un-kill
  CTRL_X: '\x18', // Cut Selection
  CTRL_V: '\x16', // Paste Selection
  CTRL_M: '\x0d', // Match Bracket (Ctrl+M is often Enter, but we distinguish if possible or rely on context)

  // Selection Keys (Mapped to Ctrl+Arrow for reliable detection)
  CTRL_ARROW_UP: 'C-up',
  CTRL_ARROW_DOWN: 'C-down',
  CTRL_ARROW_RIGHT: 'C-right',
  CTRL_ARROW_LEFT: 'C-left',
  
  // Standard Keys
  ENTER: '\r', // Carriage Return
  BACKSPACE: '\x7f', // DEL (usually Backspace)
  ESCAPE: '\x1b',

  // Escape sequences for navigation keys (used by keypress.name)
  ARROW_UP: 'up',
  ARROW_DOWN: 'down',
  ARROW_RIGHT: 'right',
  ARROW_LEFT: 'left',
  DELETE: 'delete',
  HOME: 'home', 
  END: 'end', 
  PAGE_UP: 'pageup',
  PAGE_DOWN: 'pagedown',
  TAB: '\t',
  SHIFT_TAB: 'SHIFT_TAB', // Internal representation
  ALT_UP: 'ALT_UP',       // Internal representation
  ALT_DOWN: 'ALT_DOWN',   // Internal representation
  CTRL_D: '\x04',
};