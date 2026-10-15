# Changelog

## [0.1.0] - 2026-10-15

### Added

- Insert the ticket ID from the current branch into the Source Control commit message box on repository open, on branch switch and after each commit.
- Replace or remove an existing ticket prefix when switching branches, keeping the rest of the message.
- Auto-detection of `KEY-123` / `KEY_123` ticket IDs, including keys with digits (`PROJ2-15`).
- Manual mode with a list of project keys (case-insensitive, inserted in uppercase).
- Conventional Commits type from the start of the branch name (`feat/PROJ-1` → `feat(PROJ-1): `).
- Wrapper, prefix and infix settings compatible with the JetBrains "JIRA ID Commit Message" plugin.
- `Insert Ticket ID` command with a Source Control title bar button and `Cmd+Alt+J` / `Ctrl+Alt+J` keybinding.
- Multi-root and multi-repository support with per-folder settings.
- The commit message is left untouched while a rebase is in progress.
- With a git commit template the prefix is added in front of the template after each commit; a commit that did not go through leaves the message as is.
