type FlightController = Readonly<{ set(enabled: boolean): boolean; groundSpeed(multiplier: number): boolean; dispose(): void }>;

export function hookFlight(instance: Pick<WebAssembly.Instance, 'exports'>, allowed: () => boolean): FlightController | null {
  const original = instance.exports;
  const fly = original.player_fly, tick = original.player_tick, pointer = original.state_ptr, memory = original.memory;
  if (typeof fly !== 'function' || typeof tick !== 'function' || typeof pointer !== 'function' || !(memory instanceof WebAssembly.Memory)) return null;
  let requested = false, previous = false, disposed = false;
  let speed = 1, budget = 0;
  const state = () => new Float64Array(memory.buffer, Number(pointer()), 12);
  const grounded = () => { const st = state(); return !!st[6] && !st[7] && !st[8] && !st[10]; };
  const exports = Object.freeze({ ...original,
    player_fly(value: number) { return fly(requested && allowed() ? 1 : value); },
    player_tick(...args: unknown[]) {
      if (requested && allowed()) fly(1);
      if (speed <= 1 || !allowed()) return Reflect.apply(tick, original, args);
      const [forward, strafe, flags] = args;
      if (!grounded() || typeof forward !== 'number' || typeof strafe !== 'number' || typeof flags !== 'number'
        || ![forward, strafe, flags].every(Number.isFinite)) { budget = 0; return Reflect.apply(tick, original, args); }
      const controls = [forward, strafe, flags & ~1, ...args.slice(3)];
      const result = Reflect.apply(tick, original, controls);
      if (!forward && !strafe) { budget = 0; return result; }
      budget += speed - 1;
      const extra = Math.floor(budget); budget -= extra;
      for (let i = 0; i < extra && grounded(); i++) Reflect.apply(tick, original, controls);
      return result;
    },
  });
  const descriptor = Object.getOwnPropertyDescriptor(instance, 'exports');
  // Shadow the instance accessor, preserving native export identities except these two controls.
  Object.defineProperty(instance, 'exports', { value: exports, configurable: true, enumerable: true });
  const set = (enabled: boolean) => {
    if (disposed) return false;
    if (enabled && !requested) previous = !!state()[7];
    if (!enabled && requested) fly(previous ? 1 : 0);
    requested = enabled;
    if (enabled && allowed()) fly(1);
    return true;
  };
  return {
    set,
    groundSpeed(multiplier: number) {
      if (disposed || !Number.isFinite(multiplier) || multiplier < 1 || multiplier > 3) return false;
      speed = multiplier; if (speed === 1) budget = 0;
      return true;
    },
    dispose() {
      if (disposed) return;
      set(false); speed = 1; budget = 0; disposed = true;
      if (instance.exports !== exports) return;
      if (descriptor) Object.defineProperty(instance, 'exports', descriptor);
      else Reflect.deleteProperty(instance, 'exports');
    },
  };
}
