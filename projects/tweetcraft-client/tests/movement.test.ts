import { describe, expect, it } from 'vitest';
import { createMovementSync } from '../src/game/protocol/movement';

const packet = (x = 0) => {
  const buffer = new ArrayBuffer(18), view = new DataView(buffer);
  view.setUint8(0, 1); view.setFloat32(1, x, true); view.setFloat32(5, 64, true);
  view.setInt16(13, 100, true); view.setInt16(15, 200, true); view.setUint8(17, 5);
  return buffer;
};
const pose = { x: 1, y: 65, z: 2 }, look = { yaw: .5, pitch: -.2 };

describe('supplemental movement updates', () => {
  it('requires a native baseline and respects a 50ms interval without duplicate positions', () => {
    const movement = createMovementSync();
    expect(movement.next(pose, look, 100)).toBeNull();
    movement.sent(packet(), 0);
    expect(movement.next(pose, look, 49)).toBeNull();
    const next = movement.next(pose, look, 50)!;
    const view = new DataView(next);
    expect([view.getFloat32(1, true), view.getFloat32(5, true), view.getFloat32(9, true)]).toEqual([1, 65, 2]);
    expect([view.getInt16(13, true), view.getInt16(15, true), view.getUint8(17)]).toEqual([5000, -2000, 1]);
    movement.sent(next, 50, true);
    expect(movement.next(pose, look, 100)).toBeNull();
    expect(movement.next({ ...pose, x: 2 }, look, 99)).toBeNull();
    expect(movement.next({ ...pose, x: 2 }, look, 100)).not.toBeNull();
    expect(movement.state(100)).toMatchObject({ rate: 2, extraPackets: 1, resets: 0 });
    expect(movement.state(1100).rate).toBe(0);
  });
  it('rejects malformed poses and stale baselines, including a native pause or clock reversal', () => {
    const movement = createMovementSync();
    for (const bad of [null, 'ping', new ArrayBuffer(0), new ArrayBuffer(17), new ArrayBuffer(18)]) movement.sent(bad, 0);
    expect(movement.ready()).toBe(false);
    const bad = packet(); new DataView(bad).setFloat32(1, NaN, true); movement.sent(bad, 0);
    movement.sent(packet(), 0);
    expect(movement.next({ ...pose, x: NaN }, look, 50)).toBeNull();
    expect(movement.next({ ...pose, x: Number.MAX_VALUE }, look, 50)).toBeNull();
    expect(movement.next(pose, { yaw: Infinity, pitch: 0 }, 50)).toBeNull();
    expect(movement.next(pose, look, 1001)).toBeNull();
    expect(movement.next(pose, look, -10)).toBeNull();
    expect(movement.next(pose, { yaw: Math.PI * 4, pitch: 0 }, 50)).not.toBeNull();
  });
  it('invalidates baselines on server resets and records displacement without claiming a correction cause', () => {
    const movement = createMovementSync(); movement.sent(packet(4), 0);
    movement.received({ t: 'place', st: { x: 1, y: 64, z: 4 } });
    expect(movement.state(1)).toMatchObject({ resets: 1, lastResetDistance: 5 });
    expect(movement.ready()).toBe(false); expect(movement.next(pose, look, 50)).toBeNull();
    movement.received({ t: 'place', st: { x: NaN } });
    expect(movement.state(1).resets).toBe(1);
    movement.sent(packet(), 100); movement.received({ t: 'place', st: { x: 0, y: 64, z: 0 } });
    expect(movement.state(101).lastResetDistance).toBe(0);
    movement.received({ t: 'welcome' }); movement.clear();
    expect(movement.state(200)).toEqual({ rate: 0, extraPackets: 0, resets: 0, lastResetDistance: null });
  });
});
