import { describe, expect, it } from 'vitest';
import { emptyProfile, parseProfile, record, settingsValues } from '../src/core/settings';

describe('settings', () => {
  const schema = { speed: { label: 'Speed', kind: 'number', default: 10, min: 1, max: 20 }, active: { label: 'Active', kind: 'boolean', default: false } } as const;
  it('validates values and fills defaults', () => {
    expect(settingsValues(schema, null)).toEqual({ speed: 10, active: false });
    expect(settingsValues(schema, { speed: 100, active: true })).toEqual({ speed: 20, active: true });
    expect(settingsValues(schema, { speed: -2, active: 'yes' })).toEqual({ speed: 1, active: false });
    expect(settingsValues(schema, { speed: NaN })).toEqual({ speed: 10, active: false });
    expect(settingsValues({ n: { label: '', kind: 'number', default: 0 } }, { n: 123 })).toEqual({ n: 123 });
  });
  it('rejects unsupported profiles and strips unknown settings', () => {
    for (const value of [null, [], {}, { version: 2 }, { version: 1, modules: [] }]) expect(parseProfile(value)).toEqual(emptyProfile());
    expect(record(null)).toBe(false); expect(record([])).toBe(false);
    expect(parseProfile({ version: 1, modules: { 'bad id': {}, missing: null, good: { enabled: true, keybind: 'KeyR', values: { range: 4, bad: 'code', 'bad key': 1, inf: Infinity, wall: true } } } }))
      .toEqual({ version: 1, modules: { good: { enabled: true, keybind: 'KeyR', values: { range: 4, wall: true } } } });
    expect(parseProfile({ version: 1, modules: { good: { enabled: 'yes', keybind: 'ShiftRight' } } }).modules.good)
      .toEqual({ enabled: false, keybind: '', values: {} });
  });
});
