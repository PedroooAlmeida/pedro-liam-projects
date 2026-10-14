import type { Camera, Entity, Vec3 } from '../game/types';

export const angleDelta = (target: number, current: number): number =>
  Math.atan2(Math.sin(target - current), Math.cos(target - current));
export const distance = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const targetPoint = (entity: Entity): Vec3 => ({ x: entity.x, y: entity.y + (entity.crouching ? 1.1 : 1.45), z: entity.z });
export type Target = Readonly<{ entity: Entity; point: Vec3; distance: number; yaw: number; pitch: number; error: number }>;

export function selectTarget(entities: readonly Entity[], camera: Camera, options: {
  range: number; fov: number; selfId: number | null; now: number; visible(from: Vec3, to: Vec3): boolean;
}): Target | null {
  const targets: Target[] = [];
  for (const entity of entities) {
    if (entity.id === options.selfId || !Number.isFinite(entity.updatedAt) || entity.updatedAt > options.now) continue;
    const point = targetPoint(entity), d = distance(camera.position, point);
    if (!Number.isFinite(d) || d > options.range || d < .01) continue;
    const dx = point.x - camera.position.x, dy = point.y - camera.position.y, dz = point.z - camera.position.z;
    const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
    const error = Math.acos(Math.max(-1, Math.min(1,
      Math.sin(camera.pitch) * Math.sin(pitch) + Math.cos(camera.pitch) * Math.cos(pitch) * Math.cos(yaw - camera.yaw))));
    if (error > options.fov * Math.PI / 360 || !options.visible(camera.position, point)) continue;
    targets.push({ entity, point, distance: d, yaw, pitch, error });
  }
  return targets.sort((a, b) => a.error - b.error || a.distance - b.distance || a.entity.id - b.entity.id)[0] ?? null;
}

export function project(point: Vec3, camera: Camera): { x: number; y: number } | null {
  const { matrix: m, position: p } = camera;
  const x = point.x - p.x, y = point.y - p.y, z = point.z - p.z;
  const w = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!;
  if (w <= .05) return null;
  return {
    x: ((m[0]! * x + m[4]! * y + m[8]! * z + m[12]!) / w * .5 + .5) * camera.width,
    y: (.5 - (m[1]! * x + m[5]! * y + m[9]! * z + m[13]!) / w * .5) * camera.height,
  };
}

export function aimStep(yaw: number, pitch: number, degreesPerSecond: number, dt: number) {
  const length = Math.hypot(yaw, pitch);
  const scale = length === 0 ? 0 : Math.min(1, degreesPerSecond * Math.PI / 180 * Math.max(0, Math.min(.1, dt)) / length);
  return { yaw: yaw * scale, pitch: pitch * scale };
}
