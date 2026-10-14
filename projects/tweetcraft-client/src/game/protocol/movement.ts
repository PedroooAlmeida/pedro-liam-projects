import type { Vec3 } from '../types';
import { record } from '../../core/settings';

type Look = Readonly<{ yaw: number; pitch: number }>;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const vector = (value: unknown): value is Vec3 => record(value) && [value.x, value.y, value.z].every(finite);
const angle = (value: number) => Math.atan2(Math.sin(value), Math.cos(value));

export function createMovementSync() {
  let baseline: ArrayBuffer | null = null, lastAt = -Infinity, nativeAt = -Infinity;
  let lastPosition: Vec3 | null = null, extraPackets = 0, resets = 0, lastResetDistance: number | null = null;
  let times: number[] = [];
  return {
    clear() {
      baseline = null; lastPosition = null; times = []; lastAt = nativeAt = -Infinity;
      extraPackets = resets = 0; lastResetDistance = null;
    },
    ready: () => baseline !== null,
    sent(data: unknown, now: number, extra = false) {
      if (!(data instanceof ArrayBuffer) || data.byteLength !== 18 || !finite(now)) return;
      const view = new DataView(data);
      if (view.getUint8(0) !== 1) return;
      const position = { x: view.getFloat32(1, true), y: view.getFloat32(5, true), z: view.getFloat32(9, true) };
      if (!vector(position)) return;
      baseline = data.slice(0); lastPosition = position; lastAt = now;
      if (extra) extraPackets++; else nativeAt = now;
      times = [...times.filter(time => time > now - 1000 && time <= now).slice(-999), now];
    },
    received(message: Record<string, unknown>) {
      if (message.t !== 'place' && message.t !== 'welcome') return;
      if (message.t === 'place' && vector(message.st)) {
        resets++;
        lastResetDistance = lastPosition ? Math.hypot(message.st.x - lastPosition.x, message.st.y - lastPosition.y, message.st.z - lastPosition.z) : null;
      }
      baseline = null; lastPosition = null; lastAt = nativeAt = -Infinity;
    },
    next(position: Vec3, look: Look, now: number): ArrayBuffer | null {
      if (!baseline || !lastPosition || !finite(now) || now - lastAt < 50 || now - nativeAt > 1000 || now < nativeAt
        || !vector(position) || ![look.yaw, look.pitch].every(finite) || Math.abs(look.pitch) > Math.PI / 2) return null;
      const view = new DataView(baseline), yaw = angle(look.yaw);
      const distance = Math.abs(position.x - lastPosition.x) + Math.abs(position.y - lastPosition.y) + Math.abs(position.z - lastPosition.z);
      if (distance <= .003 && Math.abs(angle(yaw - view.getInt16(13, true) / 1e4)) <= .004
        && Math.abs(look.pitch - view.getInt16(15, true) / 1e4) <= .004) return null;
      if (![position.x, position.y, position.z].every(value => finite(Math.fround(value)))) return null;
      const packet = baseline.slice(0), update = new DataView(packet);
      update.setFloat32(1, position.x, true); update.setFloat32(5, position.y, true); update.setFloat32(9, position.z, true);
      update.setInt16(13, Math.round(yaw * 1e4), true); update.setInt16(15, Math.round(look.pitch * 1e4), true);
      update.setUint8(17, view.getUint8(17) & ~4); // Do not replay the one-shot swing flag.
      return packet;
    },
    state(now: number) {
      return { rate: times.filter(time => time > now - 1000 && time <= now).length, extraPackets, resets, lastResetDistance };
    },
  };
}
