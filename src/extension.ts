import * as vscode from 'vscode';
import type { API, GitExtension, Repository } from './git';
import type { Settings } from './prefix';
import { RepoWatcher } from './repoWatcher';
import type { RepoWatcherHost } from './repoWatcher';
import { readSettings, SECTION } from './settings';

const INSERT_COMMAND = 'ticketIdCommitMessage.insert';
const OPEN_SETTINGS = 'Open Settings';
const GIT_EXTENSION_IDS = ['vscode.git', 'hopleus.vscode-git-plus'];
const CONNECT_ATTEMPTS = 10;
const CONNECT_RETRY_MS = 100;

class Controller implements RepoWatcherHost, vscode.Disposable {
  private api: API | undefined;
  private apiSubscriptions: vscode.Disposable[] = [];
  private readonly watchers = new Map<string, RepoWatcher>();
  private warnedAboutProjectKeys = false;

  constructor(readonly log: vscode.LogOutputChannel) {}

  connect(api: API): void {
    this.disconnect();
    this.api = api;
    if (api.state === 'initialized') {
      this.start(api);
      return;
    }
    this.log.info('Waiting for the Git extension to initialize…');
    const subscription = api.onDidChangeState((state) => {
      if (state === 'initialized') {
        subscription.dispose();
        this.start(api);
      }
    });
    this.apiSubscriptions.push(subscription);
  }

  disconnect(): void {
    for (const subscription of this.apiSubscriptions.splice(0)) {
      subscription.dispose();
    }
    for (const watcher of this.watchers.values()) {
      watcher.dispose();
    }
    this.watchers.clear();
    this.api = undefined;
  }

  dispose(): void {
    this.disconnect();
  }

  readSettings(repository: Repository): Settings {
    return readSettings(repository.rootUri);
  }

  warnMissingProjectKeys(): void {
    if (this.warnedAboutProjectKeys) {
      return;
    }
    this.warnedAboutProjectKeys = true;
    void this.showMissingProjectKeysWarning();
  }

  onDidChangeConfiguration(event: vscode.ConfigurationChangeEvent): void {
    if (!event.affectsConfiguration(SECTION)) {
      return;
    }
    for (const watcher of this.watchers.values()) {
      if (event.affectsConfiguration(SECTION, watcher.repository.rootUri)) {
        watcher.onSettingsChanged();
      }
    }
  }

  async insert(arg: unknown): Promise<void> {
    const watcher = await this.resolveWatcher(arg);
    if (!watcher) {
      return;
    }
    const result = watcher.insert();
    if (result.kind === 'noKey') {
      void vscode.window.showInformationMessage(`No ticket ID found in branch ${result.branch}`);
    } else if (result.kind === 'notConfigured') {
      await this.showMissingProjectKeysWarning();
    }
  }

  private start(api: API): void {
    for (const repository of api.repositories) {
      this.open(repository);
    }
    this.apiSubscriptions.push(
      api.onDidOpenRepository((repository) => {
        this.open(repository);
      }),
      api.onDidCloseRepository((repository) => {
        this.close(repository);
      }),
    );
    this.log.info(`Git ready, watching ${this.watchers.size} repositor${this.watchers.size === 1 ? 'y' : 'ies'}`);
  }

  private open(repository: Repository): void {
    const id = repository.rootUri.toString();
    if (this.watchers.has(id)) {
      return;
    }
    this.log.info(`Repository opened: ${repository.rootUri.fsPath}`);
    this.watchers.set(id, new RepoWatcher(repository, this));
  }

  private close(repository: Repository): void {
    const id = repository.rootUri.toString();
    const watcher = this.watchers.get(id);
    if (!watcher) {
      return;
    }
    watcher.dispose();
    this.watchers.delete(id);
    this.log.info(`Repository closed: ${repository.rootUri.fsPath}`);
  }

  private watcherFor(uri: vscode.Uri): RepoWatcher | undefined {
    const repository = this.api?.getRepository(uri);
    return repository ? this.watchers.get(repository.rootUri.toString()) : undefined;
  }

  private async resolveWatcher(arg: unknown): Promise<RepoWatcher | undefined> {
    if (!this.api) {
      void vscode.window.showWarningMessage('Git is not available.');
      return undefined;
    }
    const sourceControlRoot = rootUriOf(arg);
    if (sourceControlRoot) {
      return this.watcherFor(sourceControlRoot);
    }
    const document = vscode.window.activeTextEditor?.document.uri;
    const fromEditor = document && this.watcherFor(scmInputRoot(document) ?? document);
    if (fromEditor) {
      return fromEditor;
    }
    const all = [...this.watchers.values()];
    if (all.length <= 1) {
      if (all.length === 0) {
        void vscode.window.showInformationMessage('No Git repository found.');
      }
      return all[0];
    }
    const selected = all.find((watcher) => watcher.repository.ui.selected);
    if (selected) {
      return selected;
    }
    const picked = await vscode.window.showQuickPick(
      all.map((watcher) => ({ label: watcher.root, watcher })),
      { placeHolder: 'Select a repository' },
    );
    return picked?.watcher;
  }

  private async showMissingProjectKeysWarning(): Promise<void> {
    const choice = await vscode.window.showWarningMessage(
      'Ticket ID Commit Message: auto-detection is off and no project keys are configured.',
      OPEN_SETTINGS,
    );
    if (choice === OPEN_SETTINGS) {
      await vscode.commands.executeCommand('workbench.action.openSettings', SECTION);
    }
  }
}

function rootUriOf(arg: unknown): vscode.Uri | undefined {
  if (typeof arg === 'object' && arg !== null && 'rootUri' in arg && arg.rootUri instanceof vscode.Uri) {
    return arg.rootUri;
  }
  return undefined;
}

function scmInputRoot(uri: vscode.Uri): vscode.Uri | undefined {
  if (uri.scheme !== 'vscode-scm') {
    return undefined;
  }
  const root = new URLSearchParams(uri.query).get('rootUri');
  return root ? vscode.Uri.parse(root) : undefined;
}

export function activate(context: vscode.ExtensionContext): void {
  const log = vscode.window.createOutputChannel('Ticket ID Commit Message', { log: true });
  const controller = new Controller(log);
  context.subscriptions.push(
    log,
    controller,
    vscode.commands.registerCommand(INSERT_COMMAND, (arg: unknown) => controller.insert(arg)),
    vscode.workspace.onDidChangeConfiguration((event) => {
      controller.onDidChangeConfiguration(event);
    }),
  );

  const start = (extension: vscode.Extension<GitExtension>): void => {
    useGitExtension(extension, controller, log, context).catch((error: unknown) => {
      log.error(`Failed to activate ${extension.id}`, error instanceof Error ? error : String(error));
    });
  };
  const gitExtension = findGitExtension();
  if (gitExtension) {
    start(gitExtension);
    return;
  }
  log.warn(`No Git extension found (${GIT_EXTENSION_IDS.join(', ')}), waiting for one to be enabled`);
  const subscription = vscode.extensions.onDidChange(() => {
    const found = findGitExtension();
    if (found) {
      subscription.dispose();
      start(found);
    }
  });
  context.subscriptions.push(subscription);
}

function findGitExtension(): vscode.Extension<GitExtension> | undefined {
  for (const id of GIT_EXTENSION_IDS) {
    const extension = vscode.extensions.getExtension<GitExtension>(id);
    if (extension) {
      return extension;
    }
  }
  return undefined;
}

async function useGitExtension(
  extension: vscode.Extension<GitExtension>,
  controller: Controller,
  log: vscode.LogOutputChannel,
  context: vscode.ExtensionContext,
): Promise<void> {
  log.info(`Using the Git API of ${extension.id}`);
  const git = extension.isActive ? extension.exports : await extension.activate();
  const connect = (attempt = 1): void => {
    try {
      controller.connect(git.getAPI(1));
    } catch (error) {
      if (attempt < CONNECT_ATTEMPTS) {
        setTimeout(() => {
          connect(attempt + 1);
        }, CONNECT_RETRY_MS);
        return;
      }
      log.error('Failed to get Git API', error instanceof Error ? error : String(error));
    }
  };
  context.subscriptions.push(
    git.onDidChangeEnablement((enabled) => {
      log.info(`Git extension ${enabled ? 'enabled' : 'disabled'}`);
      if (enabled) {
        connect();
      } else {
        controller.disconnect();
      }
    }),
  );
  if (git.enabled) {
    connect();
  } else {
    log.info('Git extension is disabled, waiting for it to be enabled');
  }
}

export function deactivate(): void {
  return;
}
