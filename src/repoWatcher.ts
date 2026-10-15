import type * as vscode from 'vscode';
import type { Repository } from './git';
import { applyPrefix, isManualModeWithoutKeys, prefixForBranch, stripPrefix } from './prefix';
import type { Settings } from './prefix';

export interface RepoWatcherHost {
  readonly log: vscode.LogOutputChannel;
  readSettings(repository: Repository): Settings;
  warnMissingProjectKeys(): void;
}

export type InsertResult =
  | { readonly kind: 'inserted'; readonly prefix: string }
  | { readonly kind: 'noKey'; readonly branch: string }
  | { readonly kind: 'notConfigured' };

const COMMIT_WINDOW_MS = 5000;

export class RepoWatcher implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private settings: Settings;
  private attached = false;
  private lastBranch: string | undefined;
  private headCommit: string | undefined;
  private headMovedAt = Number.NEGATIVE_INFINITY;

  constructor(
    readonly repository: Repository,
    private readonly host: RepoWatcherHost,
  ) {
    this.settings = host.readSettings(repository);
    this.disposables.push(
      repository.state.onDidChange(() => {
        this.onStateChange();
      }),
      repository.onDidCommit(() => {
        this.onCommit();
      }),
    );
    this.onStateChange();
  }

  get root(): string {
    return this.repository.rootUri.fsPath;
  }

  dispose(): void {
    for (const disposable of this.disposables.splice(0)) {
      disposable.dispose();
    }
  }

  onSettingsChanged(): void {
    const previous = this.settings;
    this.settings = this.host.readSettings(this.repository);
    if (!this.attached || this.isRebasing()) {
      return;
    }
    if (isManualModeWithoutKeys(this.settings)) {
      this.host.warnMissingProjectKeys();
      return;
    }
    const value = this.repository.inputBox.value;
    const rest = value === '' ? '' : (stripPrefix(value, previous) ?? stripPrefix(value, this.settings));
    if (rest === null) {
      this.host.log.debug(`[${this.root}] settings changed, commit message has no ticket prefix — left untouched`);
      return;
    }
    const prefix = prefixForBranch(this.lastBranch, this.settings);
    this.setValue((prefix ?? '') + rest, prefix, 'settings changed');
  }

  insert(): InsertResult {
    if (isManualModeWithoutKeys(this.settings)) {
      return { kind: 'notConfigured' };
    }
    const branch = this.repository.state.HEAD?.name;
    const prefix = prefixForBranch(branch, this.settings);
    if (prefix === null) {
      return { kind: 'noKey', branch: branch ?? '(detached HEAD)' };
    }
    const value = this.settings.prependOnActionClick
      ? applyPrefix(this.repository.inputBox.value, prefix, this.settings)
      : prefix;
    this.setValue(value, prefix, 'command');
    return { kind: 'inserted', prefix };
  }

  private onStateChange(): void {
    const head = this.repository.state.HEAD;
    if (!head) {
      return;
    }
    if (this.attached && head.commit !== this.headCommit) {
      this.headMovedAt = Date.now();
    }
    this.headCommit = head.commit;
    const branch = head.name;
    if (this.attached && branch === this.lastBranch) {
      return;
    }
    this.host.log.info(
      `[${this.root}] ${this.attached ? 'branch changed' : 'attached'}: ${branch ?? '(detached HEAD)'}`,
    );
    this.attached = true;
    this.lastBranch = branch;
    if (this.isRebasing()) {
      this.host.log.info(`[${this.root}] rebase in progress, commit message left untouched`);
      return;
    }
    if (isManualModeWithoutKeys(this.settings)) {
      this.host.warnMissingProjectKeys();
      return;
    }
    const prefix = prefixForBranch(branch, this.settings);
    this.setValue(applyPrefix(this.repository.inputBox.value, prefix, this.settings), prefix, 'branch');
  }

  private onCommit(): void {
    if (!this.attached || this.isRebasing() || isManualModeWithoutKeys(this.settings)) {
      return;
    }
    const value = this.repository.inputBox.value;
    if (value !== '' && Date.now() - this.headMovedAt > COMMIT_WINDOW_MS) {
      this.host.log.debug(`[${this.root}] commit did not go through, commit message left untouched`);
      return;
    }
    const prefix = prefixForBranch(this.repository.state.HEAD?.name, this.settings);
    this.setValue(applyPrefix(value, prefix, this.settings), prefix, 'after commit');
  }

  private isRebasing(): boolean {
    return this.repository.state.rebaseCommit !== undefined;
  }

  private setValue(value: string, prefix: string | null, reason: string): void {
    const inputBox = this.repository.inputBox;
    if (inputBox.value === value) {
      return;
    }
    inputBox.value = value;
    this.host.log.info(`[${this.root}] ${reason}: ${prefix === null ? 'ticket prefix removed' : `prefix "${prefix}"`}`);
  }
}
