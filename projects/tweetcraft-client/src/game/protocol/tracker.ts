import type { Entity } from '../types';
import { record } from '../../core/settings';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export function createTracker() {
  const players = new Map<number, Entity>();
  let selfId: number | null = null, compatible = false, connected = false, synced = false;
  let requests = 0, hitEvents = 0, denied = 0;
  let issue = '';
  const metadata = (value: unknown) => {
    if (!record(value) || !Number.isInteger(value.id) || !finite(value.id) || value.id < 0 || value.id > 65535) return;
    const old = players.get(value.id);
    players.set(value.id, { id: value.id, name: typeof value.h === 'string' && value.h ? `@${value.h.slice(0, 50)}`
      : typeof value.name === 'string' ? value.name.slice(0, 50) : `Player ${value.id}`,
      x: old?.x ?? 0, y: old?.y ?? 0, z: old?.z ?? 0, crouching: old?.crouching ?? false, updatedAt: old?.updatedAt ?? -Infinity });
  };
  const json = (message: unknown, now: number): void => {
    if (!record(message)) return;
    if (message.t === 'welcome') {
      players.clear(); synced = false;
      selfId = finite(message.id) ? message.id : null;
      if (Array.isArray(message.players)) message.players.slice(0, 10000).forEach(metadata);
    } else if (message.t === 'synced') synced = true;
    else if (message.t === 'join' || message.t === 'who') metadata(message.p);
    else if (message.t === 'leave' && finite(message.id)) players.delete(message.id);
    else if (message.t === 'evs' && Array.isArray(message.e)) message.e.slice(0, 10000).forEach(event => json(event, now));
    else if (message.t === 'phurt') hitEvents++;
    else if (message.t === 'hitdeny') denied++;
    else if (['old', 'kicked', 'moved', 'idle', 'full'].includes(String(message.t))) {
      synced = false; players.clear();
      issue = `Server: ${String(message.t)}`;
    }
  };
  return {
    open() { connected = true; compatible = false; synced = false; players.clear(); selfId = null; issue = ''; },
    close() { connected = false; synced = false; players.clear(); },
    outgoing(data: unknown) {
      if (typeof data !== 'string' || data.length > 200000) return;
      try {
        const message: unknown = JSON.parse(data);
        if (!record(message)) return;
        if (message.t === 'hello') { compatible = message.v === 5; if (!compatible) issue = 'Unsupported Tweetcraft protocol'; }
        if (message.t === 'attack') requests++;
      } catch { issue = 'Unrecognized outgoing JSON'; }
    },
    incoming(data: unknown, now: number) {
      if (!compatible) return;
      if (typeof data === 'string') {
        if (data === 'pong' || data.length > 2_000_000) return;
        try { json(JSON.parse(data), now); } catch { issue = 'Malformed server JSON'; }
        return;
      }
      if (!(data instanceof ArrayBuffer) || data.byteLength === 0) return;
      const view = new DataView(data), type = view.getUint8(0);
      if (type !== 5 && type !== 6) return;
      if (data.byteLength < 5) { issue = 'Truncated relay header'; return; }
      const count = view.getUint16(1, true), edits = view.getUint16(3, true);
      const end = 5 + count * 19 + edits * 7;
      if (data.byteLength < end) { issue = 'Truncated relay records'; return; }
      if (type === 6) for (const [id, player] of players) players.set(id, { ...player, updatedAt: -Infinity });
      for (let i = 0; i < count; i++) {
        const offset = 5 + i * 19, id = view.getUint16(offset, true);
        const x = view.getFloat32(offset + 2, true), y = view.getFloat32(offset + 6, true), z = view.getFloat32(offset + 10, true);
        if (![x, y, z].every(Number.isFinite)) continue;
        players.set(id, { id, name: players.get(id)?.name ?? `Player ${id}`, x, y, z,
          crouching: !!(view.getUint8(offset + 18) & 1), updatedAt: now });
      }
      if (end < data.byteLength) {
        try { json({ t: 'evs', e: JSON.parse(new TextDecoder().decode(new Uint8Array(data, end))) }, now); }
        catch { issue = 'Malformed relay events'; }
      }
    },
    state(now: number) {
      // A relay delta contains only changes. Silence is not evidence that a stationary
      // player left; full snapshots, leave messages, and disconnects own presence.
      return { selfId, compatible, connected, synced, players: [...players.values()].filter(p => p.id !== selfId && Number.isFinite(p.updatedAt) && p.updatedAt <= now),
        attackRequests: requests, hitEvents, deniedHits: denied, issue };
    },
  };
}
