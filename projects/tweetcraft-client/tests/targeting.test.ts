import { describe, expect, it } from 'vitest';
import { angleDelta, selectTarget, project, aimStep } from '../src/services/targeting';
import type { Camera, Entity } from '../src/game/types';

const camera: Camera = { position: { x: 0, y: 1.62, z: 0 }, matrix: [1,0,0,0,0,1,0,0,0,0,-1,-1,0,0,-.1,0], yaw: 0, pitch: 0, width: 800, height: 600, updatedAt: 0, firstPerson: true };
const entity = (id: number, x = 0, z = -3): Entity => ({ id, name: 'Player', x, y: 0, z, crouching: false, updatedAt: 0 });
const options = { range: 6, fov: 90, selfId: 1, now: 100, visible: () => true };
describe('targeting', () => {
  it('wraps angles across the -pi/pi boundary', () => expect(angleDelta(-Math.PI + .1, Math.PI - .1)).toBeCloseTo(.2));
  it('selects a visible non-self player inside range and FOV, including stationary players', () => {
    expect(selectTarget([entity(1), entity(2, 0, -8), entity(3, 5, 0), entity(4)], camera, options)?.entity.id).toBe(4);
    expect(selectTarget([], camera, options)).toBeNull();
    expect(selectTarget([entity(2)], camera, { ...options, now: 4000 })?.entity.id).toBe(2);
    expect(selectTarget([{ ...entity(2), updatedAt: -Infinity }], camera, options)).toBeNull();
    expect(selectTarget([{ ...entity(2), updatedAt: 200 }], camera, options)).toBeNull();
    expect(selectTarget([entity(2)], camera, { ...options, visible: () => false })).toBeNull();
  });
  it('prefers the crosshair then breaks ties by distance and id', () => {
    expect(selectTarget([entity(3, 1), entity(2)], camera, options)?.entity.id).toBe(2);
    expect(selectTarget([entity(3), entity(2)], camera, options)?.entity.id).toBe(2);
    expect(selectTarget([{ ...entity(2, 0, -4), y: .17 }, { ...entity(3, 0, -2), y: .17 }], camera, options)?.entity.id).toBe(3);
    expect(selectTarget([{ ...entity(2), crouching: true }], camera, options)?.point.y).toBe(1.1);
    expect(selectTarget([{ ...entity(2, 0, 0), y: .17 }, entity(3, NaN)], camera, options)).toBeNull();
  });
  it('projects only points in front of the camera', () => {
    expect(project({ x: 0, y: 1.62, z: -3 }, camera)).toEqual({ x: 400, y: 300 });
    expect(project({ x: 0, y: 0, z: 3 }, camera)).toBeNull();
  });
  it('bounds aim by elapsed time and handles stalled frames', () => {
    const step = aimStep(1, .5, 90, 1);
    expect(Math.hypot(step.yaw, step.pitch)).toBeCloseTo(Math.PI / 20);
    expect(step.pitch / step.yaw).toBeCloseTo(.5);
    expect(aimStep(0, 0, 90, .01)).toEqual({ yaw: 0, pitch: 0 });
    expect(aimStep(.01, .01, 90, .1)).toEqual({ yaw: .01, pitch: .01 });
    expect(aimStep(1, 1, 90, -1)).toEqual({ yaw: 0, pitch: 0 });
  });
});
