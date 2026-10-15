# Contributing

## Setup

```sh
npm install
npm run build        # type check and bundle the extension into dist/
npm run typecheck    # tsc, no emit
npm run lint         # ESLint
npm test             # Vitest unit tests
npm run package      # build the .vsix
npm run icons        # rebuild resources/ticket-id-icons.woff and resources/icon.png from resources/icons/*.svg
```

Press F5 to start the Extension Development Host.

## Layout

- `src/extension.ts` – activation, Git API wiring, the Insert Ticket ID command
- `src/repoWatcher.ts` – one watcher per repository: branch changes, commits, settings changes
- `src/prefix.ts` – ticket key detection and prefix formatting, pure functions without VS Code
- `src/settings.ts` – reads and validates the `ticketIdCommitMessage` settings
- `src/git.d.ts` – Git extension API types from VS Code 1.90
- `test` – unit tests; `test/mocks/vscode.ts` stands in for the `vscode` module
- `resources/icons` – icon sources; `scripts/build-icons.mjs` turns them into the icon font and the Marketplace icon

## Releasing

Everything lives in `main`. Changes go in through pull requests, and releases are built from tags on `main`.

1. Bump `version` in `package.json` and add an entry to `CHANGELOG.md`.
2. Merge the change into `main`.
3. Tag the merge commit and push the tag:

   ```sh
   git tag v<version>
   git push origin v<version>
   ```

The `Release` workflow checks that the tag matches `package.json` and points to a commit on `main`, runs the checks, builds a single `.vsix` and attaches it to a GitHub release.

Publishing to the Marketplace is manual: `npx vsce login hopleus` and `npx vsce publish --no-dependencies`, or upload the `.vsix` from the release on the [publisher management page](https://marketplace.visualstudio.com/manage).
