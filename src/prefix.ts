export const WRAPPERS = ['none', '()', '{}', '[]', '<>', '**', '//', '\\\\', '||'] as const;
export const PREFIXES = ['none', '-', ':', '#'] as const;
export const INFIXES = ['none', '-', ' -', ':', ' :'] as const;
export const CONVENTIONAL_TYPES = ['feat', 'fix', 'build', 'ci', 'chore', 'docs', 'perf', 'refactor', 'style', 'test'] as const;

export type Wrapper = (typeof WRAPPERS)[number];
export type Prefix = (typeof PREFIXES)[number];
export type Infix = (typeof INFIXES)[number];

export interface Settings {
  readonly autoDetectProjectKey: boolean;
  readonly projectKeys: readonly string[];
  readonly conventionalCommit: boolean;
  readonly wrapper: Wrapper;
  readonly prefix: Prefix;
  readonly infix: Infix;
  readonly prependOnActionClick: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  autoDetectProjectKey: true,
  projectKeys: [],
  conventionalCommit: false,
  wrapper: '()',
  prefix: 'none',
  infix: 'none',
  prependOnActionClick: false,
};

const AUTO_KEY = '[A-Z][A-Z0-9]+';
const KEY_NUMBER = '[_-]\\d+';
const AUTO_KEY_RE = new RegExp(AUTO_KEY + KEY_NUMBER);
const CONVENTIONAL_TYPE_RE = new RegExp(`^(${CONVENTIONAL_TYPES.join('|')})(?=[/_-])`);

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isManualModeWithoutKeys(settings: Settings): boolean {
  return !settings.autoDetectProjectKey && settings.projectKeys.length === 0;
}

export function findTicketKey(branch: string, settings: Settings): string | null {
  if (settings.autoDetectProjectKey) {
    return AUTO_KEY_RE.exec(branch)?.[0] ?? null;
  }
  for (const key of settings.projectKeys) {
    const match = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(key)}${KEY_NUMBER}`, 'i').exec(branch);
    if (match) {
      return match[0].toUpperCase();
    }
  }
  return null;
}

export function findConventionalType(branch: string, settings: Settings): string | null {
  if (!settings.conventionalCommit) {
    return null;
  }
  return CONVENTIONAL_TYPE_RE.exec(branch)?.[1] ?? null;
}

function optionText(value: Prefix | Infix): string {
  return value === 'none' ? '' : value;
}

function wrapperChars(wrapper: Wrapper): [string, string] {
  return wrapper === 'none' ? ['', ''] : [wrapper.charAt(0), wrapper.charAt(1)];
}

export function buildPrefix(key: string, type: string | null, settings: Settings): string {
  const [open, close] = wrapperChars(settings.wrapper);
  return `${type ?? ''}${optionText(settings.prefix)}${open}${key}${close}${optionText(settings.infix)} `;
}

export function prefixForBranch(branch: string | undefined, settings: Settings): string | null {
  if (!branch) {
    return null;
  }
  const key = findTicketKey(branch, settings);
  if (!key) {
    return null;
  }
  return buildPrefix(key, findConventionalType(branch, settings), settings);
}

function prefixPattern(settings: Settings): RegExp {
  const [open, close] = wrapperChars(settings.wrapper);
  const keys = [AUTO_KEY, ...settings.projectKeys.map((key) => escapeRegExp(key.toUpperCase()))];
  const type = settings.conventionalCommit ? `(?:${CONVENTIONAL_TYPES.join('|')})?` : '';
  return new RegExp(
    '^' +
      type +
      escapeRegExp(optionText(settings.prefix)) +
      escapeRegExp(open) +
      `(?:${keys.join('|')})${KEY_NUMBER}` +
      escapeRegExp(close) +
      escapeRegExp(optionText(settings.infix)) +
      ' ?',
  );
}

export function stripPrefix(message: string, settings: Settings): string | null {
  const match = prefixPattern(settings).exec(message);
  return match ? message.slice(match[0].length) : null;
}

export function applyPrefix(message: string, newPrefix: string | null, settings: Settings): string {
  return (newPrefix ?? '') + (stripPrefix(message, settings) ?? message);
}
