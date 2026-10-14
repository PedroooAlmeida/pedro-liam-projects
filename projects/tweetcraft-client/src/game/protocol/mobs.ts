import type { Entity, TargetType } from '../types';

type Species = Readonly<{ name: string; type: TargetType; width: number; height: number }>;
const species = (name: string, type: TargetType, width: number, height: number): Species => ({ name, type, width, height });
// Protocol 5 living entities only: items, XP, projectiles, crystals, and bobbers are excluded.
const SPECIES: Readonly<Record<number, Species>> = {
  4: species('Zombie', 'hostile', .6, 1.95), 5: species('Skeleton', 'hostile', .6, 1.99),
  6: species('Creeper', 'hostile', .6, 1.7), 7: species('Spider', 'hostile', 1.4, .9),
  8: species('Enderman', 'hostile', .6, 2.9), 9: species('Cow', 'animal', .9, 1.4),
  10: species('Pig', 'animal', .9, .9), 11: species('Sheep', 'animal', .9, 1.3),
  12: species('Chicken', 'animal', .4, .7), 14: species('Blaze', 'hostile', .6, 1.8),
  15: species('Zombie Pigman', 'hostile', .6, 1.95), 16: species('Ghast', 'hostile', 4, 4),
  17: species('Magma Cube', 'hostile', .52, .52), 18: species('Wither Skeleton', 'hostile', .7, 2.4),
  19: species('Silverfish', 'hostile', .4, .3), 23: species('Ender Dragon', 'hostile', 12, 5),
  26: species('Cod', 'animal', .5, .3), 27: species('Salmon', 'animal', .7, .4),
  28: species('Pufferfish', 'animal', .7, .7), 29: species('Tropical Fish', 'animal', .5, .4),
};
const RECORD: Readonly<Record<number, number>> = { 7: 20, 8: 15, 9: 4, 10: 7, 11: 7 };
type TrackedMob = { entity: Entity; kind: number; flags: number; data: number; count: number };
const position = (view: DataView, offset: number) => ({
  x: (view.getUint16(offset, true) | view.getUint8(offset + 2) << 16) / 256,
  y: view.getUint16(offset + 3, true) / 128 - 64,
  z: (view.getUint16(offset + 5, true) | view.getUint8(offset + 7) << 16) / 256,
});
function dimensions(mob: TrackedMob): Entity {
  const s = SPECIES[mob.kind]!;
  const scale = mob.kind === 17 ? mob.data || 1 : mob.flags & 1 ? .5 : 1;
  const puff = [.5, .7, 1][Math.min(2, mob.count)]!;
  return { ...mob.entity, width: mob.kind === 28 ? .7 * puff : s.width * scale, height: mob.kind === 28 ? .7 * puff : s.height * scale };
}

export function createMobTracker() {
  const mobs = new Map<number, TrackedMob>();
  return {
    clear: () => mobs.clear(),
    entities: (): readonly Entity[] => [...mobs.values()].map(m => m.entity),
    incoming(buffer: ArrayBuffer, now: number): { handled: boolean; hurts: number; issue: string } {
      const view = new DataView(buffer);
      if (!buffer.byteLength || !RECORD[view.getUint8(0)]) return { handled: false, hurts: 0, issue: '' };
      const frames: { type: number; offset: number; count: number; size: number }[] = [];
      // Validate all concatenated frames before mutating tracking state.
      for (let offset = 0; offset < buffer.byteLength;) {
        if (offset + 3 > buffer.byteLength) return { handled: true, hurts: 0, issue: 'Truncated entity header' };
        const type = view.getUint8(offset), size = RECORD[type], count = view.getUint16(offset + 1, true);
        if (!size || offset + 3 + size * count > buffer.byteLength) return { handled: true, hurts: 0, issue: 'Invalid entity records' };
        frames.push({ type, offset: offset + 3, count, size }); offset += 3 + size * count;
      }
      let hurts = 0;
      for (const frame of frames) for (let i = 0; i < frame.count; i++) {
        const o = frame.offset + i * frame.size, id = view.getUint32(o, true);
        if (frame.type === 7) {
          const kind = view.getUint8(o + 4), s = SPECIES[kind];
          if (!s) { mobs.delete(id); continue; }
          const mob: TrackedMob = { kind, flags: view.getUint8(o + 16), data: view.getUint16(o + 17, true), count: view.getUint8(o + 19),
            entity: { id, ...s, ...position(view, o + 5), crouching: false, updatedAt: now } };
          mob.entity = dimensions(mob); mobs.set(id, mob);
        } else if (frame.type === 9) mobs.delete(id);
        else {
          const mob = mobs.get(id);
          if (!mob) continue;
          if (frame.type === 8) mob.entity = { ...mob.entity, ...position(view, o + 4), updatedAt: now };
          else if (frame.type === 10) {
            const event = view.getUint8(o + 4), arg = view.getUint16(o + 5, true);
            if (event === 1) hurts++;
            else if (event === 2) mobs.delete(id);
            else if (event === 4) { mob.flags = arg; mob.entity = dimensions(mob); }
            else if (event === 13 && mob.kind === 28) { mob.count = Math.min(2, arg); mob.entity = dimensions(mob); }
          }
        }
      }
      return { handled: true, hurts, issue: '' };
    },
  };
}
