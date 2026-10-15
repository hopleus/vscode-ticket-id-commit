import * as vscode from 'vscode';
import { DEFAULT_SETTINGS, INFIXES, PREFIXES, WRAPPERS } from './prefix';
import type { Settings } from './prefix';

export const SECTION = 'ticketIdCommitMessage';

function readBoolean(config: vscode.WorkspaceConfiguration, key: keyof Settings, fallback: boolean): boolean {
  const value = config.get<unknown>(key);
  return typeof value === 'boolean' ? value : fallback;
}

function readEnum<T extends string>(
  config: vscode.WorkspaceConfiguration,
  key: keyof Settings,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = config.get<unknown>(key);
  return allowed.find((option) => option === value) ?? fallback;
}

function readProjectKeys(config: vscode.WorkspaceConfiguration): string[] {
  const value = config.get<unknown>('projectKeys');
  if (!Array.isArray(value)) {
    return [];
  }
  const keys = value
    .filter((key): key is string => typeof key === 'string')
    .map((key) => key.trim().replace(/[_-]+$/, ''))
    .filter((key) => key.length > 0);
  return [...new Set(keys)];
}

export function readSettings(scope?: vscode.ConfigurationScope): Settings {
  const config = vscode.workspace.getConfiguration(SECTION, scope);
  return {
    autoDetectProjectKey: readBoolean(config, 'autoDetectProjectKey', DEFAULT_SETTINGS.autoDetectProjectKey),
    projectKeys: readProjectKeys(config),
    conventionalCommit: readBoolean(config, 'conventionalCommit', DEFAULT_SETTINGS.conventionalCommit),
    wrapper: readEnum(config, 'wrapper', WRAPPERS, DEFAULT_SETTINGS.wrapper),
    prefix: readEnum(config, 'prefix', PREFIXES, DEFAULT_SETTINGS.prefix),
    infix: readEnum(config, 'infix', INFIXES, DEFAULT_SETTINGS.infix),
    prependOnActionClick: readBoolean(config, 'prependOnActionClick', DEFAULT_SETTINGS.prependOnActionClick),
  };
}
