import { describe, expect, it, vi } from 'vitest';
import { hookFlight } from '../src/game/hooks/flight';
import { createActions } from '../src/services/actions';

describe('native flight control', () => {
  const setup = () => {
    const memory = new WebAssembly.Memory({ initial: 1 }), state = new Float64Array(memory.buffer, 0, 12);
    const fly = vi.fn((flag: number) => { state[7] = flag; }), tick = vi.fn(() => 42);
    const exports = { memory, state_ptr: () => 0, player_fly: fly, player_tick: tick };
    const instance = { exports }; let allowed = true;
    const hook = hookFlight(instance, () => allowed)!;
    return { instance, exports, hook, fly, tick, state, allow(value: boolean) { allowed = value; } };
  };
  it('keeps native flight enabled during survival ticks and restores it on disable', () => {
    const { instance, exports, hook, state, tick } = setup();
    expect(instance.exports.memory).toBe(exports.memory);
    hook.set(true); instance.exports.player_fly(0); expect(state[7]).toBe(1);
    expect(instance.exports.player_tick()).toBe(42); expect(tick).toHaveBeenCalledTimes(1);
    hook.set(false); expect(state[7]).toBe(0);
    instance.exports.player_fly(1); expect(state[7]).toBe(1);
    hook.dispose(); expect(instance.exports).toBe(exports); hook.dispose(); expect(hook.set(true)).toBe(false);
  });
  it('preserves creative flight and does not force flight when gameplay is suspended', () => {
    const { instance, hook, state, allow, fly } = setup();
    state[7] = 1; hook.set(true); hook.set(false); expect(state[7]).toBe(1);
    allow(false); state[7] = 0; hook.set(true); expect(state[7]).toBe(0);
    instance.exports.player_fly(0); expect(fly).toHaveBeenLastCalledWith(0);
    instance.exports.player_tick(); expect(state[7]).toBe(0); hook.dispose();
  });
  it('declines unsupported engines and preserves another owner’s export replacement', () => {
    expect(hookFlight({ exports: {} }, () => true)).toBeNull();
    const { instance, hook } = setup();
    const replacement = { ...instance.exports };
    Object.defineProperty(instance, 'exports', { value: replacement, configurable: true });
    hook.dispose(); expect(instance.exports).toBe(replacement);
  });
  it('releases flight on pause, module cancellation, and disposal', () => {
    const driver = { aim: () => true, attack: () => true, flight: vi.fn(() => true) }, actions = createActions(driver);
    actions.begin(); actions.flight({ owner: 'flight', priority: 10 }); actions.flush(true, 0);
    expect(driver.flight).toHaveBeenLastCalledWith(true);
    actions.begin(); actions.flight({ owner: 'flight', priority: 10 }); actions.flush(false, 10);
    expect(driver.flight).toHaveBeenLastCalledWith(false);
    actions.begin(); actions.flight({ owner: 'flight', priority: 10 }); actions.cancel('flight'); actions.flush(true, 20);
    expect(driver.flight).toHaveBeenLastCalledWith(false);
    actions.flight({ owner: 'flight', priority: NaN }); actions.flush(true, 30); expect(driver.flight).toHaveBeenLastCalledWith(false);
    actions.dispose(); expect(driver.flight).toHaveBeenLastCalledWith(false);
  });
});
