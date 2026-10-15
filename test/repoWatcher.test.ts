import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { LogOutputChannel } from 'vscode';
import type { Repository } from '../src/git';
import { DEFAULT_SETTINGS } from '../src/prefix';
import type { Settings } from '../src/prefix';
import { RepoWatcher } from '../src/repoWatcher';
import type { RepoWatcherHost } from '../src/repoWatcher';

type Listener = () => void;

class FakeEvent {
  private readonly listeners = new Set<Listener>();
  readonly event = (listener: Listener) => {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  };
  fire(): void {
    for (const listener of [...this.listeners]) {
      listener();
    }
  }
  get size(): number {
    return this.listeners.size;
  }
}

interface Head {
  name?: string;
  commit?: string;
}

class FakeRepo {
  readonly stateChanged = new FakeEvent();
  readonly committed = new FakeEvent();
  readonly inputBox = { value: '' };
  readonly state: { HEAD: Head | undefined; rebaseCommit: object | undefined; onDidChange: FakeEvent['event'] } = {
    HEAD: undefined,
    rebaseCommit: undefined,
    onDidChange: this.stateChanged.event,
  };
  readonly api = {
    rootUri: { fsPath: '/repo' },
    inputBox: this.inputBox,
    state: this.state,
    onDidCommit: this.committed.event,
  } as unknown as Repository;

  constructor(head?: Head) {
    this.state.HEAD = head;
  }

  setHead(head: Head | undefined): void {
    this.state.HEAD = head;
    this.stateChanged.fire();
  }

  checkout(name: string | undefined, commit = 'c1'): void {
    this.setHead({ name, commit });
  }

  commit(newHash: string | null, boxAfter: string): void {
    if (newHash !== null) {
      this.state.HEAD = { ...this.state.HEAD, commit: newHash };
      this.inputBox.value = boxAfter;
      this.stateChanged.fire();
    }
    this.committed.fire();
  }
}

let settings: Settings;
let host: RepoWatcherHost;
let warn: Mock<() => void>;

function watch(repo: FakeRepo): RepoWatcher {
  return new RepoWatcher(repo.api, host);
}

beforeEach(() => {
  settings = DEFAULT_SETTINGS;
  warn = vi.fn<() => void>();
  host = {
    log: { info: vi.fn(), debug: vi.fn() } as unknown as LogOutputChannel,
    readSettings: () => settings,
    warnMissingProjectKeys: warn,
  };
});

afterEach(() => {
  vi.useRealTimers();
});

describe('attaching', () => {
  it('sets the prefix in an empty box', () => {
    const repo = new FakeRepo({ name: 'feature/PROJ-1-login', commit: 'c1' });
    watch(repo);
    expect(repo.inputBox.value).toBe('(PROJ-1) ');
  });

  it('prepends the prefix to existing text', () => {
    const repo = new FakeRepo({ name: 'feature/PROJ-1', commit: 'c1' });
    repo.inputBox.value = 'draft';
    watch(repo);
    expect(repo.inputBox.value).toBe('(PROJ-1) draft');
  });

  it('replaces a stale prefix restored from a previous session', () => {
    const repo = new FakeRepo({ name: 'feature/PROJ-2', commit: 'c1' });
    repo.inputBox.value = '(PROJ-1) draft';
    watch(repo);
    expect(repo.inputBox.value).toBe('(PROJ-2) draft');
  });

  it('waits until the repository state is loaded', () => {
    const repo = new FakeRepo();
    watch(repo);
    expect(repo.inputBox.value).toBe('');
    repo.checkout('feature/PROJ-1');
    expect(repo.inputBox.value).toBe('(PROJ-1) ');
  });

  it('does nothing on a branch without a ticket', () => {
    const repo = new FakeRepo({ name: 'main', commit: 'c1' });
    repo.inputBox.value = 'draft';
    watch(repo);
    expect(repo.inputBox.value).toBe('draft');
  });
});

describe('branch changes', () => {
  it('replaces the prefix and keeps the text', () => {
    const repo = new FakeRepo({ name: 'feature/PROJ-1', commit: 'c1' });
    watch(repo);
    repo.inputBox.value += 'fix login';
    repo.checkout('fix/LEGOS-541');
    expect(repo.inputBox.value).toBe('(LEGOS-541) fix login');
  });

  it('removes the prefix on a keyless branch and on detached HEAD', () => {
    const repo = new FakeRepo({ name: 'feature/PROJ-1', commit: 'c1' });
    watch(repo);
    repo.inputBox.value += 'msg';
    repo.checkout('main');
    expect(repo.inputBox.value).toBe('msg');
    repo.checkout('feature/PROJ-1');
    expect(repo.inputBox.value).toBe('(PROJ-1) msg');
    repo.checkout(undefined, 'c9');
    expect(repo.inputBox.value).toBe('msg');
  });

  it('ignores state changes that keep the branch, so a deleted prefix stays deleted', () => {
    const repo = new FakeRepo({ name: 'feature/PROJ-1', commit: 'c1' });
    watch(repo);
    repo.inputBox.value = 'no prefix please';
    repo.stateChanged.fire();
    repo.setHead({ name: 'feature/PROJ-1', commit: 'c2' });
    expect(repo.inputBox.value).toBe('no prefix please');
  });

  it('leaves the box alone during a rebase', () => {
    const repo = new FakeRepo({ name: 'feature/PROJ-1', commit: 'c1' });
    watch(repo);
    repo.state.rebaseCommit = {};
    repo.inputBox.value = '(PROJ-1) rebased commit';
    repo.checkout(undefined, 'c5');
    expect(repo.inputBox.value).toBe('(PROJ-1) rebased commit');
    repo.state.rebaseCommit = undefined;
    repo.inputBox.value = '';
    repo.checkout('feature/PROJ-1', 'c6');
    expect(repo.inputBox.value).toBe('(PROJ-1) ');
  });
});

describe('after a commit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('fills the cleared box', () => {
    const repo = new FakeRepo({ name: 'feature/PROJ-1', commit: 'c1' });
    watch(repo);
    repo.commit('c2', '');
    expect(repo.inputBox.value).toBe('(PROJ-1) ');
  });

  it('prepends the prefix to a commit template', () => {
    const repo = new FakeRepo({ name: 'feature/PROJ-1', commit: 'c1' });
    watch(repo);
    repo.commit('c2', 'Why:');
    expect(repo.inputBox.value).toBe('(PROJ-1) Why:');
  });

  it('keeps the message of a commit that did not go through', () => {
    const repo = new FakeRepo({ name: 'feature/PROJ-1', commit: 'c1' });
    watch(repo);
    repo.inputBox.value = 'prefix removed on purpose';
    repo.commit(null, '');
    expect(repo.inputBox.value).toBe('prefix removed on purpose');
  });

  it('does not treat an old HEAD move as a successful commit', () => {
    const repo = new FakeRepo({ name: 'feature/PROJ-1', commit: 'c1' });
    watch(repo);
    repo.setHead({ name: 'feature/PROJ-1', commit: 'c2' });
    vi.advanceTimersByTime(60_000);
    repo.inputBox.value = 'prefix removed on purpose';
    repo.commit(null, '');
    expect(repo.inputBox.value).toBe('prefix removed on purpose');
  });

  it('fills an empty box even if the commit failed', () => {
    const repo = new FakeRepo({ name: 'feature/PROJ-1', commit: 'c1' });
    watch(repo);
    repo.inputBox.value = '';
    repo.commit(null, '');
    expect(repo.inputBox.value).toBe('(PROJ-1) ');
  });

  it('does nothing on a keyless branch', () => {
    const repo = new FakeRepo({ name: 'main', commit: 'c1' });
    watch(repo);
    repo.commit('c2', 'Why:');
    expect(repo.inputBox.value).toBe('Why:');
  });
});

describe('settings changes', () => {
  it('re-renders the prefix built with the previous settings', () => {
    const repo = new FakeRepo({ name: 'feature/PROJ-1', commit: 'c1' });
    const watcher = watch(repo);
    repo.inputBox.value += 'msg';
    settings = { ...DEFAULT_SETTINGS, wrapper: '[]', infix: ':' };
    watcher.onSettingsChanged();
    expect(repo.inputBox.value).toBe('[PROJ-1]: msg');
    settings = { ...settings, conventionalCommit: true };
    watcher.onSettingsChanged();
    expect(repo.inputBox.value).toBe('[PROJ-1]: msg');
  });

  it('switches from a conventional prefix back to a plain one', () => {
    settings = { ...DEFAULT_SETTINGS, conventionalCommit: true, infix: ':' };
    const repo = new FakeRepo({ name: 'feat/PROJ-1', commit: 'c1' });
    const watcher = watch(repo);
    expect(repo.inputBox.value).toBe('feat(PROJ-1): ');
    settings = DEFAULT_SETTINGS;
    watcher.onSettingsChanged();
    expect(repo.inputBox.value).toBe('(PROJ-1) ');
  });

  it('leaves text without a prefix untouched and fills an empty box', () => {
    const repo = new FakeRepo({ name: 'feature/PROJ-1', commit: 'c1' });
    const watcher = watch(repo);
    repo.inputBox.value = 'user text';
    settings = { ...DEFAULT_SETTINGS, wrapper: '{}' };
    watcher.onSettingsChanged();
    expect(repo.inputBox.value).toBe('user text');
    repo.inputBox.value = '';
    watcher.onSettingsChanged();
    expect(repo.inputBox.value).toBe('{PROJ-1} ');
  });

  it('does nothing before the repository state is loaded', () => {
    const repo = new FakeRepo();
    const watcher = watch(repo);
    settings = { ...DEFAULT_SETTINGS, wrapper: '{}' };
    watcher.onSettingsChanged();
    expect(repo.inputBox.value).toBe('');
  });
});

describe('manual mode without project keys', () => {
  beforeEach(() => {
    settings = { ...DEFAULT_SETTINGS, autoDetectProjectKey: false };
  });

  it('warns and leaves the box alone on attach and branch change', () => {
    const repo = new FakeRepo({ name: 'feature/PROJ-1', commit: 'c1' });
    repo.inputBox.value = '(PROJ-1) msg';
    watch(repo);
    repo.checkout('feature/PROJ-2');
    expect(repo.inputBox.value).toBe('(PROJ-1) msg');
    expect(warn).toHaveBeenCalled();
  });

  it('applies the configured keys once they are set', () => {
    const repo = new FakeRepo({ name: 'fix/legos-541', commit: 'c1' });
    repo.inputBox.value = '(PROJ-1) msg';
    const watcher = watch(repo);
    settings = { ...settings, projectKeys: ['LEGOS'] };
    watcher.onSettingsChanged();
    expect(repo.inputBox.value).toBe('(LEGOS-541) msg');
  });
});

describe('insert command', () => {
  it('replaces the whole box by default', () => {
    const repo = new FakeRepo({ name: 'feature/PROJ-1', commit: 'c1' });
    const watcher = watch(repo);
    repo.inputBox.value = 'some text';
    expect(watcher.insert()).toEqual({ kind: 'inserted', prefix: '(PROJ-1) ' });
    expect(repo.inputBox.value).toBe('(PROJ-1) ');
  });

  it('keeps the text with prependOnActionClick', () => {
    settings = { ...DEFAULT_SETTINGS, prependOnActionClick: true };
    const repo = new FakeRepo({ name: 'feature/PROJ-1', commit: 'c1' });
    const watcher = watch(repo);
    repo.inputBox.value = '(OLD-9) some text';
    watcher.insert();
    expect(repo.inputBox.value).toBe('(PROJ-1) some text');
    watcher.insert();
    expect(repo.inputBox.value).toBe('(PROJ-1) some text');
  });

  it('reports a branch without a ticket and leaves the box alone', () => {
    const repo = new FakeRepo({ name: 'main', commit: 'c1' });
    const watcher = watch(repo);
    repo.inputBox.value = 'draft';
    expect(watcher.insert()).toEqual({ kind: 'noKey', branch: 'main' });
    repo.checkout(undefined, 'c2');
    expect(watcher.insert()).toEqual({ kind: 'noKey', branch: '(detached HEAD)' });
    expect(repo.inputBox.value).toBe('draft');
  });

  it('reports missing project keys in manual mode', () => {
    settings = { ...DEFAULT_SETTINGS, autoDetectProjectKey: false };
    const repo = new FakeRepo({ name: 'feature/PROJ-1', commit: 'c1' });
    const watcher = watch(repo);
    expect(watcher.insert()).toEqual({ kind: 'notConfigured' });
  });
});

describe('dispose', () => {
  it('stops listening to the repository', () => {
    const repo = new FakeRepo({ name: 'feature/PROJ-1', commit: 'c1' });
    const watcher = watch(repo);
    watcher.dispose();
    expect(repo.stateChanged.size).toBe(0);
    expect(repo.committed.size).toBe(0);
    repo.inputBox.value = '';
    repo.checkout('fix/LEGOS-1');
    expect(repo.inputBox.value).toBe('');
  });
});
