import { describe, expect, it, vi } from 'vitest';
import { CHANNEL, decodeCommand, decodeStatus, sendCommand, sendStatus } from '../src/bridge/messages';

describe('message bridge', () => {
  it('validates commands and strips unsupported profile properties', () => {
    const envelope = { channel: CHANNEL, direction: 'command' };
    for (const raw of [null, [], {}, { ...envelope, type: 'eval' }, { ...envelope, type: 'menu', open: 1 }, { ...envelope, type: 'configure', profile: [] }]) expect(decodeCommand(raw)).toBeNull();
    expect(decodeCommand({ ...envelope, type: 'hello' })).toEqual({ type: 'hello' });
    expect(decodeCommand({ ...envelope, type: 'menu', open: true })).toEqual({ type: 'menu', open: true });
    expect(decodeCommand({ ...envelope, type: 'configure', profile: { version: 1, modules: {} } })).toEqual({ type: 'configure', profile: { version: 1, modules: {} } });
  });
  it('validates statuses before UI use', () => {
    const status = { modules: [], capabilities: ['position'], connected: true, players: 2, issues: [] };
    const envelope = { channel: CHANNEL, direction: 'status', status };
    expect(decodeStatus(envelope)).toEqual(status);
    for (const raw of [null, {}, { ...envelope, status: {} }, { ...envelope, status: { ...status, modules: [{}] } }, { ...envelope, status: { ...status, players: NaN } }, { ...envelope, status: { ...status, issues: [12] } }]) expect(decodeStatus(raw)).toBeNull();
    const postMessage = vi.fn(); vi.stubGlobal('window', { postMessage }); vi.stubGlobal('location', { origin: 'https://tweetcraft.jai.vin' });
    sendCommand({ type: 'hello' }); sendStatus(status);
    expect(postMessage).toHaveBeenCalledTimes(2); vi.unstubAllGlobals();
  });
});
