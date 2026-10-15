# Ticket ID Commit Message

Takes the ticket ID from your Git branch name and puts it into the Source Control commit message.

```text
Branch:          feature/PROJ-123-login
Commit message:  (PROJ-123) fix login redirect
```

Works with any tracker that uses `KEY-123` style IDs: Jira, YouTrack, Linear and others. Supports [Conventional Commits](https://www.conventionalcommits.org): `feat/PROJ-123-login` → `feat(PROJ-123): `.

## Features

- The ticket prefix is added when a repository opens, when you switch branches and after every commit.
- Switching branches replaces the old prefix and keeps the rest of your message. On a branch without a ticket (`main`, `develop`, detached HEAD) the prefix is removed.
- Only branch changes trigger an update: if you delete the prefix by hand, it stays deleted.
- The commit message is left alone during a rebase.
- Works with several repositories at once, each with its own branch and commit box. Settings can differ per workspace folder.
- **Insert Ticket ID** button and keyboard shortcut to add the prefix on demand.

## Examples

Default settings:

| Branch                          | Prefix           |
| ------------------------------- | ---------------- |
| `feat/this-PRODUCT-123-is-cool` | `(PRODUCT-123)`  |
| `fix/LEGOS-541`                 | `(LEGOS-541)`    |
| `MARCOM_881-feature`            | `(MARCOM_881)`   |
| `feature/PROJ2-15-search`       | `(PROJ2-15)`     |
| `main`                          | no prefix        |

With `"conventionalCommit": true` and `"infix": ":"`:

| Branch                          | Prefix                |
| ------------------------------- | --------------------- |
| `feat/this-PRODUCT-123-is-cool` | `feat(PRODUCT-123):`  |
| `fix/LEGOS-541`                 | `fix(LEGOS-541):`     |
| `docs-MARCOM_881-feature`       | `docs(MARCOM_881):`   |
| `feature/PROJ-1-login`          | `(PROJ-1):`           |

The type is taken only from the very start of the branch name and must be followed by `/`, `-` or `_`, so `feature/…` or `PROJ-1-prefix-bug` never produce a type. Recognized types: `feat`, `fix`, `build`, `ci`, `chore`, `docs`, `perf`, `refactor`, `style`, `test`.

A single space is always added after the prefix.

## Settings

All settings are in the `ticketIdCommitMessage` section, e.g. `ticketIdCommitMessage.wrapper`.

| Setting                | Default  | Description                                                             |
| ---------------------- | -------- | ----------------------------------------------------------------------- |
| `autoDetectProjectKey` | `true`   | Find any `KEY-123` or `KEY_123` ticket in the branch name.              |
| `projectKeys`          | `[]`     | Keys to look for when auto-detection is off, e.g. `["PROJ", "LEGOS"]`.  |
| `conventionalCommit`   | `false`  | Add the Conventional Commits type from the start of the branch name.    |
| `wrapper`              | `"()"`   | Characters around the ticket ID.                                        |
| `prefix`               | `"none"` | Text before the ticket ID.                                              |
| `infix`                | `"none"` | Text after the ticket ID.                                               |
| `prependOnActionClick` | `false`  | Keep your text when using **Insert Ticket ID** instead of replacing it. |

### Message format

```text
<type><prefix><wrapper open><TICKET><wrapper close><infix><space>
```

**wrapper**

- `"none"` → `PROJ-123`
- `"()"` → `(PROJ-123)` (default)
- `"{}"` → `{PROJ-123}`
- `"[]"` → `[PROJ-123]`
- `"<>"` → `<PROJ-123>`
- `"**"` → `*PROJ-123*`
- `"//"` → `/PROJ-123/`
- `"\\\\"` → `\PROJ-123\`
- `"||"` → `|PROJ-123|`

**prefix**

- `"none"` → `(PROJ-123)` (default)
- `"-"` → `-(PROJ-123)`
- `":"` → `:(PROJ-123)`
- `"#"` → `#(PROJ-123)`

**infix**

- `"none"` → `(PROJ-123)` (default)
- `"-"` → `(PROJ-123)-`
- `" -"` → `(PROJ-123) -`
- `":"` → `(PROJ-123):`
- `" :"` → `(PROJ-123) :`

### Example configurations

```jsonc
// [PROJ-123]: fix login
"ticketIdCommitMessage.wrapper": "[]",
"ticketIdCommitMessage.infix": ":"
```

```jsonc
// #PROJ-123 fix login
"ticketIdCommitMessage.wrapper": "none",
"ticketIdCommitMessage.prefix": "#"
```

```jsonc
// feat(PROJ-123): fix login   (branch feat/PROJ-123-login)
"ticketIdCommitMessage.conventionalCommit": true,
"ticketIdCommitMessage.infix": ":"
```

```jsonc
// Only PROJ and LEGOS tickets: feature/proj-7-login → (PROJ-7) fix login
"ticketIdCommitMessage.autoDetectProjectKey": false,
"ticketIdCommitMessage.projectKeys": ["PROJ", "LEGOS"]
```

In manual mode keys match case-insensitively and are inserted in uppercase; the first configured key found in the branch wins. If auto-detection is off and `projectKeys` is empty, you get a warning with an **Open Settings** button once per session.

## Insert Ticket ID

Adds the prefix on demand, e.g. after you cleared the commit box.

- **Button:** the ticket icon in the Source Control view header, next to Commit and Refresh. With several repositories it is on each repository row. Like other header buttons it shows up when the view is hovered or focused; set `"workbench.view.alwaysShowHeaderActions": true` to always show it.
- **Shortcut:** `Cmd+Alt+J` on macOS, `Ctrl+Alt+J` on Windows and Linux. Change it in **Preferences: Open Keyboard Shortcuts** (`ticketIdCommitMessage.insert`).
- **Command Palette:** `Ticket ID: Insert Ticket ID`.

By default the whole commit box is replaced with the prefix. With `prependOnActionClick` enabled your text is kept and only the prefix is added or replaced. If the branch has no ticket ID, you get a notification.

The button acts on its own repository. The shortcut and the Command Palette use the repository of the active editor, otherwise the selected one.

Logs are in the **Ticket ID Commit Message** output channel.

## Installation

Download `ticket-id-commit-message-<version>.vsix` from the latest [GitHub release](https://github.com/hopleus/vscode-ticket-id-commit/releases/latest) and install it:

```sh
code --install-extension ticket-id-commit-message-<version>.vsix
```

Or in VS Code: **Extensions** view → **…** → **Install from VSIX…**

Requires VS Code 1.90 or newer with the built-in Git extension enabled, or [Git Plus](https://github.com/hopleus/vscode-git-plus) installed in its place.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Credits

Based on [JIRA ID Commit Message](https://github.com/nemwiz/jira-commit-message-intellij-plugin) by [nemwiz](https://github.com/nemwiz). Differences from the original:

- Auto-detection also finds keys with digits, such as `PROJ2-15`.
- The Conventional Commits type is only taken from the very start of the branch name.
- A configured key does not match the end of a longer word: `AB` does not match `CAB-12`.

## License

[MIT](LICENSE)
