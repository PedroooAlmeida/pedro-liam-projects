import { describe, expect, it, vi } from 'vitest';
import { hookFlight } from '../src/game/hooks/flight';
import { createActions } from '../src/services/actions';

const setup = () => {
  const memory = new WebAssembly.Memory({ initial: 1 }), state = new Float64Array(memory.buffer, 0, 12);
  state[6] = 1;
  const tick = vi.fn((..._args: unknown[]) => 42), original = { memory, state_ptr: () => 0, player_tick: tick, player_fly: vi.fn() };
  const instance = { exports: original }; let active = true;
  const hook = hookFlight(instance, () => active)!;
  return { hook, state, tick, instance, active(value: boolean) { active = value; } };
};

describe('ground speed', () => {
  it('adds native ground steps, suppresses jump, preserves return values, and supports fractional speed', () => {
    const { hook, instance, tick } = setup();
    expect(hook.groundSpeed(1.5)).toBe(true);
    expect(instance.exports.player_tick(1, 0, 5, 0, 1)).toBe(42);
    expect(tick).toHaveBeenCalledExactlyOnceWith(1, 0, 4, 0, 1);
    instance.exports.player_tick(1, 0, 1, 0, 1); expect(tick).toHaveBeenCalledTimes(3);
    hook.groundSpeed(3); tick.mockClear(); instance.exports.player_tick(1, 0, 0, 0, 1);
    expect(tick).toHaveBeenCalledTimes(3);
    hook.groundSpeed(1); tick.mockClear(); instance.exports.player_tick(1, 0, 1, 0, 1);
    expect(tick).toHaveBeenCalledExactlyOnceWith(1, 0, 1, 0, 1);
    hook.dispose(); expect(hook.groundSpeed(2)).toBe(false);
  });
  it('never boosts midair, flight, liquids, idle, paused, or invalid controls', () => {
    const { hook, instance, tick, state, active } = setup(); hook.groundSpeed(3);
    for (const index of [6, 7, 8, 10]) {
      state[index] = index === 6 ? 0 : 1; tick.mockClear();
      instance.exports.player_tick(1, 0, 1, 0, 1); expect(tick).toHaveBeenCalledTimes(1);
      state[index] = index === 6 ? 1 : 0;
    }
    tick.mockClear(); instance.exports.player_tick(0, 0, 1, 0, 1); expect(tick).toHaveBeenCalledTimes(1);
    active(false); tick.mockClear(); instance.exports.player_tick(1, 0, 1, 0, 1);
    expect(tick).toHaveBeenCalledExactlyOnceWith(1, 0, 1, 0, 1);
    active(true); tick.mockClear(); instance.exports.player_tick(NaN, 0, 0, 0, 1); expect(tick).toHaveBeenCalledTimes(1);
    tick.mockClear(); instance.exports.player_tick(); expect(tick).toHaveBeenCalledTimes(1);
    for (const bad of [NaN, Infinity, 0, 4]) expect(hook.groundSpeed(bad)).toBe(false);
    hook.dispose();
  });
  it('stops extra steps immediately when a native step leaves the ground', () => {
    const { hook, instance, tick, state } = setup(); hook.groundSpeed(3);
    tick.mockImplementation(() => { state[6] = 0; return 42; });
    instance.exports.player_tick(1, 0, 0, 0, 1); expect(tick).toHaveBeenCalledTimes(1);
    hook.dispose();
  });
  it('stops extra steps as soon as native movement enters a liquid', () => {
    for (const index of [8, 10]) {
      const { hook, instance, tick, state } = setup(); hook.groundSpeed(3);
      tick.mockImplementation(() => { state[index] = 1; return 42; });
      instance.exports.player_tick(1, 0, 0, 0, 1); expect(tick).toHaveBeenCalledTimes(1);
      hook.dispose();
    }
  });
  it('arbitrates movement requests and clears them on cancellation, inactivity, and disposal', () => {
    const driver = { aim: () => true, attack: () => true, groundSpeed: vi.fn(() => true), syncPosition: vi.fn(() => true) };
    const actions = createActions(driver);
    actions.groundSpeed({ owner: 'b', priority: 1, multiplier: 2 });
    actions.groundSpeed({ owner: 'a', priority: 2, multiplier: 1.5 });
    actions.movementSync({ owner: 'a', priority: 1 }); actions.flush(true, 100);
    expect(driver.groundSpeed).toHaveBeenLastCalledWith(1.5); expect(driver.syncPosition).toHaveBeenCalledExactlyOnceWith(100);
    actions.flush(true, 101); expect(driver.groundSpeed).toHaveBeenLastCalledWith(1);
    actions.begin(); actions.groundSpeed({ owner: 'a', priority: NaN, multiplier: 2 });
    actions.groundSpeed({ owner: 'a', priority: 1, multiplier: 0 }); actions.movementSync({ owner: 'a', priority: NaN });
    actions.flush(true, 102); expect(driver.groundSpeed).toHaveBeenLastCalledWith(1);
    actions.groundSpeed({ owner: 'a', priority: 1, multiplier: 2 }); actions.movementSync({ owner: 'a', priority: 1 });
    actions.cancel('a'); actions.flush(true, 103); expect(driver.groundSpeed).toHaveBeenLastCalledWith(1);
    actions.groundSpeed({ owner: 'a', priority: 1, multiplier: 2 }); actions.movementSync({ owner: 'a', priority: 1 });
    actions.flush(false, 104); expect(driver.groundSpeed).toHaveBeenLastCalledWith(1); expect(driver.syncPosition).toHaveBeenCalledTimes(1);
    actions.groundSpeed({ owner: 'a', priority: 1, multiplier: 2 }); actions.dispose(); actions.flush(true, 105);
    expect(driver.groundSpeed).toHaveBeenLastCalledWith(1);
  });
});
