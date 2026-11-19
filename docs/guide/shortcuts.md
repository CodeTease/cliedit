# Keyboard Shortcuts

Every binding below is routed by `handleKeypressEvent()` → `handleEditKeys()` in
`src/editor.keys.ts`, with the byte sequences defined in `src/constants.ts`.

## General

| Key | Action |
| --- | --- |
| `Ctrl+S` | **Save** to `filepath` and exit (`saved: true`) |
| `Ctrl+Q` | **Quit** without saving (`saved: false`). On a dirty buffer it asks for a second `Ctrl+Q` within 3 s |

The confirmation is silent: the warning goes into `statusMessage`, but the second status-bar
row renders the fixed help text while in `edit` mode, so the first `Ctrl+Q` appears to do
nothing. Pressing it again quits.

`Ctrl+C` is **not** quit — it copies. Terminal apps that expect `Ctrl+C` to abort will
find it copies instead, so document this for your users.

## Navigation

| Key | Action |
| --- | --- |
| `Up` / `Down` | Move one **visual row** (wrapped lines count as several rows) |
| `Left` / `Right` | Move one character, crossing line boundaries |
| `Alt+Left` / `Alt+Right` | Jump by **word** (space-delimited), crossing line boundaries |
| `Home` / `End` | Start / end of the current **visual row**, not the logical line |
| `Page Up` / `Page Down` | Move the cursor one screen (± `screenRows` visual rows) |
| `Mouse wheel` | Scroll the viewport 3 visual rows and pull the cursor back into view |
| `Ctrl+L` | **Go to Line** (type a number, `Enter` to jump, digits only) |

Because `Home`/`End` work on visual rows, pressing `Home` in the middle of a long wrapped
line moves to the start of that wrapped segment, not to column 0 of the line.

## Editing

| Key | Action |
| --- | --- |
| Any printable character | Insert at the cursor (replacing a selection) |
| `Backspace` | Delete the character before the cursor, or join with the previous line; deletes both halves of an empty auto-inserted pair |
| `Delete` | Delete the character after the cursor, or join with the next line |
| `Enter` | Split the line and copy the current indentation onto the new one |
| `Tab` | Insert `tabSize` spaces, or **indent** every selected line |
| `Shift+Tab` | **Outdent** the selected lines, or the current line when nothing is selected |
| `Ctrl+K` | **Cut line** to the system clipboard |
| `Ctrl+U` | **Paste** the clipboard at the cursor |
| `Ctrl+D` | **Duplicate** the current line, or the selection |
| `Alt+Up` / `Alt+Down` | **Move** the current line or selection up / down |

Auto-pairing: typing `(`, `[`, `{`, `'` or `"` inserts the closing character and places
the cursor between them; typing a closing character that is already there steps over it;
typing an opener while text is selected wraps the selection.

`Ctrl+M` is listed in `constants.ts` as "match bracket", but `KEYS.CTRL_M` (`\x0d`) is the
same byte as `KEYS.ENTER`, and `handleEditKeys()` tests `ENTER` first. Bracket matching is
therefore unreachable from the keyboard in this build; `matchBracket()` remains callable
as a method on `CliEditor`.

## Selection

| Key | Action |
| --- | --- |
| `Ctrl+Up` / `Ctrl+Down` | Extend the selection by visual row |
| `Ctrl+Left` / `Ctrl+Right` | Extend the selection by character |
| Any plain navigation key | Cancels the selection |
| Typing / `Backspace` / `Delete` | Replaces or deletes the selection |

Selection state is an anchor plus the live cursor, so extending it in any direction works;
the range is normalized only when it is read.

## Clipboard

| Key | Action |
| --- | --- |
| `Ctrl+C` | **Copy** the selection, or the whole buffer when nothing is selected |
| `Ctrl+X` | **Cut** the selection, or the current line when nothing is selected |
| `Ctrl+V` | **Paste** the clipboard at the cursor |
| `Ctrl+K` | **Cut line** |
| `Ctrl+U` | **Paste** the clipboard |

Clipboard access shells out to a system command that must be on `PATH`:

| Platform | Copy | Paste |
| --- | --- | --- |
| macOS | `pbcopy` | `pbpaste` |
| Windows | `clip` | `powershell -command "Get-Clipboard"` |
| Linux | `xclip -selection clipboard` | `xclip -selection clipboard -o` |

If the command is missing (common on headless Linux), the `exec` callback rejects. `Ctrl+C`,
`Ctrl+X` and `Ctrl+K` invoke their async action without awaiting it, so the rejection
surfaces as an unhandled promise rejection instead of a visible message: the copy silently
does nothing. `Ctrl+V` / `Ctrl+U` catch the error. Install `xclip` on Linux if clipboard
support matters.

## Search & Replace

| Key | Action |
| --- | --- |
| `Ctrl+W` | **Find**: type a query, `Enter` jumps to the first match |
| `Ctrl+R` | **Replace**: query first, `Enter`, then the replacement, `Enter` |
| `Ctrl+G` | **Find next** match; re-runs the search if results were cleared. With no query it opens Find mode |

In `search_find` / `search_replace` (query entry):

- `Enter`: confirm the current step (`find` → jump, `replace` → ask for the replacement)
- `Backspace`: delete the last character of the query
- `Esc` / `Ctrl+C` / `Ctrl+Q`: cancel the search

In `search_confirm` (after a replace search finds a match):

| Key | Action |
| --- | --- |
| `y` | Replace this match and move to the next |
| `n` | Skip this match and move to the next |
| `a` | Replace all remaining matches and leave confirm mode |
| `q` / `Esc` / `Ctrl+C` / `Ctrl+Q` | Stop replacing |

Matches are highlighted (inverted) until you type, navigate, or start another search.

## History

| Key | Action |
| --- | --- |
| `Ctrl+Z` | **Undo** |
| `Ctrl+Y` | **Redo** |

History is a snapshot stack capped at 100 states (`src/history.ts`). Every undo and redo
marks the buffer dirty, and a new edit clears the redo stack.
