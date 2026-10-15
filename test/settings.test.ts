import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/prefix';
import { readSettings, SECTION } from '../src/settings';
import { getConfigurationCalls, setConfiguration } from './mocks/vscode';

describe('readSettings', () => {
  beforeEach(() => {
    setConfiguration({});
  });

  it('returns defaults when nothing is configured', () => {
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('reads the ticketIdCommitMessage section with the given scope', () => {
    const scope = { fsPath: '/repo' };
    readSettings(scope as never);
    expect(getConfigurationCalls).toEqual([{ section: SECTION, scope }]);
    expect(SECTION).toBe('ticketIdCommitMessage');
  });

  it('passes valid values through', () => {
    setConfiguration({
      autoDetectProjectKey: false,
      projectKeys: ['PROJ', 'LEGOS'],
      conventionalCommit: true,
      wrapper: '\\\\',
      prefix: '#',
      infix: ' :',
      prependOnActionClick: true,
    });
    expect(readSettings()).toEqual({
      autoDetectProjectKey: false,
      projectKeys: ['PROJ', 'LEGOS'],
      conventionalCommit: true,
      wrapper: '\\\\',
      prefix: '#',
      infix: ' :',
      prependOnActionClick: true,
    });
  });

  it.each([
    ['autoDetectProjectKey', 'false'],
    ['conventionalCommit', 1],
    ['prependOnActionClick', null],
  ])('falls back to the default for a non-boolean %s', (key, value) => {
    setConfiguration({ [key]: value });
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it.each([
    ['wrapper', '(('],
    ['wrapper', ''],
    ['wrapper', 42],
    ['prefix', '##'],
    ['prefix', ' '],
    ['infix', ' - '],
    ['infix', true],
  ])('falls back to the default for an unknown %s %j', (key, value) => {
    setConfiguration({ [key]: value });
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it.each([['PROJ'], [{ PROJ: true }], [null], [42]])('ignores projectKeys that are not an array: %j', (value) => {
    setConfiguration({ projectKeys: value });
    expect(readSettings().projectKeys).toEqual([]);
  });

  it('drops non-string and blank project keys', () => {
    setConfiguration({ projectKeys: ['PROJ', 1, null, '', '   ', { key: 'X' }, 'LEGOS'] });
    expect(readSettings().projectKeys).toEqual(['PROJ', 'LEGOS']);
  });

  it('trims project keys and strips trailing separators', () => {
    setConfiguration({ projectKeys: ['  PROJ ', 'LEGOS-', 'AB_', 'X-_-', '-'] });
    expect(readSettings().projectKeys).toEqual(['PROJ', 'LEGOS', 'AB', 'X']);
  });

  it('removes duplicate project keys after normalization', () => {
    setConfiguration({ projectKeys: ['PROJ', 'PROJ-', ' PROJ', 'LEGOS', 'PROJ'] });
    expect(readSettings().projectKeys).toEqual(['PROJ', 'LEGOS']);
  });

  it('keeps the case of project keys', () => {
    setConfiguration({ projectKeys: ['proj', 'Legos'] });
    expect(readSettings().projectKeys).toEqual(['proj', 'Legos']);
  });
});
