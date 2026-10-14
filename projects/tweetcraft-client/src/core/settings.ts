export type Setting = Readonly<{
  label: string; kind: 'number' | 'boolean'; default: number | boolean;
  min?: number; max?: number; step?: number;
}>;
export type Values = Readonly<Record<string, number | boolean>>;
export type Preferences = Readonly<{ enabled: boolean; keybind: string; values: Values }>;
export type Profile = Readonly<{ version: 1; modules: Readonly<Record<string, Preferences>> }>;
export const emptyProfile = (): Profile => ({ version: 1, modules: {} });
export const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function settingsValues(schema: Readonly<Record<string, Setting>>, raw: unknown): Values {
  const input = record(raw) ? raw : {};
  return Object.fromEntries(Object.entries(schema).map(([key, setting]) => {
    const value = input[key];
    if (setting.kind === 'boolean') return [key, typeof value === 'boolean' ? value : setting.default];
    return [key, typeof value === 'number' && Number.isFinite(value)
      ? Math.max(setting.min ?? -Infinity, Math.min(setting.max ?? Infinity, value)) : setting.default];
  }));
}

export function parseProfile(raw: unknown): Profile {
  if (!record(raw) || raw.version !== 1 || !record(raw.modules)) return emptyProfile();
  const modules = Object.fromEntries(Object.entries(raw.modules).filter(([id]) => /^[a-z][a-z0-9-]{0,47}$/.test(id)).slice(0, 64).flatMap(([id, value]) => {
    if (!record(value)) return [];
    const values: Values = record(value.values) ? Object.fromEntries(Object.entries(value.values).filter((entry): entry is [string, number | boolean] => {
      const [key, v] = entry;
      return /^[a-z][a-zA-Z0-9]{0,40}$/.test(key) && (typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v));
    })) : {};
    return [[id, { enabled: value.enabled === true, keybind: typeof value.keybind === 'string' && /^(Key[A-Z]|Digit[0-9]|F[6-9]|F1[0-2])$/.test(value.keybind) ? value.keybind : '', values }]];
  }));
  return { version: 1, modules };
}
