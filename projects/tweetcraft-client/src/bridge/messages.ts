import { parseProfile, record, type Profile } from '../core/settings';
import type { ModuleStatus } from '../core/module';

export const CHANNEL = 'tweetcraft-client/v1';
export type Command = { type: 'hello' } | { type: 'configure'; profile: Profile } | { type: 'menu'; open: boolean };
export type Status = Readonly<{ modules: readonly ModuleStatus[]; capabilities: readonly string[]; connected: boolean; players: number; issues: readonly string[] }>;

export function decodeCommand(raw: unknown): Command | null {
  if (!record(raw) || raw.channel !== CHANNEL || raw.direction !== 'command') return null;
  if (raw.type === 'hello') return { type: 'hello' };
  if (raw.type === 'menu' && typeof raw.open === 'boolean') return { type: 'menu', open: raw.open };
  if (raw.type === 'configure' && record(raw.profile) && raw.profile.version === 1 && record(raw.profile.modules)) return { type: 'configure', profile: parseProfile(raw.profile) };
  return null;
}

export function decodeStatus(raw: unknown): Status | null {
  if (!record(raw) || raw.channel !== CHANNEL || raw.direction !== 'status' || !record(raw.status)) return null;
  const s = raw.status;
  if (!Array.isArray(s.modules) || s.modules.length > 64 || !Array.isArray(s.capabilities) || !s.capabilities.every(v => typeof v === 'string')
    || typeof s.connected !== 'boolean' || typeof s.players !== 'number' || !Number.isFinite(s.players)
    || !Array.isArray(s.issues) || !s.issues.every(v => typeof v === 'string' && v.length < 500)) return null;
  if (!s.modules.every(m => record(m) && typeof m.id === 'string' && typeof m.enabled === 'boolean'
    && typeof m.running === 'boolean' && typeof m.reason === 'string' && record(m.values) && typeof m.keybind === 'string')) return null;
  return s as Status;
}

export function sendCommand(command: Command): void {
  window.postMessage({ channel: CHANNEL, direction: 'command', ...command }, location.origin);
}
export function sendStatus(status: Status): void {
  window.postMessage({ channel: CHANNEL, direction: 'status', status }, location.origin);
}
