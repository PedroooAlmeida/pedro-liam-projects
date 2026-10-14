type FlightController = Readonly<{ set(enabled: boolean): boolean; dispose(): void }>;

export function hookFlight(instance: Pick<WebAssembly.Instance, 'exports'>, allowed: () => boolean): FlightController | null {
  const original = instance.exports;
  const fly = original.player_fly, tick = original.player_tick, pointer = original.state_ptr, memory = original.memory;
  if (typeof fly !== 'function' || typeof tick !== 'function' || typeof pointer !== 'function' || !(memory instanceof WebAssembly.Memory)) return null;
  let requested = false, previous = false, disposed = false;
  const state = () => new Float64Array(memory.buffer, Number(pointer()), 12);
  const exports = Object.freeze({ ...original,
    player_fly(value: number) { return fly(requested && allowed() ? 1 : value); },
    player_tick(...args: unknown[]) {
      if (requested && allowed()) fly(1);
      return Reflect.apply(tick, original, args);
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
    dispose() {
      if (disposed) return;
      set(false); disposed = true;
      if (instance.exports !== exports) return;
      if (descriptor) Object.defineProperty(instance, 'exports', descriptor);
      else Reflect.deleteProperty(instance, 'exports');
    },
  };
}
