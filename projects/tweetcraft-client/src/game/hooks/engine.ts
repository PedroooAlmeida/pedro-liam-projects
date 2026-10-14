import type { Vec3 } from '../types';
import { observeMethod } from './method';
import { hookFlight } from './flight';

type Engine = WebAssembly.Exports & { memory: WebAssembly.Memory; state_ptr(): number; get_block(x: number, y: number, z: number): number; kind_ptr(): number };
export function hookEngine(report: (error: unknown) => void, allowFlight: () => boolean = () => false) {
  let engine: Engine | null = null;
  let flight: ReturnType<typeof hookFlight> = null, disposed = false;
  const observe = (_receiver: unknown, _args: unknown[], result: unknown) => {
    void Promise.resolve(result).then(value => {
      if (disposed) return;
      const instance = value instanceof WebAssembly.Instance ? value : (value as { instance?: unknown })?.instance;
      if (!(instance instanceof WebAssembly.Instance)) return;
      const e = instance.exports;
      if (e.memory instanceof WebAssembly.Memory && typeof e.state_ptr === 'function' && typeof e.get_block === 'function' && typeof e.kind_ptr === 'function') {
        flight?.dispose(); engine = e as Engine; flight = hookFlight(instance, allowFlight);
      }
    }).catch(report);
  };
  const cleanups = [observeMethod(WebAssembly, 'instantiate', observe, report), observeMethod(WebAssembly, 'instantiateStreaming', observe, report)];
  return {
    position(): Vec3 | null {
      if (!engine) return null;
      try {
        const state = new Float64Array(engine.memory.buffer, engine.state_ptr(), 12);
        const [x, y, z] = state;
        return [x, y, z].every(Number.isFinite) ? { x: x!, y: y!, z: z! } : null;
      } catch (error) { report(error); engine = null; return null; }
    },
    visible(from: Vec3, to: Vec3): boolean {
      if (!engine) return false;
      const d = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
      if (!Number.isFinite(d) || d > 128) return false;
      try {
        const steps = Math.ceil(d / .15);
        const kinds = new Uint8Array(engine.memory.buffer, engine.kind_ptr(), 256);
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          const id = engine.get_block(Math.floor(from.x + (to.x - from.x) * t), Math.floor(from.y + (to.y - from.y) * t), Math.floor(from.z + (to.z - from.z) * t));
          const kind = kinds[id];
          if (kind === undefined || kind === 1 || kind === 2 || kind === 3) return false;
        }
        return true;
      } catch (error) { report(error); engine = null; return false; }
    },
    ready: () => engine !== null,
    canFly: () => flight !== null && engine !== null,
    flight(enabled: boolean) {
      try { return flight?.set(enabled) ?? false; }
      catch (error) { report(error); return false; }
    },
    groundSpeed(multiplier: number) {
      try { return flight?.groundSpeed(multiplier) ?? false; }
      catch (error) { report(error); return false; }
    },
    dispose() { disposed = true; flight?.dispose(); cleanups.reverse().forEach(fn => fn()); engine = null; },
  };
}
