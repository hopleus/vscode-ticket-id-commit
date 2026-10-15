import { describe, expect, it } from 'vitest';
import {
  applyPrefix,
  buildPrefix,
  DEFAULT_SETTINGS,
  escapeRegExp,
  findConventionalType,
  findTicketKey,
  INFIXES,
  isManualModeWithoutKeys,
  prefixForBranch,
  PREFIXES,
  stripPrefix,
  WRAPPERS,
} from '../src/prefix';
import type { Settings } from '../src/prefix';

const settings = (overrides: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...overrides });
const manual = (...projectKeys: string[]): Settings => settings({ autoDetectProjectKey: false, projectKeys });
const conventional = (overrides: Partial<Settings> = {}): Settings =>
  settings({ conventionalCommit: true, infix: ':', ...overrides });

describe('findTicketKey — auto detection', () => {
  it.each([
    ['feat/this-PRODUCT-123-is-cool', 'PRODUCT-123'],
    ['fix/LEGOS-541', 'LEGOS-541'],
    ['MARCOM_881-feature', 'MARCOM_881'],
    ['docs-MARCOM_881-feature', 'MARCOM_881'],
    ['feature/PROJ-123-login', 'PROJ-123'],
    ['PROJ-1', 'PROJ-1'],
    ['bugfix/PROJ-42', 'PROJ-42'],
  ])('%s → %s', (branch, key) => {
    expect(findTicketKey(branch, settings())).toBe(key);
  });

  it.each([
    ['feature/PROJ2-15-thing', 'PROJ2-15'],
    ['ABC123-9', 'ABC123-9'],
    ['X1_77', 'X1_77'],
  ])('keys with digits: %s → %s', (branch, key) => {
    expect(findTicketKey(branch, settings())).toBe(key);
  });

  it('keeps the separator used in the branch', () => {
    expect(findTicketKey('feature/MARCOM_881', settings())).toBe('MARCOM_881');
    expect(findTicketKey('feature/MARCOM-881', settings())).toBe('MARCOM-881');
  });

  it('first match wins', () => {
    expect(findTicketKey('feature/ABC-1-and-DEF-2', settings())).toBe('ABC-1');
  });

  it('skips uppercase words without a number', () => {
    expect(findTicketKey('feature/ABC-DEF-123', settings())).toBe('DEF-123');
  });

  it('is case-sensitive', () => {
    expect(findTicketKey('feature/proj-123-login', settings())).toBeNull();
    expect(findTicketKey('feature/Proj-123-login', settings())).toBeNull();
  });

  it.each(['main', 'master', 'develop', 'feature/login', 'release/2024-10', 'A-1', 'PROJ-'])(
    'no key in %s',
    (branch) => {
      expect(findTicketKey(branch, settings())).toBeNull();
    },
  );

  it('ignores projectKeys when auto-detection is on', () => {
    expect(findTicketKey('feature/OTHER-5', settings({ projectKeys: ['PROJ'] }))).toBe('OTHER-5');
  });
});

describe('findTicketKey — manual project keys', () => {
  it.each([
    ['PRODUCT', 'feat/this-PRODUCT-123-is-cool', 'PRODUCT-123'],
    ['LEGOS', 'fix/LEGOS-541', 'LEGOS-541'],
    ['MARCOM', 'MARCOM_881-feature', 'MARCOM_881'],
  ])('nemwiz example: key %s, branch %s → %s', (key, branch, expected) => {
    expect(findTicketKey(branch, manual(key))).toBe(expected);
  });

  it('matches lowercase branches case-insensitively and uppercases the result', () => {
    expect(findTicketKey('feature/proj-123-login', manual('PROJ'))).toBe('PROJ-123');
    expect(findTicketKey('feature/Proj_7', manual('PROJ'))).toBe('PROJ_7');
    expect(findTicketKey('feature/PROJ-123', manual('proj'))).toBe('PROJ-123');
  });

  it('only recognizes configured keys', () => {
    expect(findTicketKey('feature/OTHER-5', manual('PROJ'))).toBeNull();
  });

  it('first configured key that matches wins', () => {
    const branch = 'feature/LEGOS-1-PROJ-2';
    expect(findTicketKey(branch, manual('PROJ', 'LEGOS'))).toBe('PROJ-2');
    expect(findTicketKey(branch, manual('LEGOS', 'PROJ'))).toBe('LEGOS-1');
    expect(findTicketKey('feature/LEGOS-1', manual('PROJ', 'LEGOS'))).toBe('LEGOS-1');
  });

  it('supports keys with digits', () => {
    expect(findTicketKey('feature/proj2-15', manual('PROJ2'))).toBe('PROJ2-15');
  });

  it('escapes regex-special characters in configured keys', () => {
    expect(findTicketKey('feature/C++-12', manual('C++'))).toBe('C++-12');
    expect(findTicketKey('feature/A.B-3', manual('A.B'))).toBe('A.B-3');
    expect(findTicketKey('feature/AXB-3', manual('A.B'))).toBeNull();
    expect(findTicketKey('feature/[X]-1', manual('[X]'))).toBe('[X]-1');
    expect(findTicketKey('feature/X-1', manual('[X]'))).toBeNull();
    expect(findTicketKey('feature/$1-2', manual('$1'))).toBe('$1-2');
  });

  it('does not match a key that is the tail of a longer word', () => {
    expect(findTicketKey('feature/CAB-12', manual('AB'))).toBeNull();
    expect(findTicketKey('feature/CAB-12', manual('AB', 'CAB'))).toBe('CAB-12');
  });

  it('requires a number after the key', () => {
    expect(findTicketKey('feature/PROJ-login', manual('PROJ'))).toBeNull();
  });

  it('returns null when no keys are configured', () => {
    expect(findTicketKey('feature/PROJ-1', manual())).toBeNull();
    expect(isManualModeWithoutKeys(manual())).toBe(true);
    expect(isManualModeWithoutKeys(manual('PROJ'))).toBe(false);
    expect(isManualModeWithoutKeys(settings())).toBe(false);
  });
});

describe('findConventionalType', () => {
  it.each([
    ['feat/this-PRODUCT-123-is-cool', 'feat'],
    ['fix/LEGOS-541', 'fix'],
    ['docs-MARCOM_881-feature', 'docs'],
    ['build/PROJ-1', 'build'],
    ['ci/PROJ-1', 'ci'],
    ['chore_PROJ-1', 'chore'],
    ['perf-PROJ-1', 'perf'],
    ['refactor/PROJ-1', 'refactor'],
    ['style/PROJ-1', 'style'],
    ['test/PROJ-1', 'test'],
  ])('%s → %s', (branch, type) => {
    expect(findConventionalType(branch, conventional())).toBe(type);
  });

  it.each([
    'feature/PROJ-1-login',
    'features/PROJ-1',
    'fixup/PROJ-1',
    'docsite/PROJ-1',
    'testing/PROJ-1',
    'PROJ-1-prefix-bug',
    'PROJ-7-latest-ui',
    'PROJ-7-fix-login',
    'MARCOM_881-feature',
    'release/feat-PROJ-1',
    'Feat/PROJ-1',
    'feat',
    'feat.PROJ-1',
  ])('no type in %s', (branch) => {
    expect(findConventionalType(branch, conventional())).toBeNull();
  });

  it('is disabled unless conventionalCommit is on', () => {
    expect(findConventionalType('feat/PROJ-1', settings())).toBeNull();
  });
});

describe('buildPrefix', () => {
  it('default settings → (KEY) ', () => {
    expect(buildPrefix('PROJ-123', null, settings())).toBe('(PROJ-123) ');
  });

  it.each([
    ['none', 'PROJ-123 '],
    ['()', '(PROJ-123) '],
    ['{}', '{PROJ-123} '],
    ['[]', '[PROJ-123] '],
    ['<>', '<PROJ-123> '],
    ['**', '*PROJ-123* '],
    ['//', '/PROJ-123/ '],
    ['\\\\', '\\PROJ-123\\ '],
    ['||', '|PROJ-123| '],
  ] as const)('wrapper %s → %s', (wrapper, expected) => {
    expect(buildPrefix('PROJ-123', null, settings({ wrapper }))).toBe(expected);
  });

  it.each([
    ['none', '(PROJ-123) '],
    ['-', '-(PROJ-123) '],
    [':', ':(PROJ-123) '],
    ['#', '#(PROJ-123) '],
  ] as const)('prefix %s → %s', (prefix, expected) => {
    expect(buildPrefix('PROJ-123', null, settings({ prefix }))).toBe(expected);
  });

  it.each([
    ['none', '(PROJ-123) '],
    ['-', '(PROJ-123)- '],
    [' -', '(PROJ-123) - '],
    [':', '(PROJ-123): '],
    [' :', '(PROJ-123) : '],
  ] as const)('infix %s → %s', (infix, expected) => {
    expect(buildPrefix('PROJ-123', null, settings({ infix }))).toBe(expected);
  });

  it('spec examples', () => {
    expect(buildPrefix('PROJ-123', null, settings({ wrapper: '[]', infix: ':' }))).toBe('[PROJ-123]: ');
    expect(buildPrefix('PROJ-123', 'feat', conventional({ wrapper: '()', infix: ':' }))).toBe('feat(PROJ-123): ');
    expect(buildPrefix('PROJ-123', null, settings({ wrapper: 'none', prefix: '#' }))).toBe('#PROJ-123 ');
  });

  it('combines type, prefix, wrapper and infix in nemwiz order', () => {
    expect(buildPrefix('LEGOS-456', 'fix', settings({ prefix: '-', wrapper: '{}', infix: ' -' }))).toBe(
      'fix-{LEGOS-456} - ',
    );
    expect(buildPrefix('PROJ-1', 'feat', settings({ prefix: '#', wrapper: 'none', infix: ':' }))).toBe('feat#PROJ-1: ');
    expect(buildPrefix('PROJ-1', null, settings({ prefix: ':', wrapper: '<>', infix: ' :' }))).toBe(':<PROJ-1> : ');
    expect(buildPrefix('PROJ-1', null, settings({ wrapper: 'none', infix: '-' }))).toBe('PROJ-1- ');
  });

  it('always ends with exactly one space', () => {
    for (const wrapper of WRAPPERS) {
      for (const prefix of PREFIXES) {
        for (const infix of INFIXES) {
          const result = buildPrefix('PROJ-1', 'feat', settings({ wrapper, prefix, infix }));
          expect(result.endsWith(' ')).toBe(true);
          expect(result.endsWith('  ')).toBe(false);
        }
      }
    }
  });
});

describe('prefixForBranch', () => {
  it.each([
    ['feat/this-PRODUCT-123-is-cool', '(PRODUCT-123) '],
    ['fix/LEGOS-541', '(LEGOS-541) '],
    ['MARCOM_881-feature', '(MARCOM_881) '],
    ['docs-MARCOM_881-feature', '(MARCOM_881) '],
  ])('defaults: %s → %s', (branch, expected) => {
    expect(prefixForBranch(branch, settings())).toBe(expected);
  });

  it.each([
    ['feat/this-PRODUCT-123-is-cool', 'feat(PRODUCT-123): '],
    ['fix/LEGOS-541', 'fix(LEGOS-541): '],
    ['docs-MARCOM_881-feature', 'docs(MARCOM_881): '],
    ['MARCOM_881-feature', '(MARCOM_881): '],
    ['feature/PROJ-1-login', '(PROJ-1): '],
    ['PROJ-1-prefix-bug', '(PROJ-1): '],
    ['PROJ-7-latest-ui', '(PROJ-7): '],
  ])('conventional: %s → %s', (branch, expected) => {
    expect(prefixForBranch(branch, conventional())).toBe(expected);
  });

  it('conventional off ignores the type', () => {
    expect(prefixForBranch('feat/PROJ-1', settings({ infix: ':' }))).toBe('(PROJ-1): ');
  });

  it('manual mode uppercases the key', () => {
    expect(prefixForBranch('feat/proj-9-thing', { ...manual('PROJ'), conventionalCommit: true })).toBe('feat(PROJ-9) ');
  });

  it.each([undefined, '', 'main', 'develop', 'feat/no-ticket'])('no prefix for %s', (branch) => {
    expect(prefixForBranch(branch, conventional())).toBeNull();
  });
});

describe('stripPrefix', () => {
  it('returns the text after our prefix', () => {
    expect(stripPrefix('(PROJ-1) fix login', settings())).toBe('fix login');
  });

  it('returns null when the message has no prefix', () => {
    expect(stripPrefix('fix login', settings())).toBeNull();
    expect(stripPrefix('', settings())).toBeNull();
    expect(stripPrefix('[PROJ-1] fix', settings())).toBeNull();
    expect(stripPrefix('fix (PROJ-1) login', settings())).toBeNull();
  });

  it('accepts a prefix without the trailing space', () => {
    expect(stripPrefix('(PROJ-1)fix', settings())).toBe('fix');
  });

  it('only matches at the start of the first line', () => {
    expect(stripPrefix('fix\n(PROJ-1) body', settings())).toBeNull();
  });

  it('recognizes configured keys that the generic pattern cannot', () => {
    const s = manual('C++', 'X');
    expect(stripPrefix('(C++-12) msg', s)).toBe('msg');
    expect(stripPrefix('(X-3) msg', s)).toBe('msg');
    expect(stripPrefix('(X-3) msg', settings())).toBeNull();
  });

  it('matches the escaped wrapper literally', () => {
    expect(stripPrefix('\\PROJ-1\\ msg', settings({ wrapper: '\\\\' }))).toBe('msg');
    expect(stripPrefix('|PROJ-1| msg', settings({ wrapper: '||' }))).toBe('msg');
    expect(stripPrefix('PROJ-1 msg', settings({ wrapper: '||' }))).toBeNull();
    expect(stripPrefix('*PROJ-1* msg', settings({ wrapper: '**' }))).toBe('msg');
  });
});

describe('applyPrefix', () => {
  const s = settings();

  it('sets the prefix in an empty box', () => {
    expect(applyPrefix('', '(PROJ-1) ', s)).toBe('(PROJ-1) ');
  });

  it('leaves an empty box empty when there is no key', () => {
    expect(applyPrefix('', null, s)).toBe('');
  });

  it('replaces an old prefix with a new key and keeps the text', () => {
    expect(applyPrefix('(OLD-1) fix login', '(NEW-22) ', s)).toBe('(NEW-22) fix login');
    expect(applyPrefix('(OLD-1) ', '(NEW-22) ', s)).toBe('(NEW-22) ');
  });

  it('replaces a prefix with any key, not only the current one', () => {
    expect(applyPrefix('(MARCOM_881) wip', '(PROJ2-5) ', s)).toBe('(PROJ2-5) wip');
  });

  it('removes the prefix on a branch without a key', () => {
    expect(applyPrefix('(PROJ-1) fix login', null, s)).toBe('fix login');
    expect(applyPrefix('(PROJ-1) ', null, s)).toBe('');
  });

  it('prepends to user text without a prefix', () => {
    expect(applyPrefix('fix login', '(PROJ-1) ', s)).toBe('(PROJ-1) fix login');
    expect(applyPrefix('fix (PROJ-1) login', '(PROJ-2) ', s)).toBe('(PROJ-2) fix (PROJ-1) login');
  });

  it('leaves user text alone when there is no key and no prefix', () => {
    expect(applyPrefix('fix login', null, s)).toBe('fix login');
  });

  it('keeps multi-line messages intact', () => {
    expect(applyPrefix('(PROJ-1) subject\n\nbody', '(PROJ-2) ', s)).toBe('(PROJ-2) subject\n\nbody');
  });

  it('replaces conventional prefixes, with or without a type', () => {
    const c = conventional();
    expect(applyPrefix('feat(PROJ-1): add login', 'fix(PROJ-2): ', c)).toBe('fix(PROJ-2): add login');
    expect(applyPrefix('(PROJ-1): add login', 'fix(PROJ-2): ', c)).toBe('fix(PROJ-2): add login');
    expect(applyPrefix('feat(PROJ-1): add login', null, c)).toBe('add login');
  });

  it('is idempotent', () => {
    const once = applyPrefix('fix login', '(PROJ-1) ', s);
    expect(applyPrefix(once, '(PROJ-1) ', s)).toBe(once);
    expect(applyPrefix(applyPrefix('', '(PROJ-1) ', s), '(PROJ-1) ', s)).toBe('(PROJ-1) ');
    expect(applyPrefix(applyPrefix('msg', null, s), null, s)).toBe('msg');
  });

  it('is idempotent for every wrapper / prefix / infix / type combination', () => {
    for (const wrapper of WRAPPERS) {
      for (const prefix of PREFIXES) {
        for (const infix of INFIXES) {
          for (const type of [null, 'feat']) {
            const combo = settings({ wrapper, prefix, infix, conventionalCommit: type !== null });
            const p = buildPrefix('PROJ-12', type, combo);
            const label = JSON.stringify({ wrapper, prefix, infix, type });
            const once = applyPrefix('my message', p, combo);
            expect(once, label).toBe(`${p}my message`);
            expect(applyPrefix(once, p, combo), label).toBe(once);
            expect(applyPrefix(once, buildPrefix('NEW_3', type, combo), combo), label).toBe(
              `${buildPrefix('NEW_3', type, combo)}my message`,
            );
            expect(applyPrefix(once, null, combo), label).toBe('my message');
            expect(applyPrefix(p, null, combo), label).toBe('');
          }
        }
      }
    }
  });

  it('round-trips manual-mode prefixes for configured keys', () => {
    const m = manual('C++', 'MY_PROJ');
    for (const branch of ['feature/c++-4', 'feature/my_proj-9']) {
      const p = prefixForBranch(branch, m);
      expect(p).not.toBeNull();
      const once = applyPrefix('text', p, m);
      expect(applyPrefix(once, p, m)).toBe(once);
      expect(applyPrefix(once, null, m)).toBe('text');
    }
  });
});

describe('escapeRegExp', () => {
  it('escapes every special character', () => {
    const special = '.*+?^${}()|[]\\';
    expect(new RegExp(`^${escapeRegExp(special)}$`).test(special)).toBe(true);
  });
});
