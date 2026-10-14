import { describe, expect, it } from 'vitest';
import { createMobTracker } from '../src/game/protocol/mobs';
import { createTracker } from '../src/game/protocol/tracker';

const coords = (v: DataView, o: number, x: number, y: number, z: number) => {
  const u24 = (p: number, n: number) => { v.setUint16(p, n & 65535, true); v.setUint8(p + 2, n >>> 16); };
  u24(o, Math.round(x * 256)); v.setUint16(o + 3, Math.round((y + 64) * 128), true); u24(o + 5, Math.round(z * 256));
};
export const spawn = (id = 1, kind = 4, flags = 0, data = 0, count = 0) => {
  const b = new ArrayBuffer(23), v = new DataView(b);
  v.setUint8(0, 7); v.setUint16(1, 1, true); v.setUint32(3, id, true); v.setUint8(7, kind);
  coords(v, 8, 12.5, 64.25, 9.5); v.setUint8(19, flags); v.setUint16(20, data, true); v.setUint8(22, count); return b;
};
const event = (id: number, type: number, arg = 0) => {
  const b = new ArrayBuffer(10), v = new DataView(b); v.setUint8(0, 10); v.setUint16(1, 1, true); v.setUint32(3, id, true); v.setUint8(7, type); v.setUint16(8, arg, true); return b;
};
const join = (...frames: ArrayBuffer[]) => { const bytes = new Uint8Array(frames.reduce((n, f) => n + f.byteLength, 0)); let offset = 0; frames.forEach(f => { bytes.set(new Uint8Array(f), offset); offset += f.byteLength; }); return bytes.buffer; };
describe('mob protocol tracking', () => {
  it('decodes positions and species, excluding projectiles and dropped items', () => {
    const mobs = createMobTracker(); mobs.incoming(join(spawn(), spawn(2, 9), spawn(3, 1), spawn(4, 3), spawn(5, 255)), 100);
    expect(mobs.entities()).toHaveLength(2);
    expect(mobs.entities()[0]).toMatchObject({ id: 1, name: 'Zombie', type: 'hostile', x: 12.5, y: 64.25, z: 9.5, height: 1.95 });
    expect(mobs.entities()[1]?.type).toBe('animal');
    mobs.clear(); expect(mobs.entities()).toEqual([]);
  });
  it('applies movement and deaths without conflating player IDs', () => {
    const tracker = createTracker(); tracker.open(); tracker.outgoing('{"t":"hello","v":5}');
    tracker.incoming('{"t":"welcome","id":1,"players":[{"id":1,"name":"Me"}]}', 0);
    tracker.incoming(spawn(1), 100);
    expect(tracker.state(100).mobs[0]?.id).toBe(1); expect(tracker.state(100).players).toEqual([]);
    const movement = new ArrayBuffer(18), v = new DataView(movement); v.setUint8(0, 8); v.setUint16(1, 1, true); v.setUint32(3, 1, true); coords(v, 7, 20, 70, 25);
    tracker.incoming(movement, 200); expect(tracker.state(200).mobs[0]).toMatchObject({ x: 20, y: 70, z: 25 });
    tracker.incoming(event(1, 1), 300); expect(tracker.state(300).hitEvents).toBe(1);
    tracker.incoming(event(1, 2), 400); expect(tracker.state(400).mobs).toEqual([]);
    tracker.incoming(spawn(), 500); tracker.close(); expect(tracker.state(500).mobs).toEqual([]);
  });
  it('handles baby sizes, magma cube scale, pufferfish inflation, and removal', () => {
    const mobs = createMobTracker(); mobs.incoming(join(spawn(1, 11, 1), spawn(2, 17, 0, 3), spawn(3, 28)), 0);
    expect(mobs.entities()[0]?.height).toBe(.65); expect(mobs.entities()[1]?.height).toBe(1.56); expect(mobs.entities()[2]?.height).toBe(.35);
    mobs.incoming(join(event(1, 4), event(3, 13, 2)), 100);
    expect(mobs.entities()[0]?.height).toBe(1.3); expect(mobs.entities()[2]?.height).toBe(.7);
    const gone = new ArrayBuffer(7), v = new DataView(gone); v.setUint8(0, 9); v.setUint16(1, 1, true); v.setUint32(3, 2, true);
    mobs.incoming(gone, 200); expect(mobs.entities().map(e => e.id)).toEqual([1, 3]);
  });
  it('validates complete concatenated packets before applying anything', () => {
    const mobs = createMobTracker();
    expect(mobs.incoming(new ArrayBuffer(0), 0).handled).toBe(false);
    expect(mobs.incoming(new Uint8Array([7]).buffer, 0).issue).toContain('header');
    expect(mobs.incoming(new Uint8Array([7,1,0]).buffer, 0).issue).toContain('records');
    expect(mobs.incoming(join(spawn(), new Uint8Array([12,0,0]).buffer), 0).issue).toContain('records');
    expect(mobs.entities()).toEqual([]);
    expect(mobs.incoming(event(99, 4), 0).issue).toBe('');
  });
});
